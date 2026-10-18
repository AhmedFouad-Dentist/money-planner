// Bank SMS parser.
//
// Input: the text of one bank SMS. Output: ONLY { type, amount, currency,
// merchant, date } (plus which bank rule matched). The message itself is never
// returned or stored. Card/account numbers, IBANs, long reference numbers and
// balances/limits are cut out before anything is extracted, so they cannot leak
// into the merchant field. Messages that look like one-time passwords or
// verification codes are refused entirely.

import { normalizeText, foldArabic, compileRule, escapeRegExp, AR } from './text.js';
import {
  CURRENCY_RE_SRC, AMOUNT_RE_SRC, currencyFromAlias, parseAmount,
  OTP_PATTERNS, INCOME_PATTERNS, EXPENSE_PATTERNS,
  MERCHANT_LEADS_STRONG, MERCHANT_LEADS_WEAK, MERCHANT_STOPS, NOT_MERCHANT_WORDS, MONTHS,
} from './vocab.js';
import { BANK_RULES } from './banks.js';

const CUR = CURRENCY_RE_SRC;
const AMT = AMOUNT_RE_SRC;
const fold = foldArabic;

const OTP = OTP_PATTERNS.map((r) => compileRule(r));
const INCOME = INCOME_PATTERNS.map((r) => compileRule(r));
const EXPENSE = EXPENSE_PATTERNS.map((r) => compileRule(r));

// ---------------------------------------------------------------- redaction
// Spans removed before extraction. Each is [source, flags].
const REDACT = [
  // masked cards / accounts: ****1234, XXXX1234, xx-1234, 1234****5678, 1234XXXX
  [String.raw`(?<![A-Za-z])[*xX•#]{2,}[\s-]?\d{2,6}`, 'g'],
  [String.raw`(?<!\d)\d{2,6}[*xX•]{2,}(?:\d{1,6})?`, 'g'],
  // full card numbers
  [String.raw`(?<!\d)\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{1,4}(?!\d)`, 'g'],
  // IBAN
  [String.raw`\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,8}(?: ?[A-Z0-9]{1,3})?\b`, 'g'],
  // "card ending 1234", "A/C no. 1234567", "account: 1234"
  [String.raw`\b(?:card|a\/c|acct?|account|acc)\b(?:\s*(?:no\.?|number|num|ending|with|in|ends|#|:|-))*\s*[*xX]*\d{3,}`, 'gi'],
  [String.raw`(?:بطاقة|بطاقتك|بطاقتكم|البطاقة|حساب|حسابك|حسابكم|الحساب)(?:\s*(?:رقم|المنتهية|المنتهي|ب|:))*\s*[*xX]*\d{3,}`, 'g'],
  // balances and limits (keyword followed by an amount)
  [String.raw`(?:\b(?:avl|avlbl|avail|available|current|ledger|closing|remaining|new|total|outstanding|o\/s)\b\.?\s*)?\b(?:bal|balance|limit)\b\.?\s*(?:is|:|of|=|-)?\s*(?:${CUR})?\s*[-+]?\s*${AMT}(?:\s*${CUR})?(?:\s*(?:cr|dr)\b)?`, 'gi'],
  [String.raw`(?:ال)?رصيد(?:ك|كم)?(?:\s*(?:ال)?(?:متاح|حالي|جديد|متبقي|دفتري))?\s*(?:هو|:|-)?\s*(?:${CUR})?\s*[-+]?\s*${AMT}(?:\s*${CUR})?`, 'gi'],
  [String.raw`(?:ال)?حد\s*(?:ال)?(?:متاح|ائتماني|الائتماني)\s*(?:هو|:|-)?\s*(?:${CUR})?\s*${AMT}(?:\s*${CUR})?`, 'gi'],
  // phone numbers and long digit runs (account numbers, references)
  [String.raw`\+\d[\d ]{7,}\d`, 'g'],
  [String.raw`(?<![\d.,])\d{7,}(?![\d]|[.,]\d)`, 'g'],
].map(([src, flags]) => new RegExp(fold(src), flags));

export function redact(base) {
  const f = fold(base);
  const spans = [];
  for (const re of REDACT) {
    for (const m of f.matchAll(re)) spans.push([m.index, m.index + m[0].length]);
  }
  if (!spans.length) return base;
  spans.sort((a, b) => a[0] - b[0]);
  let out = '';
  let pos = 0;
  for (const [s, e] of spans) {
    if (e <= pos) continue;
    out += base.slice(pos, Math.max(pos, s)) + ' | ';
    pos = e;
  }
  return (out + base.slice(pos)).replace(/ {2,}/g, ' ');
}

// ---------------------------------------------------------------- detection
export function isOtpMessage(raw, bank = null) {
  let text = fold(normalizeText(raw));
  for (const phrase of bank?.safeDisclaimers ?? []) {
    text = text.replace(new RegExp(escapeRegExp(fold(normalizeText(phrase))), 'gi'), ' ');
  }
  return OTP.some((re) => re.test(text));
}

const compiled = new WeakMap();
function compiledRule(rule) {
  let c = compiled.get(rule);
  if (!c) {
    c = {
      detect: (rule.detect ?? []).map((r) => compileRule(r)),
      patterns: (rule.patterns ?? []).map((p) => ({ ...p, re: compileRule(p.re, 'd') })),
    };
    compiled.set(rule, c);
  }
  return c;
}

export function detectBank(raw, { rules = BANK_RULES, hint = null } = {}) {
  if (hint) {
    const h = fold(String(hint)).toLowerCase().trim();
    const byHint = rules.find((r) => r.id === h || fold(r.name).toLowerCase() === h ||
      compiledRule(r).detect.some((re) => re.test(fold(String(hint)))));
    if (byHint) return byHint;
  }
  const f = fold(normalizeText(raw));
  return rules.find((r) => compiledRule(r).detect.some((re) => re.test(f))) ?? null;
}

// ---------------------------------------------------------------- amounts
const MONEY_RE = new RegExp(`(?<c1>${CUR})\\s?[:.]?\\s?(?<a1>${AMT})|(?<a2>${AMT})\\s?(?<c2>${CUR})`, 'gi');
const KEYWORD_AMOUNT_RE = new RegExp(fold(`(?:amount|amt|value|for|of|مبلغ|بمبلغ|قيمة|بقيمة)\\s*(?:of|:)?\\s*(?<a>${AMT})`), 'i');
const DECIMAL_AMOUNT_RE = new RegExp(`(?<a>(?<![\\d.,])\\d{1,3}(?:,\\d{3})*\\.\\d{2}(?![\\d]))`);

function findMoney(f) {
  for (const m of f.matchAll(MONEY_RE)) {
    const g = m.groups;
    const amount = parseAmount(g.a1 ?? g.a2);
    const currency = currencyFromAlias(g.c1 ?? g.c2);
    if (amount > 0 && currency) return { amount, currency };
  }
  const k = KEYWORD_AMOUNT_RE.exec(f) ?? DECIMAL_AMOUNT_RE.exec(f);
  if (k) {
    const amount = parseAmount(k.groups.a);
    if (amount > 0) return { amount, currency: null };
  }
  return null;
}

// ---------------------------------------------------------------- type
function firstIndex(patterns, f) {
  let best = Infinity;
  for (const re of patterns) {
    const m = re.exec(f);
    if (m && m.index < best) best = m.index;
  }
  return best;
}

function findType(f) {
  const inc = firstIndex(INCOME, f);
  const exp = firstIndex(EXPENSE, f);
  if (inc === Infinity && exp === Infinity) return null;
  return inc < exp ? 'income' : 'expense';
}

// ---------------------------------------------------------------- merchant
const STOPS = new Set(MERCHANT_STOPS.map((w) => fold(w).toLowerCase()));
const NOT_FIRST = new Set(NOT_MERCHANT_WORDS.map((w) => fold(w).toLowerCase()));

function leadPattern(lead) {
  const f = fold(lead);
  const body = escapeRegExp(f);
  if (/^[a-z]+$/i.test(f)) return `(?<![A-Za-z])${body}\\s+`;
  if (new RegExp(`[${AR}]`).test(f)) return `(?<![${AR}])${body}\\s+`;
  return `${body}\\s*`;
}
const leadRe = (leads) => new RegExp(`(?:${leads.map(leadPattern).join('|')})(?<m>[^|,;\\n()]+)`, 'gi');
const MERCHANT_TIERS = [leadRe(MERCHANT_LEADS_STRONG), leadRe(MERCHANT_LEADS_WEAK)];

export function cleanMerchant(raw) {
  if (!raw) return null;
  const out = [];
  for (const tok of raw.trim().split(/\s+/)) {
    const ft = fold(tok).toLowerCase().replace(/[.:]+$/, '');
    if (STOPS.has(ft)) break;
    if (/^\d{1,2}[/.-]\d{1,2}/.test(tok) || /^\d{1,2}:\d{2}/.test(tok)) break; // date or time
    if (out.length && currencyFromAlias(tok)) break;
    out.push(tok);
  }
  let m = out.join(' ')
    .replace(/\d{4,}/g, ' ')
    .replace(/[*#|]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-:.'"]+|[\s\-:.,'"]+$/g, '')
    .trim();
  if (m.length > 40) m = m.slice(0, 40).replace(/\s+\S*$/, '').trim() || m.slice(0, 40);
  if (!new RegExp(`[A-Za-z${AR}].*[A-Za-z${AR}]`).test(m)) return null;
  const first = fold(m.split(' ')[0]).toLowerCase();
  if (NOT_FIRST.has(first) || /^(?:بطاق|حساب|الحساب|البطاق)/.test(first)) return null;
  if (currencyFromAlias(m)) return null;
  return m;
}

function findMerchant(f, clean) {
  for (const re of MERCHANT_TIERS) {
    for (const m of f.matchAll(re)) {
      const start = m.index + m[0].length - m.groups.m.length;
      const merchant = cleanMerchant(clean.slice(start, m.index + m[0].length));
      if (merchant) return merchant;
    }
  }
  return null;
}

// ---------------------------------------------------------------- date
const MONTH_NAMES = Object.keys(MONTHS).map((k) => fold(k)).sort((a, b) => b.length - a.length);
const MONTH_LOOKUP = new Map(Object.entries(MONTHS).map(([k, v]) => [fold(k).toLowerCase(), v]));
const MON = `(?<mon>${MONTH_NAMES.map(escapeRegExp).join('|')})[a-z]*\\.?(?![A-Za-z${AR}])`;

const DATE_PATTERNS = [
  { re: /(?<!\d)(?<y>\d{4})[-/.](?<m>\d{1,2})[-/.](?<d>\d{1,2})(?!\d)/g },
  { re: /(?<![\d.,])(?<d>\d{1,2})[-/.](?<m>\d{1,2})[-/.](?<y>\d{4}|\d{2})(?![\d:]|\.\d)/g },
  { re: new RegExp(`(?<!\\d)(?<d>\\d{1,2})(?:st|nd|rd|th)?[\\s-]*${MON}[\\s,-]*(?<y>\\d{4}|\\d{2})?(?![\\d:])`, 'gi') },
  { re: new RegExp(`${MON}\\s+(?<d>\\d{1,2})(?:st|nd|rd|th)?,?\\s+(?<y>\\d{4})(?!\\d)`, 'gi') },
  { re: /(?<![\d.,/-])(?<d>\d{1,2})[/-](?<m>\d{1,2})(?![\d/.-])/g, noYear: true },
];

const pad = (n) => String(n).padStart(2, '0');
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function validDate(y, m, d) {
  if (!(y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1)) return null;
  const dt = new Date(y, m - 1, d);
  return dt.getMonth() === m - 1 ? dt : null;
}

function dateFromGroups(g, now, noYear) {
  let m = g.m ? Number(g.m) : MONTH_LOOKUP.get(fold(g.mon).toLowerCase());
  let d = Number(g.d);
  let y = g.y ? Number(g.y) : now.getFullYear();
  if (y < 100) y += 2000;
  if (g.m && m > 12 && d <= 12) [d, m] = [m, d]; // month-first (US style)
  let dt = validDate(y, m, d);
  if (!dt) return null;
  const limit = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (dt > limit) {
    if (noYear || !g.y) dt = validDate(y - 1, m, d);
    else return null;
  }
  return dt;
}

export function findDate(input, now = new Date()) {
  const text = fold(input ?? '');
  let best = null;
  for (const { re, noYear } of DATE_PATTERNS) {
    for (const m of text.matchAll(re)) {
      if (best && m.index >= best.index) break;
      const dt = dateFromGroups(m.groups, now, noYear);
      if (dt) {
        best = { index: m.index, date: isoDate(dt) };
        break;
      }
    }
  }
  return best?.date ?? null;
}

// ---------------------------------------------------------------- bridge line
// When the app is opened in Safari instead of the installed app, it can hand
// over a cleaned one-line summary via the clipboard (see README). Format:
//   MP1;expense;120.50;QAR;2026-10-18;MERCHANT NAME
const BRIDGE_RE = /^MP1;(expense|income);(\d+(?:\.\d+)?);([A-Z]{3});(\d{4}-\d{2}-\d{2}|);(.*)$/;

export function formatBridgeLine(r) {
  const merchant = (r.merchant ?? '').replace(/[;\n]/g, ' ').trim();
  return `MP1;${r.type};${r.amount};${r.currency ?? ''};${r.date ?? ''};${merchant}`;
}

function parseBridge(base) {
  const m = BRIDGE_RE.exec(base.trim());
  if (!m) return null;
  return {
    ok: true, bank: null, bankName: null,
    type: m[1], amount: Number(m[2]), currency: m[3], date: m[4] || null, merchant: cleanMerchant(m[5]),
    guessed: { type: false, currency: false, date: !m[4] },
  };
}

// ---------------------------------------------------------------- main
/**
 * @param {string} raw  the SMS text (never stored)
 * @param {object} [opts]
 * @param {Date}   [opts.now]              reference "today"
 * @param {string} [opts.defaultCurrency]  used when neither message nor bank gives one
 * @param {string} [opts.bankHint]         sender name, if known (e.g. "QNB")
 * @param {Array}  [opts.rules]            bank rule table (defaults to BANK_RULES)
 */
export function parseSms(raw, { now = new Date(), defaultCurrency = null, bankHint = null, rules = BANK_RULES } = {}) {
  const base = normalizeText(raw);
  if (!base) return { ok: false, reason: 'empty' };

  const bridge = parseBridge(base);
  if (bridge) return bridge;

  const bank = detectBank(base, { rules, hint: bankHint });
  if (isOtpMessage(base, bank)) return { ok: false, reason: 'otp' };

  const clean = redact(base);
  const f = fold(clean);
  const out = { type: null, amount: null, currency: null, merchant: null, date: null };

  for (const p of bank ? compiledRule(bank).patterns : []) {
    const m = p.re.exec(f);
    if (!m) continue;
    const g = m.groups ?? {};
    const slice = (name) => (m.indices?.groups?.[name] ? clean.slice(...m.indices.groups[name]) : null);
    if (g.amount) out.amount = parseAmount(g.amount);
    if (g.currency) out.currency = currencyFromAlias(g.currency) ?? (/^[A-Z]{3}$/i.test(g.currency) ? g.currency.toUpperCase() : null);
    if (g.merchant) out.merchant = cleanMerchant(slice('merchant'));
    if (g.date) out.date = findDate(slice('date'), now);
    if (p.type) out.type = p.type;
    break;
  }

  if (!(out.amount > 0)) {
    const money = findMoney(f);
    if (money) {
      out.amount = money.amount;
      out.currency ??= money.currency;
    }
  }
  if (!(out.amount > 0) || out.amount >= 1e10) return { ok: false, reason: 'no_amount' };

  const guessed = { type: false, currency: false, date: false };
  if (!out.currency) {
    out.currency = bank?.defaultCurrency ?? defaultCurrency ?? null;
    guessed.currency = true;
  }
  if (!out.type) {
    out.type = findType(f);
    if (!out.type) {
      out.type = 'expense';
      guessed.type = true;
    }
  }
  out.merchant ??= findMerchant(f, clean);
  out.date ??= findDate(clean, now);
  if (!out.date) {
    out.date = isoDate(now);
    guessed.date = true;
  }

  return {
    ok: true,
    bank: bank?.id ?? null,
    bankName: bank?.name ?? null,
    type: out.type,
    amount: Math.round(out.amount * 1000) / 1000,
    currency: out.currency,
    merchant: out.merchant,
    date: out.date,
    guessed,
  };
}
