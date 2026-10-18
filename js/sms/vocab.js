// Words the SMS parser looks for. Arabic may be written naturally (with hamza,
// taa marbuta, etc.) — it is folded before matching. Add new words freely.

import { foldArabic, escapeRegExp, AR } from './text.js';

// How each currency may appear in a message. Longer aliases win, so
// "جنيه إسترليني" (GBP) is recognised before "جنيه" (EGP).
export const CURRENCY_ALIASES = {
  GBP: ['GBP', '£', 'جنيه إسترليني', 'جنيه استرليني', 'جنيهات إسترلينية', 'إسترليني', 'استرليني', 'pound sterling', 'sterling'],
  QAR: ['QAR', 'QR', 'Q.R.', 'Q.R', 'ريال قطري', 'ريالات قطرية', 'ر.ق.', 'ر.ق', 'ريال', 'ريالا', 'ريالات'],
  EGP: ['EGP', 'LE', 'L.E.', 'L.E', 'E£', 'EG£', 'جنيه مصري', 'جنيها مصريا', 'ج.م.', 'ج.م', 'جم', 'جنيه', 'جنيها', 'جنيهات'],
  USD: ['USD', 'US$', 'US Dollar', '$', 'دولار أمريكي', 'دولار امريكي', 'دولار', 'دولارا', 'دولارات'],
  EUR: ['EUR', '€', 'يورو'],
  SAR: ['SAR', 'ريال سعودي', 'ر.س.', 'ر.س'],
  AED: ['AED', 'درهم إماراتي', 'درهم', 'د.إ.', 'د.إ'],
  KWD: ['KWD', 'دينار كويتي', 'د.ك.', 'د.ك'],
};

// Amount like 1,234.56 / 1234.56 / 1234 (not part of a longer number or a date).
export const AMOUNT_RE_SRC =
  '(?<!\\d)(?<!\\d[.,])(?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,3})?|\\d+(?:\\.\\d{1,3})?)(?!\\d|,\\d|\\.\\d|\\s?[/:]\\s?\\d|-\\d)';

export function parseAmount(s) {
  const n = Number(String(s).replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

const aliasIndex = new Map(); // folded lower-case alias -> code
const aliasList = [];
for (const [code, aliases] of Object.entries(CURRENCY_ALIASES)) {
  for (const a of aliases) {
    const folded = foldArabic(a).toLowerCase();
    if (!aliasIndex.has(folded)) aliasIndex.set(folded, code);
    aliasList.push(folded);
  }
}
aliasList.sort((a, b) => b.length - a.length);

function aliasPattern(a) {
  const body = escapeRegExp(a);
  if (/^[a-z.]+$/i.test(a)) return `(?<![A-Za-z])${body}(?![A-Za-z])`;
  if (new RegExp(`[${AR}]`).test(a)) return `(?<![${AR}])${body}(?![${AR}])`;
  return body; // symbols such as £ $ €
}

export const CURRENCY_RE_SRC = `(?:${aliasList.map(aliasPattern).join('|')})`;

export function currencyFromAlias(raw) {
  if (!raw) return null;
  return aliasIndex.get(foldArabic(raw.trim()).toLowerCase()) ?? null;
}

// Messages containing any of these are refused outright: they carry codes that
// must never be stored or even processed.
export const OTP_PATTERNS = [
  /\bOTP\b/i,
  /\bone[\s-]*time[\s-]*(?:pass(?:word|code)?|pin|code|pwd)\b/i,
  /\b(?:verification|verify|security|authenti[cz]ation|activation|confirmation|login|log-in|sign[\s-]?in|access|secret)\s+(?:code|pin|number|key)\b/i,
  /\bpass\s?code\b/i,
  /\b(?:your|the)\s+code\s*(?:is|:)/i,
  /\bcode\b[^.\n]{0,25}\b\d{4,8}\b/i,
  /\b\d{4,8}\b\s+is\s+your\b/i,
  /\b(?:TAC|TPIN|mPIN|3-?D\s?Secure)\b/i,
  /رمز\s*(?:ال)?(?:تحقق|تأكيد|تفعيل|مرور|دخول|أمان|الأمان|سري|السري|التعريف)/,
  /(?:ال)?رمز\s+(?:ال)?(?:مؤقت|لمرة)/,
  /كلمة\s*(?:ال)?(?:مرور|سر)\s*(?:ال)?(?:مؤقتة|لمرة)/,
  /لمرة\s*واحدة/,
  /(?:ال)?كود\s*(?:ال)?(?:تحقق|تفعيل|تأكيد|سري|دخول)/,
  /(?:ال)?رقم\s*(?:ال)?سري\s*(?:ال)?(?:مؤقت|لمرة)/,
  /رمز[^\d\n]{0,20}\d{4,8}/,
  /كود[^\d\n]{0,20}\d{4,8}/,
  /أو تي بي/,
];

// Words that tell us money came in vs. went out. The earliest match wins.
export const INCOME_PATTERNS = [
  /\b(?:credited|deposited|deposit|received|receipt of|salary|payroll|refund(?:ed)?|reversal|reversed|cash\s?back|incoming|inward)\b/i,
  /\bcredit\b(?!\s*card)/i,
  /إيداع|أودع|إضافة|أضيف|تمت? إضافة|راتب|مرتب|استلام|استلمت|واردة?|مرتجع|استرداد|استرجاع|دائن/,
];
export const EXPENSE_PATTERNS = [
  /\b(?:debited|debit|purchase[ds]?|spent|paid|payment|withdrawn|withdrawal|POS|ATM|charged|used|sent|transferred to|bill)\b/i,
  /خصم|شراء|مشتريات|سحب|دفع|مدين|سداد|صادرة?|تحويل إلى|تحويل الى/,
];

// Phrases before a merchant name. "strong" ones are tried first.
export const MERCHANT_LEADS_STRONG = ['at', '@', 'merchant:', 'merchant', 'لدى', 'عند', 'لصالح'];
export const MERCHANT_LEADS_WEAK = ['from', 'to', 'من', 'إلى', 'الى', 'في'];

// A merchant name ends at one of these (or punctuation / end of line).
export const MERCHANT_STOPS = [
  'on', 'at', 'dated', 'date', 'for', 'via', 'using', 'with', 'ref', 'card', 'value', 'amount', 'avl', 'available', 'bal', 'balance', 'is', 'has', 'was',
  'في', 'بتاريخ', 'تاريخ', 'يوم', 'بمبلغ', 'بقيمة', 'مبلغ', 'قيمة', 'الرصيد', 'رصيد', 'على', 'عن', 'الساعة', 'بواسطة', 'باستخدام', 'رقم', 'المتاح',
];

// A candidate merchant starting with one of these words is not a merchant.
export const NOT_MERCHANT_WORDS = [
  'your', 'you', 'the', 'a', 'an', 'my', 'card', 'account', 'a/c', 'acc', 'acct', 'ac', 'this', 'that', 'us', 'our',
  'بطاقتك', 'بطاقتكم', 'بطاقة', 'البطاقة', 'حساب', 'حسابك', 'حسابكم', 'الحساب', 'تاريخ', 'يوم', 'رقم', 'خلال', 'قبل',
];

export const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  'يناير': 1, 'فبراير': 2, 'مارس': 3, 'أبريل': 4, 'ابريل': 4, 'مايو': 5, 'يونيو': 6, 'يونية': 6, 'يوليو': 7, 'يولية': 7,
  'أغسطس': 8, 'اغسطس': 8, 'سبتمبر': 9, 'أكتوبر': 10, 'اكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12,
};
