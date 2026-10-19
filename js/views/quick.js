// Quick text (typed, keyboard dictation or Siri) and "Add from copied message".
// Text is parsed straight away; only the extracted fields are kept.

import { h, toast } from '../ui.js';
import { icon } from '../icons.js';
import { t, money, nameOf } from '../i18n.js';
import { parseQuickText } from '../nlp/quicktext.js';
import { parseSms, detectBank, isOtpMessage } from '../sms/parser.js';
import { S, checkBudgetAlert, categoryById } from './common.js';
import { update } from '../store.js';
import { planQuickSave } from '../quicksave.js';
import { loanRemaining } from '../finance.js';
import { go } from './shell.js';
import { openEntry, handleSmsResult, showOtpRefusal } from './entry.js';
import { handleLoanResult } from './loans.js';

export function handleQuickResult(r) {
  if (!r) return;
  if (!r.ok) {
    if (r.reason === 'otp') return showOtpRefusal();
    return toast(t(r.reason === 'empty' ? 'sms.empty' : 'quick.noAmount'), { kind: 'warn', ms: 6000 });
  }
  if (r.kind === 'loan') return handleLoanResult(r);
  openEntry({
    fromText: true,
    prefill: { type: r.type, amount: r.amount, currency: r.currency ?? S().settings.defaultCurrency, currencyGuessed: r.currencyGuessed, merchant: r.item ?? '', date: r.date, categoryId: r.categoryId },
  });
}

export function parseTyped(text) {
  return parseQuickText(text, { defaultCurrency: S().settings.defaultCurrency });
}

// Bank messages have tell-tale words; anything else is treated as quick text.
export function looksLikeBankSms(text) {
  return !!detectBank(text) || /\b(?:card|a\/c|acct|account|balance|avl|bal|dear customer|pos|atm|debited|credited|transaction)\b|بطاق|حساب|رصيد|عميلنا|العميل|[*xX]{2,}\d/i.test(text);
}

// Reads text the user copied (bank SMS or their own words) — only on their tap.
export async function addFromClipboard() {
  if (!navigator.clipboard?.readText) return toast(t('sms.pasteFailed'), { kind: 'warn' });
  let text;
  try {
    text = await navigator.clipboard.readText();
  } catch {
    return toast(t('sms.pasteFailed'), { kind: 'warn' });
  }
  if (!text?.trim()) return toast(t('clip.empty'), { kind: 'warn' });
  // don't leave a bank message sitting on the clipboard
  navigator.clipboard.writeText('').catch(() => {});
  routeText(text);
  text = null;
}

// Decides between the SMS parser and the quick-text parser.
export function routeText(text) {
  if (isOtpMessage(text)) return showOtpRefusal();
  const dc = S().settings.defaultCurrency;
  if (looksLikeBankSms(text)) {
    const r = parseSms(text, { defaultCurrency: dc });
    if (r.ok || r.reason === 'otp') return handleSmsResult(r);
    return handleQuickResult(parseQuickText(text, { defaultCurrency: dc }));
  }
  const q = parseQuickText(text, { defaultCurrency: dc });
  if (q.ok) return saveQuick(q, text);
  const r = parseSms(text, { defaultCurrency: dc });
  return r.ok ? handleSmsResult(r) : saveQuick(q, text);
}

// ---------------------------------------------------------------- instant save
// "قهوة 15" + Enter → saved at once, with a toast to undo or edit.
// Only asks (opens a sheet) when the amount is missing or unclear.
export function saveQuick(r, text = '') {
  const st = S();
  const plan = planQuickSave(r, st);
  if (plan.action === 'ask') {
    if (plan.reason === 'empty') return;
    if (plan.reason === 'otp') return showOtpRefusal();
    if (plan.reason === 'no_amount') {
      toast(t('quick.howMuch'), { kind: 'warn' });
      return openEntry({ prefill: { merchant: text.trim().slice(0, 60) } });
    }
    return handleQuickResult(r); // ambiguous, or which loan
  }

  if (plan.action === 'tx') {
    const rec = plan.record;
    update((s) => s.transactions.push(rec));
    const label = rec.merchant ?? nameOf(categoryById(rec.categoryId, rec.type));
    toast(t(rec.type === 'income' ? 'quick.savedIncome' : 'quick.saved', { what: label, amount: money(rec.amount, rec.currency) }), {
      kind: 'ok', ms: 6000,
      actions: [
        { label: t('common.undo'), run: () => update((s) => (s.transactions = s.transactions.filter((x) => x.id !== rec.id))) },
        { label: t('common.edit'), run: () => openEntry({ tx: S().transactions.find((x) => x.id === rec.id) }) },
      ],
    });
    return checkBudgetAlert(rec);
  }

  if (plan.action === 'loan') {
    const loan = plan.loan;
    update((s) => s.loans.push(loan));
    toast(t(loan.direction === 'lent' ? 'quick.savedLent' : 'quick.savedBorrowed', { name: loan.person, amount: money(loan.amount, loan.currency) }), {
      kind: 'ok', ms: 6000,
      actions: [
        { label: t('common.undo'), run: () => update((s) => (s.loans = s.loans.filter((x) => x.id !== loan.id))) },
        { label: t('common.edit'), run: () => go('loan', { id: loan.id }) },
      ],
    });
    return;
  }

  // repayment on the one open loan with that person
  const { loanId, repayment, settles } = plan;
  update((s) => {
    const l = s.loans.find((x) => x.id === loanId);
    l.repayments.push(repayment);
    if (settles) l.settledAt = repayment.date;
  });
  const loan = S().loans.find((x) => x.id === loanId);
  toast(t(settles ? 'quick.savedRepaySettled' : 'quick.savedRepay', { name: loan.person, amount: money(repayment.amount, loan.currency), left: money(loanRemaining(loan), loan.currency) }), {
    kind: 'ok', ms: 6000,
    actions: [
      {
        label: t('common.undo'),
        run: () => update((s) => {
          const l = s.loans.find((x) => x.id === loanId);
          l.repayments = l.repayments.filter((x) => x.id !== repayment.id);
          if (settles) l.settledAt = null;
        }),
      },
      { label: t('common.edit'), run: () => go('loan', { id: loanId }) },
    ],
  });
}

// The big box at the top of Home.
export function quickBox() {
  const input = h('input', {
    type: 'text', class: 'quick-input', autocomplete: 'off', autocorrect: 'off', enterkeyhint: 'done', maxlength: 200,
    placeholder: t('quick.placeholder'), 'aria-label': t('quick.title'),
  });
  const submit = () => {
    const text = input.value;
    if (!text.trim()) return input.focus();
    input.value = '';
    saveQuick(parseTyped(text), text);
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });
  return h('section', { class: 'quick-box' },
    h('div', { class: 'quick-row' },
      input,
      h('button', { class: 'quick-go', type: 'button', 'aria-label': t('quick.add'), onclick: submit }, icon('plus', { size: 30 }))),
    h('p', { class: 'quick-hint', text: t('quick.hint') }),
    h('button', { class: 'btn ghost small-btn', type: 'button', onclick: () => addFromClipboard() }, icon('clipboard', { size: 18 }), t('clip.button')));
}
