// "More" menu and its sub-screens: budgets, subscriptions, accounts & debts,
// categories, currencies, backup, settings, about.

import { h, card, openSheet, field, segmented, select, numberInput, readNumber, toast, confirmDialog, emptyState, listRow, progress } from '../ui.js';
import { t, money, pct, fmtDate, nameOf, getLang, setLang, applyTheme } from '../i18n.js';
import { store, update, flushSave, rerender } from '../store.js';
import { uid, migrate, OTHER_CATEGORY, PALETTE } from '../model.js';
import { budgetStatus, monthKey, netWorth, toBase, dueLoans } from '../finance.js';
import { detectRecurring } from '../recurring.js';
import { fetchRates, RATES_URL_BASE } from '../rates.js';
import { createBackup, openBackup } from '../crypto.js';
import { requestPersistence, isPersisted } from '../db.js';
import * as vault from '../vault.js';
import { APP_VERSION } from '../version.js';
import { S, today, fmtBase, currencyOptions, sectionTitle, categoryById, backupDue } from './common.js';
import { go } from './shell.js';

const REPO_URL = 'https://github.com/AhmedFouad-Dentist/money-planner';

// Things that need attention; shown at the top of "More" and as a badge on its tab.
export function moreAlerts(st) {
  const out = [];
  if (backupDue(st)) out.push({ kind: 'warn', text: t('home.backupDue'), route: 'backup' });
  for (const d of dueLoans(st)) {
    out.push({ kind: d.overdue ? 'danger' : 'warn', text: t(d.overdue ? 'home.loanOverdue' : 'home.loanDue', { name: d.loan.person, n: Math.abs(d.daysLeft) }), route: 'loan', params: { id: d.loan.id } });
  }
  for (const b of budgetStatus(st, monthKey(new Date())).filter((x) => x.level !== 'ok')) {
    const c = categoryById(b.budget.categoryId);
    out.push({ kind: b.level === 'over' ? 'danger' : 'warn', text: t(b.level === 'over' ? 'budget.overShort' : 'budget.warnShort', { cat: `${c.icon} ${nameOf(c)}` }), route: 'budgets' });
  }
  const handled = new Set([...st.recurring.confirmed.map((r) => r.key), ...st.recurring.dismissed]);
  const found = detectRecurring(st.transactions).filter((r) => !handled.has(r.key)).length;
  if (found) out.push({ kind: 'info', text: t('home.recurringFound', { n: found }), route: 'recurring' });
  return out;
}

export function moreView() {
  const st = S();
  const item = (ic, key, route, sub) => listRow({ icon: ic, title: t(key), subtitle: sub, onClick: () => go(route), chevron: true });
  const nw = netWorth(st);
  return {
    title: t('tab.more'),
    body: [
      moreAlerts(st).map((a) => h('button', { class: `banner ${a.kind}`, type: 'button', onclick: () => go(a.route, a.params) }, h('strong', { text: a.text }))),
      h('section', { class: 'card' }, h('div', { class: 'list big-list' },
        item('🎯', 'tab.goals', 'goals'),
        item('💰', 'more.networth', 'networth', fmtBase(nw.total, { decimals: 0 })),
        item('📈', 'tab.invest', 'invest'),
        item('🤝', 'more.loans', 'loans'),
        item('📊', 'more.report', 'report'),
        item('🧾', 'more.budgets', 'budgets'),
        item('🔁', 'more.recurring', 'recurring'))),
      h('section', { class: 'card' }, h('div', { class: 'list big-list' },
        item('🎙️', 'more.connect', 'connect'),
        item('💾', 'more.backup', 'backup'),
        item('🏷️', 'more.categories', 'categories'),
        item('💱', 'more.rates', 'rates'),
        item('⚙️', 'more.settings', 'settings'),
        item('🔒', 'more.about', 'about'))),
    ],
  };
}

// ---------------------------------------------------------------- budgets
export function budgetsView() {
  const st = S();
  const key = monthKey(new Date());
  const rows = budgetStatus(st, key);
  return {
    title: t('more.budgets'),
    body: [
      h('p', { class: 'muted small', text: t('budget.intro') }),
      rows.length
        ? card(rows.map((b) => {
          const c = categoryById(b.budget.categoryId);
          return h('button', { class: 'budget-row', type: 'button', onclick: () => openBudgetEditor(b.budget) },
            h('div', { class: 'row between' },
              h('span', { text: `${c.icon} ${nameOf(c)}` }),
              h('span', { class: `small ${b.level === 'over' ? 'neg' : b.level === 'warn' ? 'warn-text' : ''}`, text: `${money(b.spent, b.budget.currency, { decimals: 0 })} / ${money(b.limit, b.budget.currency, { decimals: 0 })}` })),
            progress(b.pct, b.level, nameOf(c)),
            b.level !== 'ok' && h('span', { class: `small ${b.level === 'over' ? 'neg' : 'warn-text'}`, text: b.level === 'over' ? `⚠︎ ${t('budget.over')} (${pct(b.pct)})` : `⚠︎ ${t('budget.near')} (${pct(b.pct)})` }));
        }))
        : emptyState(t('budget.empty')),
      h('button', { class: 'btn primary block', type: 'button', onclick: () => openBudgetEditor() }, t('budget.add')),
    ],
  };
}

function openBudgetEditor(budget) {
  const st = S();
  const used = new Set(st.budgets.filter((b) => b.id !== budget?.id).map((b) => b.categoryId));
  const cats = st.categories.filter((c) => c.type === 'expense' && !c.archived && !used.has(c.id));
  if (!cats.length) return toast(t('budget.allSet'), { kind: 'info' });
  const d = budget ? { ...budget } : { id: uid(), categoryId: cats[0].id, amount: '', currency: st.settings.defaultCurrency };
  const cat = select(cats.map((c) => ({ value: c.id, label: `${c.icon} ${nameOf(c)}` })), d.categoryId, (v) => (d.categoryId = v));
  const amount = numberInput(d.amount === '' ? '' : String(d.amount), { placeholder: '0' });
  const ccy = select(currencyOptions(d.currency), d.currency, (v) => (d.currency = v));
  const sheet = openSheet({
    title: budget ? t('budget.edit') : t('budget.add'),
    body: [
      field(t('entry.category'), cat),
      h('div', { class: 'row gap' }, field(t('budget.monthly'), amount), field(t('entry.currency'), ccy)),
      h('div', { class: 'sheet-footer' },
        budget && h('button', { class: 'btn danger ghost', type: 'button', onclick: () => { update((s) => (s.budgets = s.budgets.filter((b) => b.id !== budget.id))); sheet.close(); } }, t('common.delete')),
        h('button', {
          class: 'btn primary grow', type: 'button',
          onclick: () => {
            d.amount = readNumber(amount.value);
            if (!(d.amount > 0)) return toast(t('entry.needAmount'), { kind: 'warn' });
            update((s) => {
              const i = s.budgets.findIndex((b) => b.id === d.id);
              if (i >= 0) s.budgets[i] = d;
              else s.budgets.push(d);
            });
            sheet.close();
          },
        }, t('common.save'))),
    ],
  });
}

// ---------------------------------------------------------------- recurring
export function recurringView() {
  const st = S();
  const found = detectRecurring(st.transactions);
  const confirmed = new Map(st.recurring.confirmed.map((r) => [r.key, r]));
  const dismissed = new Set(st.recurring.dismissed);
  const candidates = found.filter((r) => !confirmed.has(r.key) && !dismissed.has(r.key));
  const latest = new Map(found.map((r) => [r.key, r]));
  const totalBase = st.recurring.confirmed.reduce((a, r) => a + toBase(latest.get(r.key)?.amount ?? r.amount, r.currency, st.rates), 0);

  return {
    title: t('more.recurring'),
    body: [
      h('p', { class: 'muted small', text: t('rec.intro') }),
      candidates.length > 0 && sectionTitle(t('rec.found')),
      candidates.map((r) => h('section', { class: 'card' },
        h('div', { class: 'row between' }, h('strong', { text: r.merchant }), h('strong', { text: money(r.amount, r.currency) })),
        h('p', { class: 'muted small', text: t('rec.detail', { days: r.intervalDays, n: r.count, next: fmtDate(r.nextDate) }) }),
        h('div', { class: 'row gap' },
          h('button', { class: 'btn ghost grow', type: 'button', onclick: () => update((s) => s.recurring.dismissed.push(r.key)) }, t('rec.dismiss')),
          h('button', { class: 'btn primary grow', type: 'button', onclick: () => update((s) => s.recurring.confirmed.push({ id: uid(), key: r.key, merchant: r.merchant, amount: r.amount, currency: r.currency, categoryId: r.categoryId, intervalDays: r.intervalDays, lastDate: r.lastDate })) }, t('rec.confirm'))))),
      sectionTitle(t('rec.confirmed')),
      st.recurring.confirmed.length
        ? card(
          h('div', { class: 'list' }, st.recurring.confirmed.map((r) => {
            const live = latest.get(r.key);
            return listRow({
              title: r.merchant,
              subtitle: live ? t('rec.next', { date: fmtDate(live.nextDate) }) : t('rec.last', { date: fmtDate(r.lastDate) }),
              value: money(live?.amount ?? r.amount, r.currency),
              onClick: async () => {
                if (await confirmDialog({ title: r.merchant, message: t('rec.removeMsg'), ok: t('rec.remove'), cancel: t('common.cancel') })) {
                  update((s) => (s.recurring.confirmed = s.recurring.confirmed.filter((x) => x.id !== r.id)));
                }
              },
            });
          })),
          h('div', { class: 'row between total-row' }, h('span', { text: t('rec.total') }), h('strong', { text: `${fmtBase(totalBase, { decimals: 0 })} ${t('report.perMonth')}` })))
        : h('p', { class: 'muted', text: t('rec.none') }),
      st.recurring.dismissed.length > 0 && h('button', { class: 'link-btn', type: 'button', onclick: () => update((s) => (s.recurring.dismissed = [])) }, t('rec.resetDismissed')),
    ],
  };
}

// ---------------------------------------------------------------- net worth
export function netWorthView() {
  const st = S();
  const nw = netWorth(st);
  const row = (x, amountKey, kind) => listRow({
    title: x.name,
    subtitle: x.updatedAt ? t('nw.updated', { date: fmtDate(x.updatedAt) }) : null,
    value: money(kind === 'liabilities' ? -x[amountKey] : x[amountKey], x.currency, { decimals: 0 }),
    valueClass: kind === 'liabilities' ? 'neg' : '',
    onClick: () => openMoneyItemEditor(kind, x),
  });
  return {
    title: t('more.networth'),
    body: [
      h('section', { class: 'card hero' },
        h('div', { class: 'muted', text: t('home.netWorth') }),
        h('div', { class: 'hero-value', text: fmtBase(nw.total, { decimals: 0 }) }),
        h('div', { class: 'tiles' },
          h('div', { class: 'tile' }, h('span', { class: 'tile-label', text: t('nw.cash') }), h('span', { class: 'tile-value', text: fmtBase(nw.cash, { decimals: 0 }) })),
          h('div', { class: 'tile' }, h('span', { class: 'tile-label', text: t('nw.investments') }), h('span', { class: 'tile-value', text: fmtBase(nw.investments, { decimals: 0 }) })),
          h('div', { class: 'tile' }, h('span', { class: 'tile-label', text: t('nw.receivables') }), h('span', { class: 'tile-value pos', text: fmtBase(nw.receivables, { decimals: 0 }) })),
          h('div', { class: 'tile' }, h('span', { class: 'tile-label', text: t('nw.allDebts') }), h('span', { class: 'tile-value neg', text: fmtBase(-(nw.liabilities + nw.payables), { decimals: 0 }) })))),
      h('p', { class: 'muted small', text: t('nw.intro') }),
      card(sectionTitle(t('nw.accounts'), h('button', { class: 'link-btn', type: 'button', onclick: () => openMoneyItemEditor('accounts') }, t('common.add'))),
        st.accounts.length ? h('div', { class: 'list' }, st.accounts.map((a) => row(a, 'balance', 'accounts'))) : h('p', { class: 'muted', text: t('nw.noAccounts') })),
      card(sectionTitle(t('nw.investments'), h('button', { class: 'link-btn', type: 'button', onclick: () => go('invest') }, t('common.open'))),
        h('div', { class: 'row between' }, h('span', { class: 'muted', text: t('nw.fromInvest') }), h('strong', { text: fmtBase(nw.investments, { decimals: 0 }) }))),
      card(sectionTitle(t('more.loans'), h('button', { class: 'link-btn', type: 'button', onclick: () => go('loans') }, t('common.open'))),
        h('div', { class: 'row between' }, h('span', { class: 'muted', text: t('nw.receivables') }), h('strong', { class: 'pos', text: fmtBase(nw.receivables, { decimals: 0 }) })),
        h('div', { class: 'row between' }, h('span', { class: 'muted', text: t('nw.payables') }), h('strong', { class: 'neg', text: fmtBase(-nw.payables, { decimals: 0 }) }))),
      card(sectionTitle(t('nw.liabilities'), h('button', { class: 'link-btn', type: 'button', onclick: () => openMoneyItemEditor('liabilities') }, t('common.add'))),
        st.liabilities.length ? h('div', { class: 'list' }, st.liabilities.map((l) => row(l, 'amount', 'liabilities'))) : h('p', { class: 'muted', text: t('nw.noLiabilities') })),
    ],
  };
}

function openMoneyItemEditor(kind, item) {
  const st = S();
  const amountKey = kind === 'accounts' ? 'balance' : 'amount';
  const d = item ? { ...item } : { id: uid(), name: '', currency: st.settings.defaultCurrency, [amountKey]: '' };
  const name = h('input', { type: 'text', value: d.name, maxlength: 40, placeholder: t(kind === 'accounts' ? 'nw.accountPh' : 'nw.liabilityPh') });
  const amount = numberInput(d[amountKey] === '' ? '' : String(d[amountKey]), { placeholder: '0' });
  const ccy = select(currencyOptions(d.currency), d.currency, (v) => (d.currency = v));
  const sheet = openSheet({
    title: t(kind === 'accounts' ? (item ? 'nw.editAccount' : 'nw.addAccount') : item ? 'nw.editLiability' : 'nw.addLiability'),
    body: [
      field(t('inv.name'), name),
      h('div', { class: 'row gap' }, field(t(kind === 'accounts' ? 'nw.balance' : 'nw.owed'), amount), field(t('entry.currency'), ccy)),
      h('div', { class: 'sheet-footer' },
        item && h('button', {
          class: 'btn danger ghost', type: 'button',
          onclick: () => {
            update((s) => {
              s[kind] = s[kind].filter((x) => x.id !== item.id);
              if (kind === 'accounts') for (const g of s.goals) if (Array.isArray(g.accounts)) g.accounts = g.accounts.filter((id) => id !== item.id);
            });
            sheet.close();
          },
        }, t('common.delete')),
        h('button', {
          class: 'btn primary grow', type: 'button',
          onclick: () => {
            d.name = name.value.trim();
            d[amountKey] = readNumber(amount.value);
            if (!d.name) return toast(t('inv.needName'), { kind: 'warn' });
            if (!Number.isFinite(d[amountKey])) return toast(t('entry.needAmount'), { kind: 'warn' });
            d.updatedAt = today();
            update((s) => {
              const i = s[kind].findIndex((x) => x.id === d.id);
              if (i >= 0) s[kind][i] = d;
              else s[kind].push(d);
            });
            sheet.close();
          },
        }, t('common.save'))),
    ],
  });
  if (!item) name.focus();
}

// ---------------------------------------------------------------- categories
const catUi = { type: 'expense' };

export function categoriesView() {
  const st = S();
  const counts = new Map();
  for (const tx of st.transactions) counts.set(tx.categoryId, (counts.get(tx.categoryId) ?? 0) + 1);
  const cats = st.categories.filter((c) => c.type === catUi.type && !c.archived);
  return {
    title: t('more.categories'),
    body: [
      segmented([{ value: 'expense', label: t('entry.expense') }, { value: 'income', label: t('entry.income') }], catUi.type, (v) => { catUi.type = v; rerender(); }),
      card(h('div', { class: 'list' }, cats.map((c) => listRow({
        icon: c.icon, title: nameOf(c), subtitle: t('cat.count', { n: counts.get(c.id) ?? 0 }), chevron: true, onClick: () => openCategoryEditor(c),
      })))),
      h('button', { class: 'btn primary block', type: 'button', onclick: () => openCategoryEditor() }, t('cat.add')),
    ],
  };
}

function openCategoryEditor(cat) {
  const st = S();
  const lang = getLang();
  const d = cat ? structuredClone(cat) : { id: uid(), type: catUi.type, names: { en: '', ar: '' }, icon: '🏷️', color: PALETTE[st.categories.length % PALETTE.length] };
  const iconIn = h('input', { type: 'text', value: d.icon, maxlength: 4, class: 'emoji-input', 'aria-label': t('cat.icon') });
  const nameIn = h('input', { type: 'text', value: nameOf(d), maxlength: 30, placeholder: t('cat.namePh') });
  const isOther = Object.values(OTHER_CATEGORY).includes(d.id);
  const sheet = openSheet({
    title: cat ? t('cat.edit') : t('cat.add'),
    body: [
      h('div', { class: 'edit-row' }, iconIn, nameIn),
      h('p', { class: 'muted small', text: t('cat.iconHint') }),
      h('div', { class: 'sheet-footer' },
        cat && !isOther && h('button', {
          class: 'btn danger ghost', type: 'button',
          onclick: async () => {
            const n = st.transactions.filter((x) => x.categoryId === cat.id).length;
            const other = st.categories.find((c) => c.id === OTHER_CATEGORY[cat.type]);
            if (!(await confirmDialog({ title: t('cat.deleteTitle'), message: t('cat.deleteMsg', { n, other: nameOf(other) }), ok: t('common.delete'), cancel: t('common.cancel'), danger: true }))) return;
            update((s) => {
              for (const x of s.transactions) if (x.categoryId === cat.id) x.categoryId = OTHER_CATEGORY[cat.type];
              s.budgets = s.budgets.filter((b) => b.categoryId !== cat.id);
              s.categories = s.categories.filter((c) => c.id !== cat.id);
            });
            sheet.close();
          },
        }, t('common.delete')),
        h('button', {
          class: 'btn primary grow', type: 'button',
          onclick: () => {
            const name = nameIn.value.trim();
            if (!name) return toast(t('inv.needName'), { kind: 'warn' });
            d.icon = iconIn.value.trim() || '🏷️';
            d.names = cat ? { ...d.names, [lang]: name } : { en: name, ar: name };
            update((s) => {
              const i = s.categories.findIndex((c) => c.id === d.id);
              if (i >= 0) s.categories[i] = d;
              else s.categories.push(d);
            });
            sheet.close();
          },
        }, t('common.save'))),
    ],
  });
  if (!cat) nameIn.focus();
}

// ---------------------------------------------------------------- currencies & rates
export function ratesView() {
  const st = S();
  const base = st.settings.baseCurrency;
  const all = [...new Set([base, ...st.settings.currencies])];
  const setRate = (code, value) => {
    const v = readNumber(value);
    if (!(v > 0)) return toast(t('rates.invalid'), { kind: 'warn' });
    update((s) => {
      s.rates[code] = v;
      s.settings.ratesSource = 'manual';
    }, { render: false });
  };
  const locked = new Set([base, st.settings.defaultCurrency, st.settings.reportCurrency]);
  const rateRows = all.filter((c) => c !== base).map((code) => {
    const input = numberInput(String(st.rates[code] ?? ''), { class: 'rate-input', 'aria-label': `1 ${base} = ? ${code}` });
    input.addEventListener('change', () => setRate(code, input.value));
    return h('div', { class: 'rate-row' },
      h('span', { class: 'rate-label', text: `1 ${base} =` }), input, h('strong', { text: code }),
      h('button', {
        class: 'icon-btn', type: 'button', 'aria-label': t('rates.remove', { code }), disabled: locked.has(code),
        onclick: () => update((s) => (s.settings.currencies = s.settings.currencies.filter((c) => c !== code))),
      }, '✕'));
  });
  const newCode = h('input', { type: 'text', maxlength: 3, placeholder: 'EUR', class: 'code-input', autocapitalize: 'characters', 'aria-label': t('rates.code') });
  const newRate = numberInput('', { placeholder: '1.17', class: 'rate-input', 'aria-label': t('rates.rate') });
  const status = h('p', { class: 'muted small', text: st.settings.ratesUpdatedAt ? t('rates.updatedAt', { date: fmtDate(st.settings.ratesUpdatedAt.slice(0, 10), { year: true }), source: t(`rates.src.${st.settings.ratesSource}`) }) : t('rates.defaults') });

  return {
    title: t('more.rates'),
    body: [
      card(
        field(t('rates.report'), select(all.map((c) => ({ value: c, label: c })), st.settings.reportCurrency, (v) => update((s) => (s.settings.reportCurrency = v))), t('rates.reportHint')),
        field(t('rates.default'), select(st.settings.currencies.map((c) => ({ value: c, label: c })), st.settings.defaultCurrency, (v) => update((s) => (s.settings.defaultCurrency = v))), t('rates.defaultHint')),
      ),
      card(sectionTitle(t('rates.title')), h('p', { class: 'muted small', text: t('rates.intro') }), rateRows, status,
        h('button', {
          class: 'btn ghost block', type: 'button',
          onclick: async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            try {
              const { rates, updatedAt } = await fetchRates(base, all.filter((c) => c !== base));
              update((s) => {
                Object.assign(s.rates, rates);
                s.settings.ratesUpdatedAt = updatedAt;
                s.settings.ratesSource = 'online';
              });
              toast(t('rates.updated', { n: Object.keys(rates).length }), { kind: 'ok' });
            } catch {
              toast(t('rates.failed'), { kind: 'error' });
              btn.disabled = false;
            }
          },
        }, t('rates.updateBtn')),
        h('p', { class: 'muted small', text: t('rates.privacy', { host: new URL(RATES_URL_BASE).host, base }) })),
      card(sectionTitle(t('rates.add')),
        h('div', { class: 'rate-row' }, newCode, h('span', { class: 'rate-label', text: `1 ${base} =` }), newRate,
          h('button', {
            class: 'btn primary', type: 'button',
            onclick: () => {
              const code = newCode.value.trim().toUpperCase();
              const r = readNumber(newRate.value);
              if (!/^[A-Z]{3}$/.test(code)) return toast(t('rates.badCode'), { kind: 'warn' });
              if (!(r > 0) && !(st.rates[code] > 0)) return toast(t('rates.invalid'), { kind: 'warn' });
              update((s) => {
                if (r > 0) s.rates[code] = r;
                if (!s.settings.currencies.includes(code)) s.settings.currencies.push(code);
              });
            },
          }, t('common.add')))),
    ],
  };
}

// ---------------------------------------------------------------- backup
export function backupView() {
  const st = S();
  const last = st.settings.lastBackupAt;
  const pw1 = h('input', { type: 'password', autocomplete: 'new-password', minlength: 8, placeholder: t('backup.pwPh') });
  const pw2 = h('input', { type: 'password', autocomplete: 'new-password', placeholder: t('backup.pwAgain') });
  const exportArea = h('div', { class: 'stack' });
  const createBtn = h('button', {
    class: 'btn primary block', type: 'button',
    onclick: async () => {
      if (pw1.value.length < 8) return toast(t('backup.pwShort'), { kind: 'warn' });
      if (pw1.value !== pw2.value) return toast(t('backup.pwMismatch'), { kind: 'warn' });
      createBtn.disabled = true;
      createBtn.textContent = t('backup.encrypting');
      try {
        await flushSave();
        const file = await createBackup(store.state, pw1.value);
        pw1.value = pw2.value = '';
        offerFile(exportArea, file);
      } catch (e) {
        console.error(e);
        toast(t('backup.failed'), { kind: 'error' });
      } finally {
        createBtn.disabled = false;
        createBtn.textContent = t('backup.create');
      }
    },
  }, t('backup.create'));

  return {
    title: t('more.backup'),
    body: [
      card(
        h('p', { text: last ? t('backup.last', { date: fmtDate(last.slice(0, 10), { year: true }) }) : t('backup.never') }),
        h('p', { class: 'muted small', text: t('backup.why') }),
      ),
      card(sectionTitle(t('backup.export')),
        h('p', { class: 'muted small', text: t('backup.exportIntro') }),
        field(t('backup.password'), pw1), field(t('backup.pwAgain'), pw2),
        h('p', { class: 'warn-text small', text: t('backup.pwWarning') }),
        createBtn, exportArea),
      card(sectionTitle(t('backup.import')),
        h('p', { class: 'muted small', text: t('backup.importIntro') }),
        h('button', { class: 'btn ghost block', type: 'button', onclick: () => pickBackupFile(restoreIntoApp) }, t('backup.chooseFile'))),
      card(field(t('backup.reminder'), select(
        [7, 14, 30, 0].map((d) => ({ value: String(d), label: d ? t('backup.everyDays', { n: d }) : t('backup.noReminder') })),
        String(st.settings.backupReminderDays ?? 14),
        (v) => update((s) => (s.settings.backupReminderDays = Number(v)), { render: false })))),
    ],
  };
}

// Second tap: hand the encrypted file to the share sheet (Save to Files /
// iCloud Drive) or download it. Share must start from a fresh tap on iOS.
function offerFile(area, file) {
  const name = `money-planner-backup-${today()}.json`;
  const blob = new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' });
  const markDone = () => update((s) => (s.settings.lastBackupAt = new Date().toISOString()));
  const btn = h('button', {
    class: 'btn primary block', type: 'button',
    onclick: async () => {
      const f = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare?.({ files: [f] })) {
        try {
          await navigator.share({ files: [f], title: name });
          markDone();
          toast(t('backup.saved'), { kind: 'ok' });
        } catch (e) {
          if (e?.name !== 'AbortError') toast(t('backup.failed'), { kind: 'error' });
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = h('a', { href: url, download: name });
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        markDone();
        toast(t('backup.downloaded'), { kind: 'ok' });
      }
    },
  }, t('backup.saveFile'));
  area.replaceChildren(h('p', { class: 'pos small', text: t('backup.ready') }), btn);
}

export function pickBackupFile(onState) {
  const input = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.remove();
    if (!file) return;
    let json;
    try {
      json = JSON.parse(await file.text());
    } catch {
      return toast(t('backup.badFile'), { kind: 'error' });
    }
    askBackupPassword(json, onState);
  });
  document.body.append(input);
  input.click();
}

function askBackupPassword(json, onState) {
  const pw = h('input', { type: 'password', autocomplete: 'current-password' });
  const btn = h('button', {
    class: 'btn primary block', type: 'button',
    onclick: async () => {
      btn.disabled = true;
      btn.textContent = t('backup.decrypting');
      try {
        const state = migrate(await openBackup(json, pw.value));
        sheet.close();
        onState(state);
      } catch (e) {
        toast(t(e?.code === 'password' ? 'backup.wrongPw' : 'backup.badFile'), { kind: 'error' });
        btn.disabled = false;
        btn.textContent = t('backup.restore');
      }
    },
  }, t('backup.restore'));
  const sheet = openSheet({ title: t('backup.import'), body: [field(t('backup.password'), pw), btn] });
  pw.focus();
}

async function restoreIntoApp(state) {
  const counts = t('backup.counts', { tx: state.transactions.length, inv: state.holdings.length });
  if (!(await confirmDialog({ title: t('backup.replaceTitle'), message: `${t('backup.replaceMsg')}\n${counts}`, ok: t('backup.replace'), cancel: t('common.cancel'), danger: true }))) return;
  store.state = state;
  setLang(state.settings.lang);
  await vault.updatePrefs({ lang: state.settings.lang });
  await flushSave();
  toast(t('backup.restored'), { kind: 'ok' });
  go('home');
}

// ---------------------------------------------------------------- settings
export function settingsView() {
  const st = S();
  const persisted = h('span', { class: 'muted small', text: '…' });
  isPersisted().then((p) => (persisted.textContent = p ? t('settings.persistYes') : p === false ? t('settings.persistNo') : t('settings.persistUnknown')));
  return {
    title: t('more.settings'),
    body: [
      card(
        field(t('settings.language'), segmented([{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }], getLang(), async (v) => {
          setLang(v);
          update((s) => (s.settings.lang = v));
          await vault.updatePrefs({ lang: v });
          document.querySelector('.tabbar') && rerender();
        })),
        field(t('settings.theme'), segmented(['system', 'light', 'dark'].map((v) => ({ value: v, label: t(`settings.theme.${v}`) })), st.settings.theme ?? 'system', async (v) => {
          applyTheme(v);
          update((s) => (s.settings.theme = v), { render: false });
          await vault.updatePrefs({ theme: v });
        })),
      ),
      card(
        field(t('settings.autoLock'), select([1, 2, 5, 10, 30].map((m) => ({ value: String(m), label: t('settings.minutes', { n: m }) })), String(st.settings.autoLockMinutes ?? 2),
          (v) => update((s) => (s.settings.autoLockMinutes = Number(v)), { render: false }))),
        h('button', { class: 'btn ghost block', type: 'button', onclick: openChangePin }, t('settings.changePin')),
      ),
      card(
        h('div', { class: 'row between' }, h('span', { text: t('settings.storage') }), persisted),
        h('p', { class: 'muted small', text: t('settings.storageHint') }),
        h('button', {
          class: 'btn ghost block', type: 'button',
          onclick: async () => {
            const ok = await requestPersistence();
            persisted.textContent = ok ? t('settings.persistYes') : t('settings.persistNo');
          },
        }, t('settings.persistBtn')),
      ),
      card(
        h('p', { class: 'muted small', text: t('settings.eraseHint') }),
        h('button', { class: 'btn danger block', type: 'button', onclick: eraseEverything }, t('settings.erase')),
      ),
    ],
  };
}

function pinInput(label) {
  return h('input', { type: 'password', inputmode: 'numeric', pattern: '[0-9]*', maxlength: vault.PIN_LENGTH, autocomplete: 'off', 'aria-label': label, class: 'pin-input' });
}

function openChangePin() {
  const cur = pinInput(t('settings.currentPin'));
  cur.maxLength = 8; // older PINs had 6 digits
  const p1 = pinInput(t('settings.newPin'));
  const p2 = pinInput(t('settings.newPinAgain'));
  const re = new RegExp(`^\\d{${vault.PIN_LENGTH}}$`);
  const sheet = openSheet({
    title: t('settings.changePin'),
    body: [
      field(t('settings.currentPin'), cur),
      field(t('settings.newPin'), p1, t('onb.pinHint', { n: vault.PIN_LENGTH })),
      field(t('settings.newPinAgain'), p2),
      h('button', {
        class: 'btn primary block', type: 'button',
        onclick: async (e) => {
          if (!re.test(p1.value)) return toast(t('onb.pinHint', { n: vault.PIN_LENGTH }), { kind: 'warn' });
          if (p1.value !== p2.value) return toast(t('onb.pinMismatch'), { kind: 'warn' });
          e.currentTarget.disabled = true;
          if (!(await vault.checkPin(cur.value))) {
            e.currentTarget.disabled = false;
            return toast(t('lock.wrong'), { kind: 'error' });
          }
          await flushSave();
          await vault.changePin(p1.value, store.state);
          sheet.close();
          toast(t('settings.pinChanged'), { kind: 'ok' });
        },
      }, t('common.save')),
    ],
  });
  cur.focus();
}

export async function eraseEverything() {
  const word = t('settings.eraseWord');
  const input = h('input', { type: 'text', autocomplete: 'off', placeholder: word });
  const sheet = openSheet({
    title: t('settings.erase'),
    body: [
      h('div', { class: 'notice danger' }, h('p', { text: t('settings.eraseConfirm', { word }) })),
      input,
      h('button', {
        class: 'btn danger block', type: 'button',
        onclick: async () => {
          if (input.value.trim().toLowerCase() !== word.toLowerCase()) return toast(t('settings.eraseTypeWord', { word }), { kind: 'warn' });
          sheet.close();
          store.state = null;
          await vault.eraseAll();
          location.reload();
        },
      }, t('settings.erase')),
    ],
  });
}

// ---------------------------------------------------------------- about
export function aboutView() {
  const shortcutUrl = `${location.origin}${location.pathname}#sms=`;
  return {
    title: t('more.about'),
    body: [
      card(h('h2', { text: t('about.privacyTitle') }),
        h('ul', { class: 'bullets' }, ['about.p1', 'about.p2', 'about.p3', 'about.p4', 'about.p5'].map((k) => h('li', { text: t(k) })))),
      card(h('h2', { text: t('about.disclaimerTitle') }), h('p', { text: t('about.disclaimer') })),
      card(h('h2', { text: t('about.shortcutTitle') }),
        h('p', { class: 'muted small', text: t('about.shortcutIntro') }),
        h('code', { class: 'url-box', text: shortcutUrl }),
        h('div', { class: 'row gap' },
          h('button', {
            class: 'btn ghost grow', type: 'button',
            onclick: async () => {
              try {
                await navigator.clipboard.writeText(shortcutUrl);
                toast(t('common.copied'), { kind: 'ok' });
              } catch {
                toast(t('sms.pasteFailed'), { kind: 'warn' });
              }
            },
          }, t('common.copy')),
          h('a', { class: 'btn ghost grow', href: `${REPO_URL}#iphone-shortcut`, target: '_blank', rel: 'noopener noreferrer' }, t('about.guide')))),
      card(listRow({ title: t('about.version'), value: APP_VERSION }),
        h('a', { class: 'link-btn', href: `${REPO_URL}/blob/main/PRIVACY.md`, target: '_blank', rel: 'noopener noreferrer' }, t('about.privacyDoc'))),
    ],
  };
}

