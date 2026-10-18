import { h, card, openSheet, field, segmented, select, numberInput, readNumber, toast, confirmDialog, emptyState, listRow } from '../ui.js';
import { t, money, pct, fmtDate, nameOf, getLang } from '../i18n.js';
import { update } from '../store.js';
import { uid } from '../model.js';
import { holdingStats, rateOf, latestValue } from '../finance.js';
import { sparkline } from '../charts.js';
import { S, today, fmtBase, currencyOptions, sectionTitle } from './common.js';
import { go } from './shell.js';

const gainClass = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');
const typeOf = (id) => S().invTypes.find((x) => x.id === id) ?? S().invTypes.at(-1);

export function investView() {
  const st = S();
  let invested = 0, value = 0;
  const stats = new Map(st.holdings.map((x) => [x.id, holdingStats(x, st.rates)]));
  for (const s of stats.values()) {
    invested += s.contributedBase;
    value += s.valueBase;
  }
  const gain = value - invested;

  const summary = h('section', { class: 'card hero' },
    h('div', { class: 'muted', text: t('inv.currentValue') }),
    h('div', { class: 'hero-value', text: fmtBase(value, { decimals: 0 }) }),
    h('div', { class: 'tiles' },
      h('div', { class: 'tile' }, h('span', { class: 'tile-label', text: t('inv.invested') }), h('span', { class: 'tile-value', text: fmtBase(invested, { decimals: 0 }) })),
      h('div', { class: 'tile' }, h('span', { class: 'tile-label', text: t('inv.gain') }), h('span', { class: `tile-value ${gainClass(gain)}`, text: `${fmtBase(gain, { decimals: 0, signed: true })} · ${pct(invested > 0 ? gain / invested : null, 1, true)}` }))),
  );

  const groups = st.invTypes.map((tp) => {
    const items = st.holdings.filter((x) => (st.invTypes.some((y) => y.id === x.typeId) ? x.typeId : st.invTypes.at(-1).id) === tp.id);
    if (!items.length) return null;
    return card(
      h('h3', { class: 'day-title', text: `${tp.icon} ${nameOf(tp)}` }),
      h('div', { class: 'list' }, items.map((x) => {
        const s = stats.get(x.id);
        return listRow({
          title: x.name,
          subtitle: `${t('inv.gain')} ${money(s.gainNative, x.currency, { signed: true, decimals: Math.abs(s.gainNative) >= 1000 ? 0 : 2 })} (${pct(s.gainPctNative, 1, true)})`,
          value: money(s.valueNative, x.currency, { decimals: 0 }),
          valueClass: gainClass(s.gainNative),
          onClick: () => go('holding', { id: x.id }),
          chevron: true,
        });
      })),
    );
  });

  return {
    title: t('tab.invest'),
    body: [
      summary,
      st.holdings.length ? groups : emptyState(t('inv.empty')),
      h('div', { class: 'row gap' },
        h('button', { class: 'btn primary grow', type: 'button', onclick: () => openHoldingEditor() }, t('inv.addHolding')),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => openTypesEditor() }, t('inv.types'))),
      h('p', { class: 'muted small disclaimer', text: t('about.disclaimerShort') }),
    ],
  };
}

export function holdingView({ id }) {
  const st = S();
  const x = st.holdings.find((y) => y.id === id);
  if (!x) return null;
  const s = holdingStats(x, st.rates);
  const tp = typeOf(x.typeId);
  const values = [...(x.values ?? [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.at ?? 0) - (b.at ?? 0)));
  const contributions = [...(x.contributions ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    title: x.name,
    fab: false,
    body: [
      h('section', { class: 'card hero' },
        h('div', { class: 'muted', text: `${tp.icon} ${nameOf(tp)} · ${t('inv.currentValue')}` }),
        h('div', { class: 'hero-value', text: money(s.valueNative, x.currency, { decimals: 0 }) }),
        h('div', { class: 'tiles' },
          h('div', { class: 'tile' }, h('span', { class: 'tile-label', text: t('inv.invested') }), h('span', { class: 'tile-value', text: money(s.contributedNative, x.currency, { decimals: 0 }) })),
          h('div', { class: 'tile' }, h('span', { class: 'tile-label', text: t('inv.gain') }), h('span', { class: `tile-value ${gainClass(s.gainNative)}`, text: `${money(s.gainNative, x.currency, { decimals: 0, signed: true })} · ${pct(s.gainPctNative, 1, true)}` }))),
        x.currency !== st.settings.reportCurrency && h('p', { class: 'muted small', text: t('inv.inReport', { value: fmtBase(s.valueBase, { decimals: 0 }), gain: fmtBase(s.gainBase, { decimals: 0, signed: true }), pct: pct(s.gainPctBase, 1, true) }) }),
        s.valuedAt ? h('p', { class: 'muted small', text: t('inv.valuedAt', { date: fmtDate(s.valuedAt) }) }) : h('p', { class: 'muted small', text: t('inv.noValue') }),
        sparkline(values.map((v) => Number(v.value)), { title: t('inv.valueHistory') }),
      ),
      h('div', { class: 'row gap' },
        h('button', { class: 'btn primary grow', type: 'button', onclick: () => openContribution(x) }, t('inv.addMoney')),
        h('button', { class: 'btn ghost grow', type: 'button', onclick: () => openValue(x) }, t('inv.updateValue'))),
      card(sectionTitle(t('inv.contributions')),
        contributions.length
          ? h('div', { class: 'list' }, contributions.map((c) => listRow({
            title: c.amount < 0 ? t('inv.withdrawal') : t('inv.contribution'),
            subtitle: [fmtDate(c.date), c.note].filter(Boolean).join(' · '),
            value: money(c.amount, c.currency, { signed: true }),
            onClick: () => openContribution(x, c),
          })))
          : h('p', { class: 'muted', text: t('inv.noContrib') })),
      card(sectionTitle(t('inv.valueHistory')),
        values.length
          ? h('div', { class: 'list' }, [...values].reverse().map((v) => listRow({ title: fmtDate(v.date, { year: true }), value: money(v.value, x.currency), onClick: () => openValue(x, v) })))
          : h('p', { class: 'muted', text: t('inv.noValue') })),
      x.note && card(h('p', { class: 'pre-line', text: x.note })),
      h('button', { class: 'btn ghost block', type: 'button', onclick: () => openHoldingEditor(x) }, t('inv.editHolding')),
    ],
  };
}

function saveHolding(record) {
  update((s) => {
    const i = s.holdings.findIndex((y) => y.id === record.id);
    if (i >= 0) s.holdings[i] = record;
    else s.holdings.push(record);
  });
}

export function openHoldingEditor(holding) {
  const st = S();
  const d = holding ? structuredClone(holding) : { id: uid(), name: '', typeId: st.invTypes[0]?.id, currency: st.settings.defaultCurrency, note: '', contributions: [], values: [] };
  const name = h('input', { type: 'text', value: d.name, maxlength: 50, placeholder: t('inv.namePh') });
  const type = select(st.invTypes.map((tp) => ({ value: tp.id, label: `${tp.icon} ${nameOf(tp)}` })), d.typeId, (v) => (d.typeId = v));
  const ccy = select(currencyOptions(d.currency), d.currency, (v) => (d.currency = v));
  const note = h('textarea', { rows: 2, maxlength: 300 });
  note.value = d.note ?? '';
  const first = !holding && numberInput('', { placeholder: '0' });
  const sheet = openSheet({
    title: holding ? t('inv.editHolding') : t('inv.addHolding'),
    body: [
      field(t('inv.name'), name),
      h('div', { class: 'row gap' }, field(t('inv.type'), type), field(t('entry.currency'), ccy)),
      first && field(t('inv.firstAmount'), first, t('inv.firstAmountHint')),
      field(t('entry.note'), note),
      h('div', { class: 'sheet-footer' },
        holding && h('button', {
          class: 'btn danger ghost', type: 'button',
          onclick: async () => {
            if (!(await confirmDialog({ title: t('inv.deleteTitle'), message: t('inv.deleteMsg', { name: holding.name }), ok: t('common.delete'), cancel: t('common.cancel'), danger: true }))) return;
            update((s) => {
              s.holdings = s.holdings.filter((y) => y.id !== holding.id);
              for (const g of s.goals) if (Array.isArray(g.holdings)) g.holdings = g.holdings.filter((hid) => hid !== holding.id);
            }, { render: false });
            sheet.close();
            go('invest');
          },
        }, t('common.delete')),
        h('button', {
          class: 'btn primary grow', type: 'button',
          onclick: () => {
            d.name = name.value.trim();
            d.note = note.value.trim();
            if (!d.name) return toast(t('inv.needName'), { kind: 'warn' });
            if (holding && holding.currency !== d.currency && (d.values ?? []).length) {
              toast(t('inv.currencyChanged'), { kind: 'warn', ms: 6000 });
            }
            const amt = first ? readNumber(first.value) : NaN;
            if (amt > 0) d.contributions.push({ id: uid(), amount: amt, currency: d.currency, rate: rateOf(st.rates, d.currency), hRate: rateOf(st.rates, d.currency), date: today(), note: null });
            saveHolding(d);
            sheet.close();
            if (!holding) go('holding', { id: d.id });
          },
        }, t('common.save')),
      ),
    ],
  });
  if (!holding) name.focus();
}

function openContribution(holding, existing) {
  const st = S();
  const d = existing
    ? { ...existing, kind: existing.amount < 0 ? 'out' : 'in', abs: Math.abs(existing.amount) }
    : { id: uid(), kind: 'in', abs: '', currency: holding.currency, date: today(), note: '' };
  const amount = numberInput(d.abs === '' ? '' : String(d.abs), { placeholder: '0', class: 'amount-input' });
  const ccy = select(currencyOptions(d.currency), d.currency, (v) => (d.currency = v));
  const date = h('input', { type: 'date', value: d.date, max: today() });
  const note = h('input', { type: 'text', value: d.note ?? '', maxlength: 120 });
  const sheet = openSheet({
    title: existing ? t('inv.editContribution') : t('inv.addMoney'),
    body: [
      segmented([{ value: 'in', label: t('inv.contribution') }, { value: 'out', label: t('inv.withdrawal') }], d.kind, (v) => (d.kind = v)),
      h('div', { class: 'amount-row' }, amount, ccy),
      h('div', { class: 'row gap' }, field(t('entry.date'), date), field(t('entry.note'), note)),
      h('div', { class: 'sheet-footer' },
        existing && h('button', {
          class: 'btn danger ghost', type: 'button',
          onclick: () => {
            update((s) => {
              const hh = s.holdings.find((y) => y.id === holding.id);
              hh.contributions = hh.contributions.filter((c) => c.id !== existing.id);
            });
            sheet.close();
          },
        }, t('common.delete')),
        h('button', {
          class: 'btn primary grow', type: 'button',
          onclick: () => {
            const abs = readNumber(amount.value);
            if (!(abs > 0)) return toast(t('entry.needAmount'), { kind: 'warn' });
            const keepRates = existing && existing.currency === d.currency;
            const record = {
              id: d.id,
              amount: d.kind === 'out' ? -abs : abs,
              currency: d.currency,
              rate: keepRates ? existing.rate : rateOf(st.rates, d.currency),
              hRate: keepRates ? existing.hRate : rateOf(st.rates, holding.currency),
              date: date.value || today(),
              note: note.value.trim() || null,
            };
            update((s) => {
              const hh = s.holdings.find((y) => y.id === holding.id);
              const i = hh.contributions.findIndex((c) => c.id === record.id);
              if (i >= 0) hh.contributions[i] = record;
              else hh.contributions.push(record);
            });
            sheet.close();
          },
        }, t('common.save')),
      ),
    ],
  });
  if (!existing) amount.focus();
}

function openValue(holding, existing) {
  const lv = latestValue(holding);
  const value = numberInput(existing ? String(existing.value) : '', { placeholder: lv ? String(lv.value) : '0', class: 'amount-input' });
  const date = h('input', { type: 'date', value: existing?.date ?? today(), max: today() });
  const sheet = openSheet({
    title: t('inv.updateValue'),
    body: [
      h('p', { class: 'muted small', text: t('inv.valueHint', { ccy: holding.currency }) }),
      h('div', { class: 'amount-row' }, value, h('span', { class: 'ccy-tag', text: holding.currency })),
      field(t('entry.date'), date),
      h('div', { class: 'sheet-footer' },
        existing && h('button', {
          class: 'btn danger ghost', type: 'button',
          onclick: () => {
            update((s) => {
              const hh = s.holdings.find((y) => y.id === holding.id);
              hh.values = hh.values.filter((v) => v.id !== existing.id);
            });
            sheet.close();
          },
        }, t('common.delete')),
        h('button', {
          class: 'btn primary grow', type: 'button',
          onclick: () => {
            const v = readNumber(value.value);
            if (!(v >= 0)) return toast(t('entry.needAmount'), { kind: 'warn' });
            const record = { id: existing?.id ?? uid(), date: date.value || today(), value: v, at: Date.now() };
            update((s) => {
              const hh = s.holdings.find((y) => y.id === holding.id);
              hh.values ??= [];
              const i = hh.values.findIndex((x) => x.id === record.id);
              if (i >= 0) hh.values[i] = record;
              else hh.values.push(record);
            });
            sheet.close();
          },
        }, t('common.save')),
      ),
    ],
  });
  value.focus();
}

function openTypesEditor() {
  const list = h('div', { class: 'list' });
  const draw = () => {
    list.replaceChildren(...S().invTypes.map((tp) => {
      const used = S().holdings.some((x) => x.typeId === tp.id);
      const iconIn = h('input', { type: 'text', value: tp.icon, maxlength: 4, class: 'emoji-input', 'aria-label': t('cat.icon') });
      const nameIn = h('input', { type: 'text', value: nameOf(tp), maxlength: 30, 'aria-label': t('inv.name') });
      const commit = () => update((s) => {
        const x = s.invTypes.find((y) => y.id === tp.id);
        x.icon = iconIn.value.trim() || '•';
        x.names = { ...x.names, [getLang()]: nameIn.value.trim() || nameOf(tp) };
      });
      iconIn.addEventListener('change', commit);
      nameIn.addEventListener('change', commit);
      return h('div', { class: 'edit-row' }, iconIn, nameIn,
        h('button', {
          class: 'icon-btn', type: 'button', disabled: used || S().invTypes.length <= 1, 'aria-label': t('common.delete'), title: used ? t('inv.typeInUse') : '',
          onclick: () => { update((s) => (s.invTypes = s.invTypes.filter((y) => y.id !== tp.id))); draw(); },
        }, '🗑'));
    }));
  };
  draw();
  const newIcon = h('input', { type: 'text', value: '💼', maxlength: 4, class: 'emoji-input', 'aria-label': t('cat.icon') });
  const newName = h('input', { type: 'text', maxlength: 30, placeholder: t('inv.newTypePh') });
  openSheet({
    title: t('inv.types'),
    body: [
      list,
      h('div', { class: 'edit-row' }, newIcon, newName,
        h('button', {
          class: 'btn primary', type: 'button',
          onclick: () => {
            const n = newName.value.trim();
            if (!n) return;
            update((s) => s.invTypes.push({ id: uid(), names: { en: n, ar: n }, icon: newIcon.value.trim() || '💼' }));
            newName.value = '';
            draw();
          },
        }, t('common.add'))),
    ],
  });
}
