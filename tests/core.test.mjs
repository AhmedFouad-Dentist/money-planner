import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readTextFromHash } from '../js/sms/fragment.js';
import { createBackup, openBackup, deriveKey, encryptJSON, decryptJSON, randomBytes, toBase64, fromBase64 } from '../js/crypto.js';
import {
  convert, toBase, monthSummary, averageMonthlySaving, averageMonthlyContributions, holdingStats, netWorth, goalCurrent, goalPlan, goalMonthlyRate,
  budgetStatus, addMonths, loanRemaining, loanTotals, dueLoans, openLoansWith, goalBreakdown,
} from '../js/finance.js';
import { detectRecurring, merchantKey } from '../js/recurring.js';
import { suggestCategory } from '../js/categorize.js';
import { createInitialState, migrate, defaultCategories, newGoal, startingRates } from '../js/model.js';

const rates = { GBP: 1, QAR: 5, EGP: 60, USD: 1.25 };

test('URL fragment: sms/say last, optional from, decoding', () => {
  assert.deepEqual(readTextFromHash('#sms=Purchase%20of%20QAR%2010%20%26%20more'), { kind: 'sms', text: 'Purchase of QAR 10 & more', from: null });
  assert.deepEqual(readTextFromHash('#from=QNB&sms=a%20b'), { kind: 'sms', text: 'a b', from: 'QNB' });
  assert.deepEqual(readTextFromHash('#sms=raw text & stuff=1'), { kind: 'sms', text: 'raw text & stuff=1', from: null });
  assert.deepEqual(readTextFromHash('#sms=5% off'), { kind: 'sms', text: '5% off', from: null });
  assert.deepEqual(readTextFromHash('#sms=%2B974'), { kind: 'sms', text: '+974', from: null });
  assert.deepEqual(readTextFromHash('#say=' + encodeURIComponent('اشتريت قهوة بـ 15 ريال')), { kind: 'say', text: 'اشتريت قهوة بـ 15 ريال', from: null });
  assert.deepEqual(readTextFromHash('#say=spent 5 & sms= inside'), { kind: 'say', text: 'spent 5 & sms= inside', from: null });
  assert.equal(readTextFromHash('#home'), null);
  assert.equal(readTextFromHash('#smsx=1'), null);
  assert.equal(readTextFromHash(''), null);
});

test('AES-GCM round trip and wrong key fails', async () => {
  const salt = randomBytes(16);
  const k1 = await deriveKey('123456', salt, 1000);
  const k2 = await deriveKey('654321', salt, 1000);
  const box = await encryptJSON(k1, { hello: 'عالم', n: 1 });
  assert.deepEqual(await decryptJSON(k1, box), { hello: 'عالم', n: 1 });
  await assert.rejects(decryptJSON(k2, box));
  const tampered = { iv: box.iv, ct: box.ct.slice() };
  tampered.ct[0] ^= 1;
  await assert.rejects(decryptJSON(k1, tampered));
});

test('base64 helpers', () => {
  const b = randomBytes(60000);
  assert.deepEqual(fromBase64(toBase64(b)), b);
});

test('encrypted backup: create, open, wrong password, bad file', async () => {
  const state = createInitialState({ reportCurrency: 'EGP', goals: [{ name: 'Secret plan', target: 5000, currency: 'EGP' }] });
  const file = await createBackup(state, 'correct horse', 100_000);
  const text = JSON.stringify(file);
  assert.ok(!text.includes('Secret plan'), 'backup must not contain plaintext');
  assert.deepEqual(await openBackup(JSON.parse(text), 'correct horse'), state);
  await assert.rejects(openBackup(file, 'wrong'), (e) => e.code === 'password');
  await assert.rejects(openBackup({ format: 'x' }, 'p'), (e) => e.code === 'format');
});

test('currency conversion through GBP', () => {
  assert.equal(convert(500, 'QAR', 'GBP', rates), 100);
  assert.equal(convert(100, 'GBP', 'EGP', rates), 6000);
  assert.equal(convert(60, 'EGP', 'QAR', rates), 5);
  assert.equal(toBase(100, 'EGP', rates, 50), 2); // snapshot rate wins
});

const tx = (date, type, amount, currency, extra = {}) => ({ id: date + amount, date, type, amount, currency, categoryId: type === 'income' ? 'salary' : 'groceries', ...extra });

test('month summary and savings rate', () => {
  const txs = [tx('2026-10-01', 'income', 5000, 'QAR'), tx('2026-10-05', 'expense', 1000, 'QAR'), tx('2026-10-06', 'expense', 600, 'EGP', { categoryId: 'dining' }), tx('2026-09-30', 'expense', 50, 'GBP')];
  const s = monthSummary(txs, rates, '2026-10');
  assert.equal(s.income, 1000);
  assert.equal(s.expense, 210);
  assert.equal(s.saved, 790);
  assert.equal(s.savingsRate, 0.79);
  assert.deepEqual(s.byCategory.map((c) => c.categoryId), ['groceries', 'dining']);
});

test('average monthly saving uses complete months only', () => {
  const now = new Date(2026, 9, 18);
  const txs = [
    tx('2026-08-01', 'income', 1000, 'GBP'), tx('2026-08-10', 'expense', 400, 'GBP'),
    tx('2026-09-01', 'income', 1000, 'GBP'), tx('2026-09-10', 'expense', 200, 'GBP'),
    tx('2026-10-01', 'income', 99999, 'GBP'),
  ];
  assert.deepEqual(averageMonthlySaving(txs, rates, now), { avg: 700, months: 2 });
  assert.deepEqual(averageMonthlySaving([tx('2026-10-01', 'income', 300, 'GBP')], rates, now), { avg: 300, months: 1, partial: true });
  assert.deepEqual(averageMonthlySaving([], rates, now), { avg: null, months: 0 });
});

test('holding gain/loss with contributions in other currencies', () => {
  const h = {
    currency: 'EGP',
    contributions: [
      { amount: 60000, currency: 'EGP', rate: 60, hRate: 60 },
      { amount: 100, currency: 'GBP', rate: 1, hRate: 50 }, // 5000 EGP at the time
    ],
    values: [{ date: '2026-09-01', value: 70000 }, { date: '2026-10-01', value: 77000 }],
  };
  const s = holdingStats(h, rates);
  assert.equal(s.contributedNative, 65000);
  assert.equal(s.valueNative, 77000);
  assert.equal(s.gainNative, 12000);
  assert.ok(Math.abs(s.gainPctNative - 12000 / 65000) < 1e-9);
  assert.equal(s.contributedBase, 1100);
  assert.ok(Math.abs(s.valueBase - 77000 / 60) < 1e-9);
  const empty = holdingStats({ currency: 'GBP', contributions: [{ amount: 10, currency: 'GBP' }], values: [] }, rates);
  assert.equal(empty.gainNative, 0);
});

test('net worth and goal progress by funding source, in the goal currency', () => {
  const state = {
    ...createInitialState({ reportCurrency: 'GBP' }),
    rates,
    accounts: [{ id: 'a1', balance: 5000, currency: 'QAR' }, { id: 'a2', balance: 500, currency: 'GBP' }],
    liabilities: [{ id: 'l1', amount: 6000, currency: 'EGP' }],
    holdings: [
      { id: 'h1', currency: 'GBP', contributions: [{ amount: 1000, currency: 'GBP', date: '2026-08-01' }], values: [{ date: '2026-10-01', value: 1200 }] },
      { id: 'h2', currency: 'USD', contributions: [{ amount: 125, currency: 'USD', date: '2026-09-01' }], values: [] },
    ],
  };
  assert.deepEqual(netWorth(state), { cash: 1500, investments: 1300, receivables: 0, liabilities: 100, payables: 0, total: 2700 });
  const g = (o) => newGoal({ target: 1000, currency: 'QAR', ...o });
  assert.equal(goalCurrent(g({ funding: 'savings' }), state), 7500); // 1500 GBP in QAR
  assert.equal(goalCurrent(g({ funding: 'investments' }), state), 6500);
  assert.equal(goalCurrent(g({ funding: 'both' }), state), 14000);
  assert.equal(goalCurrent(g({ funding: 'both', accounts: ['a2'], holdings: ['h1'] }), state), 8500);
  assert.equal(goalCurrent(g({ funding: 'savings', accounts: [] }), state), 0);
  assert.equal(goalCurrent(g({ funding: 'investments', currency: 'EGP', holdings: ['h2'] }), state), 6000);
});

test('goal monthly rate depends on funding', () => {
  const now = new Date(2026, 9, 18);
  const state = {
    rates,
    transactions: [tx('2026-09-01', 'income', 1000, 'GBP'), tx('2026-09-10', 'expense', 400, 'GBP')],
    accounts: [],
    holdings: [{ id: 'h1', currency: 'GBP', contributions: [{ amount: 300, currency: 'GBP', date: '2026-09-05' }] }],
  };
  assert.deepEqual(goalMonthlyRate(newGoal({ currency: 'QAR', funding: 'savings' }), state, now), { avg: 3000, months: 1, basis: 'savings' });
  assert.deepEqual(goalMonthlyRate(newGoal({ currency: 'GBP', funding: 'investments' }), state, now), { avg: 300, months: 1, basis: 'contributions' });
  assert.equal(goalMonthlyRate(newGoal({ currency: 'GBP', funding: 'both' }), { ...state, transactions: [] }, now).basis, 'contributions');
  assert.deepEqual(averageMonthlyContributions([], rates, now), { avg: null, months: 0 });
});

test('goal plan: required monthly and projected date', () => {
  const now = new Date(2026, 9, 1);
  const plan = goalPlan({ target: 50000, targetDate: '2028-10-01' }, 2000, 1000, now);
  assert.equal(plan.remaining, 48000);
  assert.equal(plan.pct, 0.04);
  assert.ok(Math.abs(plan.monthsLeft - 24) < 0.1);
  assert.ok(Math.abs(plan.requiredMonthly - 2000) < 10);
  assert.equal(plan.monthsToGoal, 48);
  assert.equal(plan.projectedDate.slice(0, 7), '2030-10');
  const reached = goalPlan({ target: 100 }, 150, 10, now);
  assert.equal(reached.reached, true);
  assert.equal(reached.projectedDate, null);
  assert.equal(goalPlan({ target: 100 }, 0, -5, now).projectedDate, null);
  assert.equal(goalPlan({ target: 100, targetDate: '2026-01-01' }, 0, 0, now).overdue, true);
});

test('budget warning levels at 80% and 100%', () => {
  const state = {
    rates,
    budgets: [{ id: 'b1', categoryId: 'groceries', amount: 100, currency: 'GBP' }, { id: 'b2', categoryId: 'dining', amount: 100, currency: 'GBP' }, { id: 'b3', categoryId: 'travel', amount: 100, currency: 'GBP' }],
    transactions: [tx('2026-10-01', 'expense', 400, 'QAR'), tx('2026-10-02', 'expense', 6000, 'EGP', { categoryId: 'dining' }), tx('2026-10-02', 'expense', 10, 'GBP', { categoryId: 'travel' }), tx('2026-09-02', 'expense', 999, 'GBP', { categoryId: 'travel' })],
  };
  const st = budgetStatus(state, '2026-10');
  assert.deepEqual(st.map((s) => s.level), ['warn', 'over', 'ok']);
  assert.equal(st[0].spent, 80);
});

test('recurring detection: monthly, similar amount, same merchant', () => {
  const txs = [
    tx('2026-07-03', 'expense', 49.99, 'QAR', { merchant: 'FAKEFLIX' }),
    tx('2026-08-03', 'expense', 49.99, 'QAR', { merchant: 'FAKEFLIX' }),
    tx('2026-09-02', 'expense', 52, 'QAR', { merchant: 'Fakeflix ' }),
    tx('2026-10-03', 'expense', 49.99, 'QAR', { merchant: 'FAKEFLIX*1234' }),
    // weekly groceries: not monthly
    ...['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22'].map((d) => tx(d, 'expense', 200, 'QAR', { merchant: 'FAKE MART' })),
    // monthly but wildly different amounts
    ...['2026-07-10', '2026-08-10', '2026-09-10'].map((d, i) => tx(d, 'expense', [10, 300, 75][i], 'QAR', { merchant: 'FAKE SHOP' })),
    // only twice
    tx('2026-08-20', 'expense', 30, 'QAR', { merchant: 'FAKE GYM' }), tx('2026-09-20', 'expense', 30, 'QAR', { merchant: 'FAKE GYM' }),
  ];
  const r = detectRecurring(txs);
  assert.equal(r.length, 1);
  assert.equal(r[0].key, 'fakeflix|QAR');
  assert.equal(r[0].count, 4);
  assert.equal(r[0].amount, 49.99);
  assert.equal(r[0].nextDate.slice(0, 7), '2026-11');
  assert.equal(merchantKey('FAKEFLIX*1234'), 'fakeflix');
});

test('category suggestion: history first, then hints', () => {
  const cats = defaultCategories();
  const history = [tx('2026-10-01', 'expense', 10, 'QAR', { merchant: 'Carrefour City', categoryId: 'family' })];
  assert.equal(suggestCategory('CARREFOUR CITY', 'expense', history, cats), 'family');
  assert.equal(suggestCategory('CARREFOUR MALL', 'expense', history, cats), 'groceries');
  assert.equal(suggestCategory('UBER TRIP', 'expense', [], cats), 'transport');
  assert.equal(suggestCategory('Unknown place', 'expense', [], cats), null);
});

test('initial state uses the chosen main currency and the user\'s own goals', () => {
  const s = createInitialState({ currencies: ['QAR', 'EGP'], reportCurrency: 'EGP', defaultCurrency: 'QAR', lang: 'ar' });
  assert.deepEqual(s.settings.currencies, ['QAR', 'EGP']);
  assert.equal(s.settings.reportCurrency, 'EGP');
  assert.equal(s.settings.baseCurrency, 'EGP');
  assert.equal(s.rates.EGP, 1);
  assert.ok(s.rates.QAR > 0 && s.rates.QAR < 1);
  assert.deepEqual(s.goals, []);
  const g = createInitialState({ reportCurrency: 'USD', goals: [{ name: 'House', target: 20000, currency: 'USD', funding: 'investments', targetDate: '2030-01-01' }] }).goals[0];
  assert.deepEqual([g.name, g.target, g.currency, g.funding, g.accounts, g.holdings, g.targetDate, g.excludeReceivables], ['House', 20000, 'USD', 'investments', 'all', 'all', '2030-01-01', false]);
  const r = startingRates('QAR', ['QAR', 'USD', 'XYZ']);
  assert.equal(r.QAR, 1);
  assert.ok(Math.abs(r.USD - 1 / 3.64) < 1e-9);
  assert.equal(r.XYZ, undefined);
});

test('migration fills gaps', () => {
  const m = migrate({
    settings: { lang: 'ar', currencies: ['EGP'], reportCurrency: 'EGP' },
    transactions: [tx('2026-10-01', 'income', 1, 'EGP')],
    categories: [{ id: 'x', type: 'expense', names: { en: 'X', ar: 'X' } }],
    goals: [{ name: 'Old', target: 10 }],
  });
  assert.equal(m.settings.lang, 'ar');
  assert.equal(m.settings.baseCurrency, 'EGP');
  assert.ok(m.categories.some((c) => c.id === 'other-expense'));
  assert.equal(m.transactions.length, 1);
  assert.equal(m.goals[0].currency, 'EGP');
  assert.equal(m.goals[0].funding, 'both');
  assert.equal(addMonths('2026-12', 1), '2027-01');
});

test('personal loans: remaining, totals per person, due dates', () => {
  const state = {
    rates,
    loans: [
      { id: 'l1', person: 'Ahmed', direction: 'lent', amount: 500, currency: 'QAR', date: '2026-09-01', dueDate: '2026-10-20', repayments: [{ amount: 200, date: '2026-10-01' }] },
      { id: 'l2', person: 'ahmed ', direction: 'borrowed', amount: 50, currency: 'GBP', date: '2026-09-05', repayments: [] },
      { id: 'l3', person: 'محمد', direction: 'borrowed', amount: 6000, currency: 'EGP', date: '2026-08-01', dueDate: '2026-10-01', repayments: [] },
      { id: 'l4', person: 'Sara', direction: 'lent', amount: 100, currency: 'GBP', date: '2026-07-01', repayments: [], settledAt: '2026-08-01' },
      { id: 'l5', person: 'أحمد', direction: 'lent', amount: 100, currency: 'GBP', date: '2026-07-01', repayments: [{ amount: 150, date: '2026-08-01' }] },
    ],
  };
  assert.equal(loanRemaining(state.loans[0]), 300);
  assert.equal(loanRemaining(state.loans[3]), 0); // settled
  assert.equal(loanRemaining(state.loans[4]), 0); // over-repaid never goes negative
  const t = loanTotals(state);
  assert.equal(t.owedToMe, 60); // 300 QAR
  assert.equal(t.iOwe, 150); // 50 GBP + 6000 EGP
  const ahmed = t.people.find((p) => p.key === 'ahmed');
  assert.equal(ahmed.net, 10); // owes me 60, I owe him 50
  assert.equal(ahmed.loans.length, 2);
  const due = dueLoans(state, new Date(2026, 9, 18));
  assert.deepEqual(due.map((d) => [d.loan.id, d.daysLeft, d.overdue]), [['l3', -17, true], ['l1', 2, false]]);
  assert.deepEqual(openLoansWith(state, 'AHMED', 'lent').map((l) => l.id), ['l1']);
  assert.deepEqual(openLoansWith(state, 'احمد').map((l) => l.id), []); // أحمد's loan is fully repaid
});

test('loans in net worth and goal progress, with receivables toggle', () => {
  const state = {
    ...createInitialState({ reportCurrency: 'GBP' }),
    rates,
    accounts: [{ id: 'a1', balance: 1000, currency: 'GBP' }],
    loans: [
      { id: 'l1', person: 'A', direction: 'lent', amount: 300, currency: 'GBP', date: '2026-09-01', repayments: [] },
      { id: 'l2', person: 'B', direction: 'borrowed', amount: 100, currency: 'GBP', date: '2026-09-01', repayments: [] },
    ],
  };
  const nw = netWorth(state);
  assert.equal(nw.receivables, 300);
  assert.equal(nw.payables, 100);
  assert.equal(nw.total, 1200);
  const g = newGoal({ target: 5000, currency: 'QAR', funding: 'savings' });
  assert.deepEqual(goalBreakdown(g, state), { sources: 5000, receivables: 1500, payables: 500, total: 6000 });
  assert.equal(goalCurrent({ ...g, excludeReceivables: true }, state), 4500);
});
