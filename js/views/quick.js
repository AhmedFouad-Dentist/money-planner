// Quick text (typed, keyboard dictation or Siri) and "Add from copied message".
// Text is parsed straight away; only the extracted fields are kept.

import { h, toast } from '../ui.js';
import { icon } from '../icons.js';
import { t } from '../i18n.js';
import { parseQuickText } from '../nlp/quicktext.js';
import { parseSms, detectBank, isOtpMessage } from '../sms/parser.js';
import { S } from './common.js';
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
  if (q.ok) return handleQuickResult(q);
  const r = parseSms(text, { defaultCurrency: dc });
  return r.ok ? handleSmsResult(r) : handleQuickResult(q);
}

export function quickTextCard() {
  const input = h('input', {
    type: 'text', class: 'quick-input', autocomplete: 'off', autocorrect: 'off', enterkeyhint: 'go', maxlength: 200,
    placeholder: t('quick.placeholder'), 'aria-label': t('quick.title'),
  });
  const go = () => {
    const text = input.value;
    input.value = '';
    input.blur();
    if (text.trim()) handleQuickResult(parseTyped(text));
  };
  input.addEventListener('keydown', (e) => e.key === 'Enter' && go());
  return h('section', { class: 'card quick-card' },
    h('div', { class: 'quick-row' }, input, h('button', { class: 'btn primary', type: 'button', 'aria-label': t('quick.add'), onclick: go }, icon('plus', { size: 20 }))),
    h('p', { class: 'muted small', text: t('quick.hint') }));
}
