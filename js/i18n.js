// Language, number/date formatting and theme.

import { STRINGS } from './strings.js';

let lang = 'en';
export const getLang = () => lang;
export const isRtl = () => lang === 'ar';

export function setLang(l) {
  lang = l === 'ar' ? 'ar' : 'en';
  const root = document.documentElement;
  root.lang = lang;
  root.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.title = t('app.name');
}

export function t(key, vars) {
  let s = STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  return s;
}

// Arabic text with Western digits reads most clearly for money.
const locale = () => (lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB');

const cache = new Map();
function nf(opts) {
  const k = locale() + JSON.stringify(opts);
  if (!cache.has(k)) cache.set(k, new Intl.NumberFormat(locale(), opts));
  return cache.get(k);
}

const BIDI_MARKS = /[\u200e\u200f\u061c]/g;
const AR_SYMBOLS = ['EGP', 'QAR', 'SAR', 'AED', 'KWD'];

export function money(amount, ccy, { decimals, signed = false } = {}) {
  const v = Number(amount) || 0;
  const d = decimals ?? (Math.abs(v) >= 1000 ? 0 : 2);
  // Arabic symbols for other currencies are ambiguous (e.g. "UK£"), so use the code.
  const currencyDisplay = lang === 'ar' && !AR_SYMBOLS.includes(ccy) ? 'code' : 'symbol';
  let out;
  try {
    out = nf({ style: 'currency', currency: ccy, currencyDisplay, minimumFractionDigits: d, maximumFractionDigits: d }).format(Math.abs(v));
  } catch {
    out = `${nf({ minimumFractionDigits: d, maximumFractionDigits: d }).format(Math.abs(v))} ${ccy}`;
  }
  const sign = v < 0 ? '−' : signed && v > 0 ? '+' : '';
  // Show amounts left-to-right inside Arabic text so the sign stays in front.
  return `\u2066${sign}${out.replace(BIDI_MARKS, '')}\u2069`;
}

export function num(n, d = 2) {
  return nf({ maximumFractionDigits: d }).format(Number(n) || 0);
}

export function pct(x, d = 0, signed = false) {
  if (x == null || !Number.isFinite(x)) return '—';
  const s = nf({ style: 'percent', minimumFractionDigits: d, maximumFractionDigits: d }).format(Math.abs(x));
  return `\u2066${x < 0 ? '−' : signed && x > 0 ? '+' : ''}${s.replace(BIDI_MARKS, '')}\u2069`;
}

export function fmtDate(iso, { year = 'auto', weekday = false } = {}) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const date = new Date(y, m - 1, d || 1);
  const showYear = year === 'auto' ? y !== new Date().getFullYear() : year;
  return new Intl.DateTimeFormat(locale(), {
    day: 'numeric', month: 'short', ...(showYear ? { year: 'numeric' } : {}), ...(weekday ? { weekday: 'short' } : {}),
  }).format(date);
}

export function monthLabel(key, { short = false } = {}) {
  const [y, m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat(locale(), short ? { month: 'short' } : { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
}

export const nameOf = (item) => item?.names?.[lang] || item?.names?.en || item?.name || '';

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
  const dark = theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#121413' : '#f6f7f5');
}
