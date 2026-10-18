// Pure money calculations. Everything internal is converted to the user's base
// currency (their main currency, chosen at setup). `rates` maps a currency code
// to "units of that currency per 1 unit of the base" (so rates[base] === 1).
// Records keep the rate that applied when they were entered (`rate`), so past
// months don't change when exchange rates move.

const DAY = 86_400_000;
const MONTH_DAYS = 30.436875;

export function rateOf(rates, ccy) {
  const r = Number(rates?.[ccy]);
  return r > 0 ? r : null;
}

export function toBase(amount, ccy, rates, snapshotRate) {
  const r = Number(snapshotRate) > 0 ? Number(snapshotRate) : rateOf(rates, ccy);
  return r ? Number(amount) / r : 0;
}

export function fromBase(amountBase, ccy, rates) {
  return amountBase * (rateOf(rates, ccy) ?? 1);
}

export function convert(amount, from, to, rates) {
  return fromBase(toBase(amount, from, rates), to, rates);
}

// ---------------------------------------------------------------- dates
const pad = (n) => String(n).padStart(2, '0');
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monthKey = (d) => (typeof d === 'string' ? d.slice(0, 7) : `${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
export const parseDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d || 1);
};

export function addMonths(key, n) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return monthKey(d);
}

export function addMonthsToDate(date, months) {
  const whole = Math.floor(months);
  const d = new Date(date.getFullYear(), date.getMonth() + whole, date.getDate());
  return new Date(d.getTime() + (months - whole) * MONTH_DAYS * DAY);
}

export function monthsBetween(from, to) {
  return (to.getTime() - from.getTime()) / (MONTH_DAYS * DAY);
}

// ---------------------------------------------------------------- transactions
export const txBase = (tx, rates) => toBase(tx.amount, tx.currency, rates, tx.rate);

export function monthTotals(transactions, rates) {
  const out = new Map();
  for (const tx of transactions) {
    const k = monthKey(tx.date);
    const t = out.get(k) ?? { income: 0, expense: 0 };
    t[tx.type === 'income' ? 'income' : 'expense'] += txBase(tx, rates);
    out.set(k, t);
  }
  return out;
}

export function monthSummary(transactions, rates, key) {
  let income = 0;
  let expense = 0;
  const byCategory = new Map();
  for (const tx of transactions) {
    if (monthKey(tx.date) !== key) continue;
    const v = txBase(tx, rates);
    if (tx.type === 'income') income += v;
    else {
      expense += v;
      byCategory.set(tx.categoryId, (byCategory.get(tx.categoryId) ?? 0) + v);
    }
  }
  const saved = income - expense;
  return {
    income,
    expense,
    saved,
    savingsRate: income > 0 ? saved / income : null,
    byCategory: [...byCategory].map(([categoryId, amount]) => ({ categoryId, amount })).sort((a, b) => b.amount - a.amount),
  };
}

// Average of per-month values over the last `maxMonths` complete months since
// the first month with data. If only the current month has data, it is used.
function averageMonthly(totals, now, maxMonths) {
  if (!totals.size) return { avg: null, months: 0 };
  const current = monthKey(now);
  const first = [...totals.keys()].sort()[0];
  const months = [];
  for (let k = addMonths(current, -1); k >= first && months.length < maxMonths; k = addMonths(k, -1)) months.push(k);
  if (!months.length) return totals.has(current) ? { avg: totals.get(current), months: 1, partial: true } : { avg: null, months: 0 };
  return { avg: months.reduce((sum, k) => sum + (totals.get(k) ?? 0), 0) / months.length, months: months.length };
}

// Average monthly saving: income − expenses, in base currency.
export function averageMonthlySaving(transactions, rates, now = new Date(), maxMonths = 6) {
  const totals = new Map([...monthTotals(transactions, rates)].map(([k, v]) => [k, v.income - v.expense]));
  return averageMonthly(totals, now, maxMonths);
}

// Average monthly net money put into the given holdings, in base currency.
export function averageMonthlyContributions(holdings, rates, now = new Date(), maxMonths = 6) {
  const totals = new Map();
  for (const h of holdings) {
    for (const c of h.contributions ?? []) {
      const k = monthKey(c.date);
      totals.set(k, (totals.get(k) ?? 0) + toBase(c.amount, c.currency, rates, c.rate));
    }
  }
  return averageMonthly(totals, now, maxMonths);
}

// ---------------------------------------------------------------- investments
export function latestValue(holding) {
  const vals = holding.values ?? [];
  if (!vals.length) return null;
  return [...vals].sort((a, b) => (a.date === b.date ? (a.at ?? 0) - (b.at ?? 0) : a.date < b.date ? -1 : 1)).at(-1);
}

export function holdingStats(holding, rates) {
  const hc = holding.currency;
  let contributedBase = 0;
  let contributedNative = 0;
  for (const c of holding.contributions ?? []) {
    const base = toBase(c.amount, c.currency, rates, c.rate);
    contributedBase += base;
    contributedNative += c.currency === hc ? Number(c.amount) : base * (Number(c.hRate) > 0 ? Number(c.hRate) : rateOf(rates, hc) ?? 1);
  }
  const lv = latestValue(holding);
  const valueNative = lv ? Number(lv.value) : contributedNative;
  const valueBase = toBase(valueNative, hc, rates);
  const gainNative = valueNative - contributedNative;
  const gainBase = valueBase - contributedBase;
  return {
    contributedBase,
    contributedNative,
    valueNative,
    valueBase,
    gainNative,
    gainBase,
    gainPctNative: contributedNative > 0 ? gainNative / contributedNative : null,
    gainPctBase: contributedBase > 0 ? gainBase / contributedBase : null,
    valuedAt: lv?.date ?? null,
  };
}

// ---------------------------------------------------------------- personal loans (السلف)
// loan: { person, direction: 'lent' (they owe me) | 'borrowed' (I owe them),
//         amount, currency, date, dueDate?, repayments: [{ amount, date }], settledAt? }
export function loanRepaid(loan) {
  return (loan.repayments ?? []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
}

export function loanRemaining(loan) {
  if (loan.settledAt) return 0;
  return Math.max(0, (Number(loan.amount) || 0) - loanRepaid(loan));
}

export const personKey = (name) => String(name ?? '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ');

// Totals in base currency: owed to me, I owe, and a net balance per person
// (positive = they owe me) across all their open loans.
export function loanTotals(state) {
  const { rates } = state;
  let owedToMe = 0;
  let iOwe = 0;
  const people = new Map();
  for (const loan of state.loans ?? []) {
    const rem = toBase(loanRemaining(loan), loan.currency, rates);
    const signed = loan.direction === 'lent' ? rem : -rem;
    if (loan.direction === 'lent') owedToMe += rem;
    else iOwe += rem;
    const key = personKey(loan.person);
    const p = people.get(key) ?? { key, person: loan.person, net: 0, open: 0, loans: [] };
    p.net += signed;
    if (rem > 0) p.open++;
    p.loans.push(loan);
    people.set(key, p);
  }
  return { owedToMe, iOwe, people: [...people.values()].sort((a, b) => Math.abs(b.net) - Math.abs(a.net)) };
}

// Open loans with a due date within `days` (or already overdue).
export function dueLoans(state, now = new Date(), days = 3) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const out = [];
  for (const loan of state.loans ?? []) {
    if (!loan.dueDate || loanRemaining(loan) <= 0) continue;
    const daysLeft = Math.round((parseDate(loan.dueDate) - today) / DAY);
    if (daysLeft <= days) out.push({ loan, daysLeft, overdue: daysLeft < 0 });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

// Finds open loans with this person, e.g. for "محمد رجّعلي 200".
export function openLoansWith(state, person, direction) {
  const key = personKey(person);
  return (state.loans ?? [])
    .filter((l) => personKey(l.person) === key && (!direction || l.direction === direction) && loanRemaining(l) > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

// ---------------------------------------------------------------- net worth
// cash + investments + money owed to me − debts − money I owe
export function netWorth(state) {
  const { rates } = state;
  const cash = (state.accounts ?? []).reduce((s, a) => s + toBase(a.balance, a.currency, rates), 0);
  const investments = (state.holdings ?? []).reduce((s, h) => s + holdingStats(h, rates).valueBase, 0);
  const liabilities = (state.liabilities ?? []).reduce((s, l) => s + toBase(l.amount, l.currency, rates), 0);
  const { owedToMe: receivables, iOwe: payables } = loanTotals(state);
  return { cash, investments, receivables, liabilities, payables, total: cash + investments + receivables - liabilities - payables };
}

// ---------------------------------------------------------------- goals
// Which accounts and holdings count towards a goal.
export function goalSources(goal, state) {
  const pick = (list, sel) => (Array.isArray(sel) ? list.filter((x) => sel.includes(x.id)) : list);
  const funding = goal.funding ?? 'both';
  return {
    accounts: funding === 'investments' ? [] : pick(state.accounts ?? [], goal.accounts),
    holdings: funding === 'savings' ? [] : pick(state.holdings ?? [], goal.holdings),
  };
}

// What makes up a goal's progress, in the goal's currency: the chosen accounts
// and/or investments, plus money people owe me (unless the goal excludes it),
// minus money I owe people.
export function goalBreakdown(goal, state) {
  const { rates } = state;
  const { accounts, holdings } = goalSources(goal, state);
  let base = 0;
  for (const a of accounts) base += toBase(a.balance, a.currency, rates);
  for (const h of holdings) base += holdingStats(h, rates).valueBase;
  const loans = loanTotals(state);
  const receivablesBase = goal.excludeReceivables ? 0 : loans.owedToMe;
  const conv = (v) => fromBase(v, goal.currency, rates);
  return {
    sources: conv(base),
    receivables: conv(receivablesBase),
    payables: conv(loans.iOwe),
    total: conv(base + receivablesBase - loans.iOwe),
  };
}

export function goalCurrent(goal, state) {
  return goalBreakdown(goal, state).total;
}

// How fast the goal is growing, in the goal's currency per month.
//  savings / both -> average monthly saving from transactions
//  investments    -> average monthly contributions to the goal's holdings
//  (both falls back to contributions when there are no transactions)
export function goalMonthlyRate(goal, state, now = new Date()) {
  const { rates } = state;
  let r = { avg: null, months: 0 };
  let basis = null;
  if (goal.funding !== 'investments') {
    r = averageMonthlySaving(state.transactions ?? [], rates, now);
    basis = 'savings';
  }
  if (r.avg == null && goal.funding !== 'savings') {
    r = averageMonthlyContributions(goalSources(goal, state).holdings, rates, now);
    basis = 'contributions';
  }
  return { ...r, basis: r.avg == null ? null : basis, avg: r.avg == null ? null : fromBase(r.avg, goal.currency, rates) };
}

/**
 * @param goal               { target, targetDate? }
 * @param current            amount saved so far (goal currency)
 * @param avgMonthlySaving   average saving per month (goal currency) or null
 */
export function goalPlan(goal, current, avgMonthlySaving, now = new Date()) {
  const target = Number(goal.target) || 0;
  const remaining = Math.max(0, target - current);
  const pct = target > 0 ? Math.min(1, Math.max(0, current / target)) : 0;
  const reached = target > 0 && remaining === 0;
  let monthsLeft = null;
  let requiredMonthly = null;
  let overdue = false;
  if (goal.targetDate && !reached) {
    monthsLeft = monthsBetween(now, parseDate(goal.targetDate));
    overdue = monthsLeft <= 0;
    requiredMonthly = overdue ? remaining : remaining / Math.max(1, monthsLeft);
  }
  let projectedDate = null;
  let monthsToGoal = null;
  if (!reached && avgMonthlySaving > 0) {
    monthsToGoal = remaining / avgMonthlySaving;
    projectedDate = isoDate(addMonthsToDate(now, monthsToGoal));
  }
  return { target, current, remaining, pct, reached, monthsLeft, requiredMonthly, overdue, projectedDate, monthsToGoal };
}

// ---------------------------------------------------------------- budgets
export function budgetStatus(state, key) {
  const { rates } = state;
  return (state.budgets ?? []).map((b) => {
    let spentBase = 0;
    for (const tx of state.transactions) {
      if (tx.type === 'expense' && tx.categoryId === b.categoryId && monthKey(tx.date) === key) spentBase += txBase(tx, rates);
    }
    const spent = fromBase(spentBase, b.currency, rates);
    const limit = Number(b.amount) || 0;
    const pct = limit > 0 ? spent / limit : 0;
    return { budget: b, spent, limit, pct, level: pct >= 1 ? 'over' : pct >= 0.8 ? 'warn' : 'ok' };
  });
}
