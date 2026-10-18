import { h, card, progress } from '../ui.js';
import { icon } from '../icons.js';
import { t, money, pct, monthLabel, nameOf } from '../i18n.js';
import { monthKey, addMonths, monthSummary, fromBase, budgetStatus, goalCurrent, goalPlan, toBase } from '../finance.js';
import { barChart, donutChart } from '../charts.js';
import { rerender } from '../store.js';
import { S, categoryById, sectionTitle } from './common.js';

const ui = { month: null };

export function reportView() {
  const st = S();
  const rc = st.settings.reportCurrency;
  const fmt = (base, d = 0) => money(fromBase(base, rc, st.rates), rc, { decimals: d });
  const current = monthKey(new Date());
  ui.month ??= current;
  const key = ui.month;
  const sum = monthSummary(st.transactions, st.rates, key);

  const monthNav = h('div', { class: 'month-nav' },
    h('button', { class: 'icon-btn flip-rtl', type: 'button', 'aria-label': t('common.prevMonth'), onclick: () => { ui.month = addMonths(ui.month, -1); rerender(); } }, icon('back')),
    h('strong', { text: monthLabel(key) }),
    h('button', { class: 'icon-btn flip-rtl', type: 'button', 'aria-label': t('common.nextMonth'), disabled: key >= current, onclick: () => { ui.month = addMonths(ui.month, 1); rerender(); } }, icon('chevron')));

  const tile = (label, value, cls = '') => h('div', { class: 'tile' }, h('span', { class: 'tile-label', text: label }), h('span', { class: `tile-value ${cls}`, text: value }));
  const kpis = card(h('div', { class: 'tiles' },
    tile(t('report.income'), fmt(sum.income), 'pos'),
    tile(t('report.spent'), fmt(sum.expense)),
    tile(t('report.saved'), fmt(sum.saved), sum.saved < 0 ? 'neg' : ''),
    tile(t('report.rate'), pct(sum.savingsRate))));

  // last 6 months
  const months = [];
  for (let i = 5; i >= 0; i--) months.push(addMonths(key, -i));
  const data = months.map((k) => {
    const m = monthSummary(st.transactions, st.rates, k);
    return { key: k, label: monthLabel(k, { short: true }), values: { income: fromBase(m.income, rc, st.rates), expense: fromBase(m.expense, rc, st.rates) } };
  });
  const bars = card(
    sectionTitle(t('report.sixMonths')),
    barChart({
      data,
      series: [{ key: 'income', label: t('report.income'), cls: 's1' }, { key: 'expense', label: t('report.spent'), cls: 's2' }],
      format: (v) => money(v, rc, { decimals: 0 }),
      caption: t('report.tapBar'),
      title: t('report.sixMonths'),
    }));

  // top categories: 5 + other
  const cats = sum.byCategory;
  const top = cats.slice(0, 5).map((c) => {
    const cat = categoryById(c.categoryId);
    return { label: nameOf(cat), icon: cat.icon, value: fromBase(c.amount, rc, st.rates), color: cat.color ?? '#898781' };
  });
  const restTotal = cats.slice(5).reduce((a, b) => a + b.amount, 0);
  if (restTotal > 0) top.push({ label: t('report.otherCats'), icon: '•', value: fromBase(restTotal, rc, st.rates), color: '#898781' });
  const catCard = card(
    sectionTitle(t('report.topCategories')),
    top.length
      ? donutChart({ items: top, format: (v) => money(v, rc, { decimals: 0 }), centerLabel: t('report.spent'), centerValue: money(fromBase(sum.expense, rc, st.rates), rc, { decimals: 0 }), title: t('report.topCategories') })
      : h('p', { class: 'muted', text: t('report.noSpending') }));

  // goals: progress now, and net-worth change during the month
  const snap = st.snapshots?.[key];
  const prevSnap = st.snapshots?.[addMonths(key, -1)];
  const goalsCard = st.goals.length && card(
    sectionTitle(t('report.goalProgress')),
    st.goals.map((g) => {
      const cur = goalCurrent(g, st);
      const plan = goalPlan(g, cur, null);
      return h('div', { class: 'goal-mini' },
        h('div', { class: 'row between' }, h('strong', { text: g.name }), h('span', { text: pct(plan.pct, 1) })),
        progress(plan.pct, plan.reached ? 'good' : 'ok', g.name),
        h('div', { class: 'muted small', text: `${money(cur, g.currency, { decimals: 0 })} / ${money(plan.target, g.currency, { decimals: 0 })}` }));
    }),
    sum.saved > 0 && st.goals[0] && h('p', { class: 'small', text: t('report.savedTowards', { amount: money(fromBase(sum.saved, st.goals[0].currency, st.rates), st.goals[0].currency, { decimals: 0 }), pct: pct(fromBase(sum.saved, st.goals[0].currency, st.rates) / st.goals[0].target, 1) }) }),
    snap && prevSnap && h('p', { class: 'muted small', text: t('report.nwChange', { amount: money(fromBase(snap.nw - prevSnap.nw, rc, st.rates), rc, { decimals: 0, signed: true }) }) }),
  );

  // budgets
  const bs = budgetStatus(st, key);
  const budgetCard = bs.length > 0 && card(
    sectionTitle(t('more.budgets')),
    bs.map((b) => {
      const c = categoryById(b.budget.categoryId);
      return h('div', { class: 'goal-mini' },
        h('div', { class: 'row between' }, h('span', { text: `${c.icon} ${nameOf(c)}` }), h('span', { class: 'small', text: `${money(b.spent, b.budget.currency, { decimals: 0 })} / ${money(b.limit, b.budget.currency, { decimals: 0 })}` })),
        progress(b.pct, b.level, nameOf(c)));
    }));

  // subscriptions
  const subsBase = st.recurring.confirmed.reduce((a, r) => a + toBase(r.amount, r.currency, st.rates), 0);
  const subsCard = st.recurring.confirmed.length > 0 && card(
    h('div', { class: 'row between' }, h('span', { text: t('report.subscriptions') }), h('strong', { text: `${fmt(subsBase)} ${t('report.perMonth')}` })));

  return { title: t('more.report'), body: [monthNav, kpis, bars, catCard, goalsCard, budgetCard, subsCard] };
}
