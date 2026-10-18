import { h, card, segmented, emptyState } from '../ui.js';
import { icon } from '../icons.js';
import { t, fmtDate, monthLabel, money, nameOf } from '../i18n.js';
import { monthKey, addMonths, monthSummary, fromBase } from '../finance.js';
import { rerender } from '../store.js';
import { S, txRow, categoryById } from './common.js';
import { openEntry, openSmsPaste } from './entry.js';

// Filters survive re-renders while the app is open.
const ui = { month: null, type: 'all', q: '' };

export function txView() {
  const st = S();
  ui.month ??= monthKey(new Date());
  const rc = st.settings.reportCurrency;
  const listWrap = h('div');

  function drawList() {
    const q = ui.q.trim().toLowerCase();
    const items = st.transactions
      .filter((tx) => monthKey(tx.date) === ui.month)
      .filter((tx) => ui.type === 'all' || tx.type === ui.type)
      .filter((tx) => !q || [tx.merchant, tx.note, nameOf(categoryById(tx.categoryId, tx.type))].some((v) => v && v.toLowerCase().includes(q)))
      .reverse();
    if (!items.length) {
      listWrap.replaceChildren(emptyState(t('tx.empty'), h('button', { class: 'btn primary', type: 'button', onclick: () => openEntry({}) }, t('home.addTx'))));
      return;
    }
    const groups = new Map();
    for (const tx of items) {
      if (!groups.has(tx.date)) groups.set(tx.date, []);
      groups.get(tx.date).push(tx);
    }
    listWrap.replaceChildren(...[...groups].map(([date, txs]) =>
      h('section', { class: 'card day-group' },
        h('h3', { class: 'day-title', text: fmtDate(date, { weekday: true }) }),
        h('div', { class: 'list' }, txs.map((tx) => txRow(tx, () => openEntry({ tx })))))));
  }

  const sum = monthSummary(st.transactions, st.rates, ui.month);
  const current = monthKey(new Date());
  const monthNav = h('div', { class: 'month-nav' },
    h('button', { class: 'icon-btn flip-rtl', type: 'button', 'aria-label': t('common.prevMonth'), onclick: () => { ui.month = addMonths(ui.month, -1); rerender(); } }, icon('back')),
    h('strong', { text: monthLabel(ui.month) }),
    h('button', { class: 'icon-btn flip-rtl', type: 'button', 'aria-label': t('common.nextMonth'), disabled: ui.month >= current, onclick: () => { ui.month = addMonths(ui.month, 1); rerender(); } }, icon('chevron')));

  const search = h('input', {
    type: 'search', class: 'search', value: ui.q, placeholder: t('tx.search'), 'aria-label': t('tx.search'), autocomplete: 'off',
    oninput: () => { ui.q = search.value; drawList(); },
  });

  drawList();
  return {
    title: t('tab.tx'),
    actions: [h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('home.pasteSms'), onclick: () => openSmsPaste() }, icon('sms', { size: 22 }))],
    body: [
      monthNav,
      card(h('div', { class: 'tiles three' },
        h('div', { class: 'tile' }, h('span', { class: 'tile-label', text: t('report.income') }), h('span', { class: 'tile-value pos', text: money(fromBase(sum.income, rc, st.rates), rc, { decimals: 0 }) })),
        h('div', { class: 'tile' }, h('span', { class: 'tile-label', text: t('report.spent') }), h('span', { class: 'tile-value', text: money(fromBase(sum.expense, rc, st.rates), rc, { decimals: 0 }) })),
        h('div', { class: 'tile' }, h('span', { class: 'tile-label', text: t('report.saved') }), h('span', { class: `tile-value ${sum.saved < 0 ? 'neg' : ''}`, text: money(fromBase(sum.saved, rc, st.rates), rc, { decimals: 0 }) })))),
      h('div', { class: 'filters' },
        search,
        segmented([{ value: 'all', label: t('tx.all') }, { value: 'expense', label: t('entry.expense') }, { value: 'income', label: t('entry.income') }], ui.type, (v) => { ui.type = v; drawList(); })),
      listWrap,
    ],
  };
}
