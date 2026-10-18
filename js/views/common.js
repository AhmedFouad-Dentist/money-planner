// Small helpers shared by the screens.

import { h, listRow, toast } from '../ui.js';
import { t, money, fmtDate, nameOf } from '../i18n.js';
import { store, update } from '../store.js';
import { fromBase, budgetStatus, monthKey, isoDate } from '../finance.js';
import { OTHER_CATEGORY } from '../model.js';

export const S = () => store.state;
export const reportCcy = () => S().settings.reportCurrency;
export const fmtBase = (base, opts) => money(fromBase(base, reportCcy(), S().rates), reportCcy(), opts);
export const today = () => isoDate(new Date());

export function categoryById(id, type = 'expense') {
  const cats = S().categories;
  return cats.find((c) => c.id === id) ?? cats.find((c) => c.id === OTHER_CATEGORY[type]);
}

export const currencies = () => S().settings.currencies;
export const currencyOptions = (extra) =>
  [...new Set([...currencies(), ...(extra ? [extra] : [])])].map((c) => ({ value: c, label: c }));

export function txRow(tx, onClick) {
  const c = categoryById(tx.categoryId, tx.type);
  const sub = [nameOf(c), tx.note].filter(Boolean).join(' · ');
  return listRow({
    icon: c?.icon ?? '•',
    title: tx.merchant || nameOf(c),
    subtitle: tx.merchant ? sub : tx.note || fmtDate(tx.date),
    value: money(tx.type === 'income' ? tx.amount : -tx.amount, tx.currency, { signed: true }),
    valueClass: tx.type === 'income' ? 'pos' : '',
    onClick,
  });
}

export function sectionTitle(text, action) {
  return h('div', { class: 'section-title' }, h('h2', { text }), action);
}

export function linkBtn(label, onClick) {
  return h('button', { class: 'link-btn', type: 'button', onclick: onClick }, label);
}

// Warn once per month and budget when spending crosses 80% and 100%.
export function checkBudgetAlert(tx) {
  if (tx.type !== 'expense') return;
  const key = monthKey(tx.date);
  if (key !== monthKey(new Date())) return;
  const st = S();
  for (const b of budgetStatus(st, key)) {
    if (b.budget.categoryId !== tx.categoryId) continue;
    const level = b.level === 'over' ? 100 : b.level === 'warn' ? 80 : 0;
    const alertKey = `${key}:${b.budget.id}`;
    if (level && (st.alerts[alertKey] ?? 0) < level) {
      update((s) => (s.alerts[alertKey] = level), { render: false });
      const c = categoryById(b.budget.categoryId);
      toast(t(level === 100 ? 'budget.alertOver' : 'budget.alert80', { cat: nameOf(c), pct: Math.round(b.pct * 100) }), { kind: level === 100 ? 'error' : 'warn', ms: 5000 });
    }
  }
}

export function backupDue(st = S()) {
  const days = st.settings.backupReminderDays;
  if (!days) return false;
  const hasData = st.transactions.length + st.holdings.length + st.accounts.length > 0;
  if (!hasData) return false;
  const last = st.settings.lastBackupAt ? new Date(st.settings.lastBackupAt).getTime() : new Date(st.createdAt).getTime();
  return Date.now() - last > days * 86_400_000;
}
