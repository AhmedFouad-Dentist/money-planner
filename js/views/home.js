import { h, card, progress } from '../ui.js';
import { icon } from '../icons.js';
import { t, money, pct, nameOf } from '../i18n.js';
import { netWorth, goalCurrent, goalPlan, monthSummary, monthKey, budgetStatus, fromBase, dueLoans, loanRemaining } from '../finance.js';
import { detectRecurring } from '../recurring.js';
import { S, fmtBase, txRow, sectionTitle, linkBtn, categoryById, backupDue } from './common.js';
import { go } from './shell.js';
import { openEntry } from './entry.js';
import { quickTextCard, addFromClipboard } from './quick.js';
import { openGoalEditor } from './goals.js';

export function homeView() {
  const st = S();
  const nw = netWorth(st);
  const key = monthKey(new Date());
  const month = monthSummary(st.transactions, st.rates, key);
  const goal = st.goals[0];

  const banners = [];
  if (backupDue(st)) {
    banners.push(h('button', { class: 'banner warn', type: 'button', onclick: () => go('backup') },
      h('strong', { text: t('home.backupDue') }), h('span', { text: t('home.backupDueSub') })));
  }
  for (const b of budgetStatus(st, key).filter((x) => x.level !== 'ok')) {
    const c = categoryById(b.budget.categoryId);
    banners.push(h('button', { class: `banner ${b.level === 'over' ? 'danger' : 'warn'}`, type: 'button', onclick: () => go('budgets') },
      h('strong', { text: t(b.level === 'over' ? 'budget.overShort' : 'budget.warnShort', { cat: `${c.icon} ${nameOf(c)}` }) }),
      h('span', { text: `${money(b.spent, b.budget.currency)} / ${money(b.limit, b.budget.currency)} (${pct(b.pct)})` })));
  }
  for (const d of dueLoans(st)) {
    banners.push(h('button', { class: `banner ${d.overdue ? 'danger' : 'warn'}`, type: 'button', onclick: () => go('loan', { id: d.loan.id }) },
      h('strong', { text: t(d.overdue ? 'home.loanOverdue' : 'home.loanDue', { name: d.loan.person, n: Math.abs(d.daysLeft) }) }),
      h('span', { text: `${t(d.loan.direction === 'lent' ? 'loans.theyOwe' : 'loans.iOweThem')}: ${money(loanRemaining(d.loan), d.loan.currency)}` })));
  }
  const handled = new Set([...st.recurring.confirmed.map((r) => r.key), ...st.recurring.dismissed]);
  const newRecurring = detectRecurring(st.transactions).filter((r) => !handled.has(r.key));
  if (newRecurring.length) {
    banners.push(h('button', { class: 'banner info', type: 'button', onclick: () => go('recurring') },
      h('strong', { text: t('home.recurringFound', { n: newRecurring.length }) }), h('span', { text: t('home.recurringSub') })));
  }

  let goalBlock;
  if (goal) {
    const current = goalCurrent(goal, st);
    const plan = goalPlan(goal, current, null);
    goalBlock = h('button', { class: 'hero-goal', type: 'button', onclick: () => go('goals') },
      h('div', { class: 'row between' },
        h('span', { class: 'muted', text: t('home.remainingTo', { goal: goal.name }) }),
        h('span', { class: 'pill', text: pct(plan.pct, plan.pct < 0.1 ? 1 : 0) })),
      h('div', { class: 'hero-sub-value', text: plan.reached ? t('goals.reached') : money(plan.remaining, goal.currency, { decimals: 0 }) }),
      progress(plan.pct, plan.reached ? 'good' : 'ok', goal.name),
      h('div', { class: 'muted small', text: `${money(current, goal.currency, { decimals: 0 })} / ${money(plan.target, goal.currency, { decimals: 0 })}` }));
  } else {
    goalBlock = h('button', { class: 'btn ghost block', type: 'button', onclick: () => openGoalEditor() }, t('goals.add'));
  }

  const hero = h('section', { class: 'card hero' },
    h('div', { class: 'muted', text: t('home.netWorth') }),
    h('div', { class: 'hero-value', text: fmtBase(nw.total, { decimals: 0 }) }),
    h('button', { class: 'hero-breakdown', type: 'button', onclick: () => go('networth') },
      h('span', {}, `${t('nw.cash')} ${fmtBase(nw.cash, { decimals: 0 })}`),
      h('span', {}, `${t('nw.investments')} ${fmtBase(nw.investments, { decimals: 0 })}`),
      nw.receivables > 0 && h('span', { class: 'pos' }, `${t('nw.receivables')} +${fmtBase(nw.receivables, { decimals: 0 })}`),
      nw.payables > 0 && h('span', { class: 'neg' }, `${t('nw.payables')} −${fmtBase(nw.payables, { decimals: 0 })}`),
      nw.liabilities > 0 && h('span', {}, `${t('nw.debts')} −${fmtBase(nw.liabilities, { decimals: 0 })}`)),
    h('hr'),
    goalBlock,
  );

  const rc = st.settings.reportCurrency;
  const tile = (label, value, cls = '') => h('div', { class: 'tile' }, h('span', { class: 'tile-label', text: label }), h('span', { class: `tile-value ${cls}`, text: value }));
  const monthCard = card(
    sectionTitle(t('home.thisMonth'), linkBtn(t('home.fullReport'), () => go('report'))),
    h('div', { class: 'tiles' },
      tile(t('report.income'), money(fromBase(month.income, rc, st.rates), rc, { decimals: 0 }), 'pos'),
      tile(t('report.spent'), money(fromBase(month.expense, rc, st.rates), rc, { decimals: 0 })),
      tile(t('report.saved'), money(fromBase(month.saved, rc, st.rates), rc, { decimals: 0 }), month.saved < 0 ? 'neg' : ''),
      tile(t('report.rate'), pct(month.savingsRate))),
  );

  const quick = h('div', { class: 'quick-actions' },
    h('button', { class: 'btn primary', type: 'button', onclick: () => openEntry({}) }, icon('plus', { size: 20 }), t('home.addTx')),
    h('button', { class: 'btn ghost', type: 'button', onclick: () => addFromClipboard() }, icon('clipboard', { size: 20 }), t('clip.button')));

  const recent = [...st.transactions].reverse().slice(0, 5);
  const recentCard = card(
    sectionTitle(t('home.recent'), st.transactions.length > 5 && linkBtn(t('home.seeAll'), () => go('tx'))),
    recent.length
      ? h('div', { class: 'list' }, recent.map((tx) => txRow(tx, () => openEntry({ tx }))))
      : h('p', { class: 'muted', text: t('home.noTx') }),
  );

  return { title: t('app.name'), body: [banners, hero, quick, quickTextCard(), monthCard, recentCard] };
}
