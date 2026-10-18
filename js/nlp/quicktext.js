// Natural-language "quick text" parser for typed or dictated entries, in
// English and Arabic (Egyptian and standard), e.g.
//   "اشتريت قهوة بـ 15 ريال"   "دفعت إيجار 3000 جنيه"   "صرفت 50 باوند بنزين"
//   "I bought groceries for 120 QAR"   "got salary 18000 riyal"
//   "سلفت أحمد 500 ريال"   "اتسلفت من محمد 2000 جنيه"   "محمد رجّعلي 200"
//   "I lent Sara 100 GBP"   "paid back Omar 50 dollars"
//
// Output is only the extracted fields; the text itself is never stored.

import { normalizeText, foldArabic, escapeRegExp, AR } from '../sms/text.js';
import { currencyFromAlias } from '../sms/vocab.js';
import { isOtpMessage, isoDate } from '../sms/parser.js';

const fold = (s) => foldArabic(s).toLowerCase();

// ---------------------------------------------------------------- currencies
// Spoken/colloquial names, checked before the SMS currency list.
const SPOKEN_CURRENCIES = [
  ['GBP', ['جنيه استرليني', 'جنيه إسترليني', 'استرليني', 'إسترليني', 'باوند', 'باوندات', 'بوند', 'pound sterling', 'pounds sterling', 'sterling', 'pounds', 'pound', 'quid', 'gbp', '£']],
  ['EGP', ['جنيه مصري', 'جنيه', 'جنيها', 'جنيهات', 'جنية', 'egyptian pounds', 'egyptian pound', 'egp', 'le']],
  ['QAR', ['ريال قطري', 'ريال', 'ريالا', 'ريالات', 'riyals', 'riyal', 'rials', 'rial', 'qatari riyals', 'qr', 'qar']],
  ['USD', ['دولار', 'دولارا', 'دولارات', 'dollars', 'dollar', 'bucks', 'usd', '$']],
  ['EUR', ['يورو', 'euros', 'euro', 'eur', '€']],
  ['SAR', ['ريال سعودي', 'saudi riyals', 'sar']],
  ['AED', ['درهم', 'دراهم', 'dirhams', 'dirham', 'aed']],
];
const CUR_LIST = SPOKEN_CURRENCIES.flatMap(([code, names]) => names.map((n) => [fold(n), code]))
  .sort((a, b) => b[0].length - a[0].length);

function findCurrency(f) {
  // "egyptian pounds" before "pounds", "ريال سعودي" before "ريال"
  let best = null;
  for (const [name, code] of CUR_LIST) {
    const body = escapeRegExp(name);
    const latin = /^[a-z ]+$/.test(name);
    const re = latin ? new RegExp(`(?<![a-z])${body}(?![a-z])`) : /^[$£€]$/.test(name) ? new RegExp(body) : new RegExp(`(?<![${AR}])(?:ب|بال)?${body}(?![${AR}])`);
    const m = re.exec(f);
    if (m && (!best || m.index < best.index || (m.index === best.index && m[0].length > best.len))) best = { index: m.index, len: m[0].length, code };
  }
  return best;
}

// ---------------------------------------------------------------- numbers
const WORDS = new Map([
  // Arabic (folded; Egyptian and standard)
  ['واحد', 1], ['واحده', 1], ['اتنين', 2], ['اثنين', 2], ['اثنان', 2], ['تلاته', 3], ['ثلاثه', 3], ['تلات', 3], ['ثلاث', 3],
  ['اربعه', 4], ['اربع', 4], ['خمسه', 5], ['خمس', 5], ['سته', 6], ['ست', 6], ['سبعه', 7], ['سبع', 7], ['تمانيه', 8], ['ثمانيه', 8],
  ['تسعه', 9], ['تسع', 9], ['عشره', 10], ['عشر', 10], ['عشرين', 20], ['عشرون', 20], ['تلاتين', 30], ['ثلاثين', 30], ['اربعين', 40], ['خمسين', 50],
  ['ستين', 60], ['سبعين', 70], ['تمانين', 80], ['ثمانين', 80], ['تسعين', 90],
  ['ميه', 100], ['مية', 100], ['مائه', 100], ['مئه', 100], ['ميتين', 200], ['مئتين', 200], ['مائتين', 200], ['تلتميه', 300], ['ثلاثمائه', 300], ['ربعميه', 400], ['خمسميه', 500], ['خمسمائه', 500],
  ['نص', 0.5], ['نصف', 0.5],
  // English
  ['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5], ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9], ['ten', 10],
  ['eleven', 11], ['twelve', 12], ['fifteen', 15], ['twenty', 20], ['thirty', 30], ['forty', 40], ['fifty', 50], ['sixty', 60], ['seventy', 70], ['eighty', 80], ['ninety', 90],
  ['hundred', 100], ['half', 0.5],
].map(([k, v]) => [fold(k), v]));
const THOUSAND = new Set(['الف', 'الاف', 'الفات', 'thousand', 'thousands', 'k'].map(fold));
const TWO_THOUSAND = new Set(['الفين', 'الفان'].map(fold));
const MILLION = new Set(['مليون', 'ملايين', 'million', 'millions'].map(fold));
const CONNECT = new Set(['و', 'and']);

// Splits "بـ15" / "ب15" / "وخمسين" so the number stands alone.
function tokenize(f) {
  return f
    .replace(/(?<![\p{L}])بـ?\s*(?=\d)/gu, ' ')
    .replace(/(\d)([a-zء-ي])/g, '$1 $2')
    .replace(/([a-zء-ي])(\d)/g, '$1 $2')
    .split(/[\s,،؛;:!?()"'«»]+/)
    .filter(Boolean)
    .map((tok) => {
      // strip attached "و" (and), "ب" (for/with) from number words: "وخمسين", "بخمسين"
      for (const p of ['وب', 'و', 'ب', 'بال']) {
        const rest = tok.slice(p.length);
        if (tok.startsWith(p) && (WORDS.has(rest) || THOUSAND.has(rest) || TWO_THOUSAND.has(rest))) return rest;
      }
      return tok;
    });
}

const isNumTok = (t) => /^\d+(?:[.,]\d+)?$/.test(t) || WORDS.has(t) || THOUSAND.has(t) || TWO_THOUSAND.has(t) || MILLION.has(t);
const toNum = (t) => Number(t.replace(/,(\d{3})(?!\d)/g, '$1').replace(',', '.'));

// Reads the first spoken/written amount: "15", "3000", "2.5 ألف", "ألفين", "3 آلاف",
// "18k", "ألف و500", "two hundred and fifty", "خمسمية".
export function findAmount(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    if (!isNumTok(tokens[i]) || CONNECT.has(tokens[i])) continue;
    let total = 0;
    let current = 0;
    let lastMult = 1; // for "ألف ونص" = 1500, "2 ونص" = 2.5
    let used = 0;
    let j = i;
    for (; j < tokens.length; j++) {
      const t = tokens[j];
      if (CONNECT.has(t) && j + 1 < tokens.length && isNumTok(tokens[j + 1]) && used) continue;
      if (/^\d+(?:[.,]\d+)?$/.test(t)) current += toNum(t);
      else if (WORDS.has(t)) {
        const v = WORDS.get(t);
        if (v === 100 && current > 0 && current < 10) current *= 100; // "خمس مية", "two hundred"
        else if (v === 0.5) {
          if (current) current += 0.5;
          else if (total) total += lastMult / 2;
          else current = 0.5;
        } else current += v;
      } else if (THOUSAND.has(t)) {
        total += (current || 1) * 1000;
        current = 0;
        lastMult = 1000;
      } else if (TWO_THOUSAND.has(t)) {
        total += 2000;
        lastMult = 1000;
      } else if (MILLION.has(t)) {
        total += (current || 1) * 1_000_000;
        current = 0;
        lastMult = 1_000_000;
      } else break;
      used++;
    }
    const value = total + current;
    if (value > 0) return { value, start: i, end: j };
  }
  return null;
}

// ---------------------------------------------------------------- intent
const NAME = `([\\p{L}][\\p{L}'’-]*)`;

// Loan phrases. The person's name is the first non-empty capture group.
const LOAN_PATTERNS = [
  // I borrowed (I owe them)
  { action: 'borrow', re: new RegExp(foldArabic(`(?:اتسلفت|استلفت|تسلفت|اسلفت|اقترضت|استدنت|خدت سلف[هة]?|اخدت سلف[هة]?)(?:\\s+[\\d.,]+(?:\\s+[\\p{L}]+)?)?\\s+من\\s+${NAME}`), 'iu') },
  { action: 'borrow', re: new RegExp(`\\bborrow(?:ed)?\\b.{0,30}?\\bfrom\\s+${NAME}`, 'iu') },
  // They paid me back
  { action: 'repayIn', re: new RegExp(foldArabic(`${NAME}\\s+(?:رجعلي|رجعلى|رجع لي|رجعتلي|رجعت لي|سددلي|سدد لي|سددتلي|دفعلي|ردلي|رد لي)(?![\\p{L}])`), 'iu') },
  { action: 'repayIn', re: new RegExp(`${NAME}\\s+(?:paid|gave|sent)\\s+me\\s+back\\b|${NAME}\\s+(?:repaid|returned)\\s+(?:me|my)\\b|\\bgot\\s+(?:paid\\s+)?back\\b.{0,30}?\\bfrom\\s+${NAME}`, 'iu') },
  // I paid them back
  { action: 'repayOut', re: new RegExp(foldArabic(`(?:رجعت|رديت)\\s+(?:ل|الي|إلى)\\s*${NAME}`), 'iu') },
  { action: 'repayOut', re: new RegExp(`\\b(?:paid|gave|sent)\\s+back\\s+${NAME}|\\b(?:repaid|paid)\\s+${NAME}\\s+back\\b|\\brepaid\\s+${NAME}`, 'iu') },
  // I lent (they owe me)
  { action: 'lend', re: new RegExp(foldArabic(`(?:سلفت|سليفت)\\s+${NAME}`), 'iu') },
  { action: 'lend', re: new RegExp(foldArabic(`(?:اديت|اعطيت|ادّيت)\\s+${NAME}.{0,30}?سلف`), 'iu') },
  { action: 'lend', re: new RegExp(`\\b(?:lent|loaned)\\s+${NAME}`, 'iu') },
];
const NOT_NAMES = new Set(['من', 'لي', 'الي', 'i', 'me', 'my', 'him', 'her', 'them', 'the', 'a', 'an', 'back', 'from', 'to', 'money', 'it', 'was', 'were', 'is', 'فلوس'].map(fold));

const AR_EDGE = (src) => new RegExp(`(?<![\\p{L}])(?:${foldArabic(src)})(?![\\p{L}])`, 'iu');
const INCOME_RE = AR_EDGE('قبضت|استلمت|جالي|جاني|وصلني|نزلي|اتحولي|حولولي|كسبت|ربحت|مرتب|راتب|المرتب|الراتب|got paid|received|receive|earned|earn|income|salary|paycheck|wage|wages|bonus|refund|refunded');
const EXPENSE_RE = AR_EDGE('اشتريت|شريت|دفعت|صرفت|سددت|حاسبت|bought|buy|paid|pay|spent|spend|purchased');
const YESTERDAY_RE = AR_EDGE('امبارح|امس|البارحه|yesterday');

// Words dropped when working out the item/merchant name.
const FILLER = new Set([
  'اشتريت', 'شريت', 'دفعت', 'صرفت', 'سددت', 'حاسبت', 'قبضت', 'استلمت', 'جالي', 'جاني', 'وصلني', 'نزلي', 'كسبت', 'امبارح', 'امس', 'النهارده', 'انهارده', 'اليوم',
  'ب', 'بـ', 'على', 'علي', 'في', 'فى', 'من', 'ل', 'لل', 'عشان', 'علشان', 'حق', 'تمن', 'ثمن', 'مبلغ', 'بمبلغ', 'حوالي', 'يعني', 'انا', 'تقريبا',
  'i', 'we', 'bought', 'buy', 'paid', 'pay', 'spent', 'spend', 'purchased', 'got', 'received', 'earned', 'for', 'on', 'at', 'of', 'a', 'an', 'the', 'some',
  'today', 'yesterday', 'about', 'around', 'my', 'worth', 'to', 'in', 'and', 'with',
].map(fold));

// ---------------------------------------------------------------- category
export const CATEGORY_KEYWORDS = [
  ['housing', 'ايجار|إيجار|الايجار|سكن|شقه|rent|landlord'],
  ['groceries', 'بقاله|سوبر ?ماركت|خضار|خضروات|فاكهه|عيش|لبن|بيض|تموين|groceries|grocery|supermarket|vegetables|fruit|milk|bread'],
  ['dining', 'قهوه|كافيه|مطعم|اكل|غدا|غداء|عشا|عشاء|فطار|فطور|شاي|بيتزا|برجر|كشري|فول|coffee|cafe|café|restaurant|lunch|dinner|breakfast|food|pizza|burger|takeaway|snack'],
  ['transport', 'بنزين|وقود|تاكسي|اوبر|كريم|مواصلات|ميكروباص|مترو|باص|جراج|ركنه|gas|petrol|fuel|taxi|uber|careem|bus|metro|train|parking'],
  ['bills', 'فاتوره|فواتير|كهربا|كهرباء|غاز|نت|انترنت|موبايل|رصيد|شحن|تليفون|electricity|electric|bill|bills|internet|wifi|phone|mobile|water bill|top ?up'],
  ['health', 'دوا|دواء|ادويه|صيدليه|دكتور|كشف|تحاليل|اشعه|مستشفي|عياده|medicine|pharmacy|doctor|clinic|hospital|dentist|lab'],
  ['shopping', 'هدوم|لبس|ملابس|جزمه|شنطه|clothes|shoes|clothing|shopping|amazon|noon'],
  ['education', 'كورس|امتحان|كتاب|كتب|دراسه|جامعه|مدرسه|course|exam|book|books|tuition|school|university|ore|gdc|ielts|oet'],
  ['travel', 'تذكره|تذاكر|طياره|طيران|فندق|سفر|رحله|flight|ticket|hotel|airbnb|travel|trip'],
  ['family', 'اهلي|ماما|بابا|اخويا|اختي|العيله|العائله|مصروف البيت|family|mum|mom|dad|parents'],
  ['subscriptions', 'اشتراك|netflix|spotify|subscription|icloud|youtube|shahid'],
  ['salary', 'مرتب|راتب|المرتب|الراتب|salary|paycheck|wage|wages'],
  ['freelance', 'شغل اضافي|فريلانس|عياده خاصه|freelance|side job|extra work|bonus|overtime'],
  ['gift', 'هديه|عيديه|gift|present'],
  ['refund', 'مرتجع|استرداد|refund|refunded'],
].map(([id, src]) => [id, new RegExp(`(?:^|[^\\p{L}])(?:ال|بال|لل|و)?(?:${foldArabic(src)})(?:$|[^\\p{L}])`, 'iu')]);

const INCOME_CATS = new Set(['salary', 'freelance', 'gift', 'refund']);

export function guessCategory(text, type) {
  const f = fold(normalizeText(text ?? ''));
  for (const [id, re] of CATEGORY_KEYWORDS) {
    if (INCOME_CATS.has(id) !== (type === 'income')) continue;
    if (re.test(f)) return id;
  }
  return null;
}

// ---------------------------------------------------------------- main
function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/**
 * @returns {ok:false, reason:'empty'|'otp'|'no_amount'}
 *        | {ok:true, kind:'tx', type, amount, currency, currencyGuessed, item, categoryId, date}
 *        | {ok:true, kind:'loan', action:'lend'|'borrow'|'repayIn'|'repayOut', person, amount, currency, currencyGuessed, date}
 */
export function parseQuickText(raw, { defaultCurrency = null, now = new Date() } = {}) {
  const base = normalizeText(raw);
  if (!base) return { ok: false, reason: 'empty' };
  if (isOtpMessage(base)) return { ok: false, reason: 'otp' };
  const f = fold(base).replace(/\n/g, ' ');

  const tokens = tokenize(f);
  const amt = findAmount(tokens);
  if (!amt) return { ok: false, reason: 'no_amount' };

  const cur = findCurrency(f);
  const currency = cur?.code ?? defaultCurrency ?? null;
  const date = isoDate(YESTERDAY_RE.test(f) ? addDays(now, -1) : now);
  const amount = Math.round(amt.value * 1000) / 1000;

  for (const p of LOAN_PATTERNS) {
    const m = p.re.exec(f);
    if (!m) continue;
    const nameFolded = m.slice(1).find(Boolean);
    if (!nameFolded || NOT_NAMES.has(nameFolded) || /^\d/.test(nameFolded) || currencyFromAlias(nameFolded)) continue;
    // recover the original spelling of the name (folding keeps positions)
    const start = f.indexOf(nameFolded, m.index);
    const person = base.replace(/\n/g, ' ').slice(start, start + nameFolded.length);
    return { ok: true, kind: 'loan', action: p.action, person: capitalize(person), amount, currency, currencyGuessed: !cur, date };
  }

  const isIncome = INCOME_RE.test(f) && !(EXPENSE_RE.exec(f)?.index < INCOME_RE.exec(f).index);
  const type = isIncome ? 'income' : 'expense';

  // item = what's left after removing the amount, currency and filler words
  const curName = cur ? f.substr(cur.index, cur.len) : null;
  const itemWords = tokens.filter((tok, i) => (i < amt.start || i >= amt.end) && !FILLER.has(tok) && !(curName && fold(curName).split(' ').includes(tok.replace(/^(?:ب|بال)/, ''))) && !findCurrencyWord(tok));
  const original = new Map(tokenize(base.toLowerCase()).map((t) => [fold(t), t]));
  let item = itemWords.map((w) => restoreCase(original.get(w) ?? w, base)).join(' ').trim().slice(0, 40) || null;
  if (item && !/[\p{L}]{2}/u.test(item)) item = null;

  return {
    ok: true, kind: 'tx', type, amount, currency, currencyGuessed: !cur,
    item, categoryId: guessCategory(base, type), date,
  };
}

function findCurrencyWord(tok) {
  return CUR_LIST.some(([name]) => name === tok || `ب${name}` === tok || `بال${name}` === tok);
}

function capitalize(s) {
  return /^[a-z]/.test(s) ? s[0].toUpperCase() + s.slice(1) : s;
}

function restoreCase(word, base) {
  const i = base.toLowerCase().indexOf(word);
  return i >= 0 ? base.substr(i, word.length) : word;
}
