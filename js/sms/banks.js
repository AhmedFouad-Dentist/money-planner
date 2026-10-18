// Per-bank rule table for the SMS parser.
//
// HOW TO ADD OR TUNE A BANK (no programming experience needed beyond copying):
//   1. Copy one of the entries below and change `id`, `name`, `country`,
//      `defaultCurrency` and `detect` (words that appear in that bank's messages).
//   2. Optionally add `patterns`: a regular expression for one exact message
//      format. Name the parts you want with (?<amount>...), (?<currency>...),
//      (?<merchant>...) and (?<date>...). Set `type` to 'expense' or 'income'.
//      Anything a pattern does not capture is filled in by the generic rules.
//   3. Optionally add `safeDisclaimers`: exact sentences this bank appends to
//      normal purchase messages (e.g. "Never share your OTP with anyone") that
//      would otherwise make the parser refuse the message as an OTP.
//   4. Add a FAKE test message to tests/sms-parser.test.mjs and run `npm test`.
//
// Arabic can be written normally — hamza and taa marbuta variants are folded
// automatically. Entries are checked from top to bottom, so put more specific
// banks first (e.g. "QNB ALAHLI" in Egypt before "QNB" in Qatar).
//
// NOTE: the patterns below are ILLUSTRATIVE formats written for the synthetic
// test messages, not copies of real bank messages. Tune them with real
// (redacted) samples.

export const BANK_RULES = [
  // ---------------- Egypt ----------------
  {
    id: 'qnb-alahli',
    name: 'QNB ALAHLI',
    country: 'EG',
    defaultCurrency: 'EGP',
    detect: [/\bQNB\s*AL\s*AHLI\b/i, /\bQNBAA\b/i, /كيو إن بي الأهلي/],
    patterns: [],
  },
  {
    id: 'cib',
    name: 'CIB',
    country: 'EG',
    defaultCurrency: 'EGP',
    detect: [/\bCIB\b/i, /البنك التجاري الدولي/],
    patterns: [
      {
        type: 'expense',
        re: /was charged for (?<currency>[A-Z]{3}) (?<amount>[\d,]+(?:\.\d+)?) at (?<merchant>.+?) on (?<date>\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      },
    ],
  },
  {
    id: 'nbe',
    name: 'NBE',
    country: 'EG',
    defaultCurrency: 'EGP',
    detect: [/\bNBE\b/i, /البنك الأهلي المصري/, /الأهلي المصري/],
    patterns: [
      {
        type: 'expense',
        re: /تم خصم (?:مبلغ )?(?<amount>[\d,]+(?:\.\d+)?) (?<currency>جنيه|ج\.م|EGP|دولار|USD) .*?لدى (?<merchant>.+?) في (?<date>\d{1,2}\/\d{1,2}\/\d{2,4})/,
      },
    ],
  },
  {
    id: 'banque-misr',
    name: 'Banque Misr',
    country: 'EG',
    defaultCurrency: 'EGP',
    detect: [/\bBanque\s*Misr\b/i, /بنك مصر/],
    patterns: [],
  },

  // ---------------- Qatar ----------------
  {
    id: 'qnb',
    name: 'QNB',
    country: 'QA',
    defaultCurrency: 'QAR',
    detect: [/\bQNB\b/i, /بنك قطر الوطني/],
    patterns: [
      {
        type: 'expense',
        re: /purchase of (?<currency>[A-Z]{3}) ?(?<amount>[\d,]+(?:\.\d+)?) .*?at (?<merchant>.+?) on (?<date>\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
      },
    ],
    safeDisclaimers: [],
  },
  {
    id: 'cbq',
    name: 'Commercial Bank (CBQ)',
    country: 'QA',
    defaultCurrency: 'QAR',
    detect: [/\bCBQ\b/i, /Commercial\s*Bank/i, /البنك التجاري/],
    patterns: [],
  },
  {
    id: 'qib',
    name: 'QIB',
    country: 'QA',
    defaultCurrency: 'QAR',
    detect: [/\bQIB\b/i, /مصرف قطر الإسلامي/],
    patterns: [],
  },
  {
    id: 'dohabank',
    name: 'Doha Bank',
    country: 'QA',
    defaultCurrency: 'QAR',
    detect: [/\bDoha\s*Bank\b/i, /بنك الدوحة/],
    patterns: [],
  },

  // ---------------- UK ----------------
  {
    id: 'uk-generic',
    name: 'UK bank',
    country: 'GB',
    defaultCurrency: 'GBP',
    detect: [/\b(?:Monzo|Starling|Revolut|Barclays|HSBC UK|Lloyds|NatWest|Santander UK|Nationwide)\b/i],
    patterns: [],
  },
];
