// Add / edit a transaction, and the bank-SMS paste flow.
//
// Quick add: tap +, type the amount, tap a category — saved (2 taps + typing).

import { h, openSheet, field, segmented, select, numberInput, readNumber, toast, confirmDialog } from '../ui.js';
import { t, nameOf, money } from '../i18n.js';
import { update } from '../store.js';
import { uid } from '../model.js';
import { rateOf } from '../finance.js';
import { parseSms } from '../sms/parser.js';
import { suggestCategory } from '../categorize.js';
import { S, today, currencyOptions, checkBudgetAlert } from './common.js';

/**
 * @param opts.tx       existing transaction to edit
 * @param opts.prefill  values from the SMS parser
 * @param opts.fromSms  show the "from bank SMS" note and ask to confirm
 */
export function openEntry({ tx, prefill, fromSms = false } = {}) {
  const st = S();
  const editing = !!tx;
  const d = {
    type: tx?.type ?? prefill?.type ?? 'expense',
    amount: tx?.amount ?? prefill?.amount ?? '',
    currency: tx?.currency ?? prefill?.currency ?? st.settings.lastCurrency ?? st.settings.defaultCurrency,
    categoryId: tx?.categoryId ?? null,
    merchant: tx?.merchant ?? prefill?.merchant ?? '',
    date: tx?.date ?? prefill?.date ?? today(),
    note: tx?.note ?? '',
  };
  if (!d.categoryId && d.merchant) d.categoryId = suggestCategory(d.merchant, d.type, st.transactions, st.categories);
  const quick = !editing && !fromSms;

  const amountInput = numberInput(d.amount === '' ? '' : String(d.amount), { class: 'amount-input', placeholder: '0', 'aria-label': t('entry.amount') });
  const currencySel = select(currencyOptions(d.currency), d.currency, (v) => (d.currency = v), { class: 'currency-select', 'aria-label': t('entry.currency') });
  const merchantInput = h('input', { type: 'text', value: d.merchant, autocomplete: 'off', maxlength: 60, placeholder: t('entry.merchantPh') });
  const dateInput = h('input', { type: 'date', value: d.date, max: today() });
  const noteInput = h('input', { type: 'text', value: d.note, maxlength: 120, autocomplete: 'off' });
  const catGrid = h('div', { class: 'cat-grid', role: 'radiogroup', 'aria-label': t('entry.category') });
  const details = h('div', { class: 'details', hidden: quick },
    field(t('entry.merchant'), merchantInput),
    h('div', { class: 'row gap' }, field(t('entry.date'), dateInput), field(t('entry.note'), noteInput)),
  );

  const readForm = () => {
    d.amount = readNumber(amountInput.value);
    d.merchant = merchantInput.value.trim().slice(0, 60);
    d.date = dateInput.value || today();
    d.note = noteInput.value.trim().slice(0, 120);
  };

  function save() {
    readForm();
    if (!(d.amount > 0)) {
      amountInput.focus();
      amountInput.classList.add('shake');
      setTimeout(() => amountInput.classList.remove('shake'), 400);
      toast(t('entry.needAmount'), { kind: 'warn' });
      return;
    }
    if (!d.categoryId) {
      toast(t('entry.needCategory'), { kind: 'warn' });
      return;
    }
    const record = {
      id: tx?.id ?? uid(),
      type: d.type,
      amount: Math.round(d.amount * 1000) / 1000,
      currency: d.currency,
      rate: tx && tx.currency === d.currency ? tx.rate : rateOf(st.rates, d.currency),
      categoryId: d.categoryId,
      merchant: d.merchant || null,
      date: d.date,
      note: d.note || null,
      source: tx?.source ?? (fromSms ? 'sms' : 'manual'),
      createdAt: tx?.createdAt ?? new Date().toISOString(),
    };
    update((s) => {
      const i = s.transactions.findIndex((x) => x.id === record.id);
      if (i >= 0) s.transactions[i] = record;
      else s.transactions.push(record);
      s.transactions.sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? -1 : 1) : a.date < b.date ? -1 : 1));
      s.settings.lastCurrency = d.currency;
    });
    sheet.close();
    toast(t(editing ? 'entry.updated' : 'entry.saved', { amount: money(record.amount, record.currency) }), {
      kind: 'ok',
      action: editing ? null : { label: t('common.undo'), run: () => update((s) => (s.transactions = s.transactions.filter((x) => x.id !== record.id))) },
    });
    checkBudgetAlert(record);
  }

  function drawCategories() {
    const cats = st.categories.filter((c) => c.type === d.type && !c.archived);
    catGrid.replaceChildren(...cats.map((c) =>
      h('button', {
        type: 'button', role: 'radio', class: `cat-chip${c.id === d.categoryId ? ' on' : ''}`, 'aria-checked': String(c.id === d.categoryId),
        onclick: () => {
          d.categoryId = c.id;
          if (quick) save();
          else drawCategories();
        },
      }, h('span', { class: 'cat-icon', 'aria-hidden': 'true' }, c.icon), h('span', { class: 'cat-name', text: nameOf(c) }))));
  }
  drawCategories();

  const typeSeg = segmented(
    [{ value: 'expense', label: t('entry.expense') }, { value: 'income', label: t('entry.income') }],
    d.type,
    (v) => {
      d.type = v;
      if (!st.categories.some((c) => c.id === d.categoryId && c.type === v)) d.categoryId = null;
      drawCategories();
    },
  );

  const moreBtn = quick && h('button', {
    class: 'link-btn', type: 'button',
    onclick: () => {
      details.hidden = !details.hidden;
      moreBtn.textContent = details.hidden ? t('entry.moreDetails') : t('entry.lessDetails');
    },
  }, t('entry.moreDetails'));

  const guessed = prefill?.guessed ?? {};
  const smsNote = fromSms && h('div', { class: 'notice' },
    h('strong', { text: t('sms.keptOnly') }),
    h('span', { text: ' ' + t('sms.discarded') }),
    (guessed.currency || guessed.date || guessed.type) && h('div', { class: 'warn-text', text: t('sms.checkGuessed', {
      fields: [guessed.currency && t('entry.currency'), guessed.date && t('entry.date'), guessed.type && t('entry.type')].filter(Boolean).join(t('common.sep')),
    }) }),
  );

  const footer = h('div', { class: 'sheet-footer' },
    editing && h('button', {
      class: 'btn danger ghost', type: 'button',
      onclick: async () => {
        if (!(await confirmDialog({ title: t('entry.deleteTitle'), message: t('entry.deleteMsg'), ok: t('common.delete'), cancel: t('common.cancel'), danger: true }))) return;
        update((s) => (s.transactions = s.transactions.filter((x) => x.id !== tx.id)));
        sheet.close();
      },
    }, t('common.delete')),
    moreBtn,
    h('button', { class: 'btn primary grow', type: 'button', onclick: save }, fromSms ? t('sms.confirmSave') : t('common.save')),
  );

  const sheet = openSheet({
    title: editing ? t('entry.editTitle') : fromSms ? t('sms.confirmTitle') : t('entry.addTitle'),
    body: [
      smsNote,
      typeSeg,
      h('div', { class: 'amount-row' }, amountInput, currencySel),
      h('div', { class: 'label-row' }, h('span', { class: 'field-label', text: quick ? t('entry.tapToSave') : t('entry.category') })),
      catGrid,
      details,
      footer,
    ],
  });
  amountInput.addEventListener('keydown', (e) => e.key === 'Enter' && amountInput.blur());
  if (quick) amountInput.focus();
}

// ---------------------------------------------------------------- SMS
export function handleSmsResult(result) {
  if (!result) return;
  if (!result.ok) {
    if (result.reason === 'otp') showOtpRefusal();
    else toast(t(result.reason === 'empty' ? 'sms.empty' : 'sms.noAmount'), { kind: 'warn', ms: 5000 });
    return;
  }
  const st = S();
  const prefill = { ...result };
  if (!prefill.currency) {
    prefill.currency = st.settings.defaultCurrency;
    prefill.guessed = { ...prefill.guessed, currency: true };
  }
  openEntry({ prefill, fromSms: true });
}

export function showOtpRefusal() {
  const sheet = openSheet({
    title: t('sms.otpTitle'),
    body: [
      h('div', { class: 'notice danger' }, h('p', { text: t('sms.otpBody') })),
      h('button', { class: 'btn primary block', type: 'button', onclick: () => sheet.close() }, t('common.ok')),
    ],
  });
}

export function openSmsPaste() {
  const area = h('textarea', { rows: 6, autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', placeholder: t('sms.placeholder'), 'aria-label': t('sms.title') });
  const read = (text) => {
    area.value = '';
    const result = parseSms(text, { defaultCurrency: S().settings.defaultCurrency });
    text = null;
    sheet.close();
    handleSmsResult(result);
  };
  const pasteBtn = navigator.clipboard?.readText && h('button', {
    class: 'btn ghost', type: 'button',
    onclick: async () => {
      try {
        const text = await navigator.clipboard.readText();
        // don't leave the raw bank message sitting on the clipboard
        navigator.clipboard.writeText('').catch(() => {});
        if (text) read(text);
      } catch {
        toast(t('sms.pasteFailed'), { kind: 'warn' });
      }
    },
  }, t('sms.pasteBtn'));
  const sheet = openSheet({
    title: t('sms.title'),
    onClose: () => (area.value = ''),
    body: [
      h('p', { class: 'muted small', text: t('sms.intro') }),
      area,
      h('div', { class: 'row gap' }, pasteBtn, h('button', { class: 'btn primary grow', type: 'button', onclick: () => read(area.value) }, t('sms.readBtn'))),
      h('p', { class: 'muted small', text: t('sms.privacy') }),
    ],
  });
}
