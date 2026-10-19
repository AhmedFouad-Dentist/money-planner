// Shape of the app's data and the defaults a new install starts with.

export const SCHEMA_VERSION = 1;

export const KNOWN_CURRENCIES = ['QAR', 'EGP', 'GBP', 'USD'];

// Rough starting exchange rates (units per 1 USD), only so the app works
// offline from day one. They are re-expressed against the user's main currency
// at setup; the user should edit them or tap "Update rates".
export const APPROX_PER_USD = { USD: 1, QAR: 3.64, EGP: 48.5, GBP: 0.75, EUR: 0.86, SAR: 3.75, AED: 3.67, KWD: 0.31 };

// Rates are stored as "units of currency X per 1 unit of the base currency".
export function startingRates(base, codes = Object.keys(APPROX_PER_USD)) {
  const rates = { [base]: 1 };
  const b = APPROX_PER_USD[base];
  if (b) for (const c of codes) if (APPROX_PER_USD[c]) rates[c] = APPROX_PER_USD[c] / b;
  rates[base] = 1;
  return rates;
}

// Fixed categorical order (validated palette); a category keeps its colour.
export const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];

// Main currency guessed from where the phone is (time zone first, then the
// region in the language setting), e.g. Asia/Qatar → QAR, ar-EG → EGP.
const ZONE_CURRENCY = {
  'Asia/Qatar': 'QAR', 'Africa/Cairo': 'EGP', 'Europe/London': 'GBP', 'Asia/Riyadh': 'SAR', 'Asia/Dubai': 'AED', 'Asia/Kuwait': 'KWD',
  'America/New_York': 'USD', 'America/Chicago': 'USD', 'America/Denver': 'USD', 'America/Los_Angeles': 'USD',
};
const REGION_CURRENCY = { QA: 'QAR', EG: 'EGP', GB: 'GBP', SA: 'SAR', AE: 'AED', KW: 'KWD', US: 'USD', DE: 'EUR', FR: 'EUR', IE: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR' };

export function guessMainCurrency({ timeZone, languages } = {}) {
  try {
    timeZone ??= Intl.DateTimeFormat().resolvedOptions().timeZone;
    languages ??= globalThis.navigator?.languages ?? [globalThis.navigator?.language].filter(Boolean);
  } catch {
    /* use what we have */
  }
  if (ZONE_CURRENCY[timeZone]) return ZONE_CURRENCY[timeZone];
  for (const l of languages ?? []) {
    const region = /[-_]([A-Z]{2})\b/i.exec(l)?.[1]?.toUpperCase();
    if (REGION_CURRENCY[region]) return REGION_CURRENCY[region];
  }
  return 'QAR';
}

export function uid() {
  const b = globalThis.crypto.getRandomValues(new Uint8Array(9));
  return [...b].map((x) => x.toString(36).padStart(2, '0')).join('').slice(0, 14);
}

const cat = (id, type, en, ar, icon, color) => ({ id, type, names: { en, ar }, icon, color });

export function defaultCategories() {
  return [
    cat('groceries', 'expense', 'Groceries', 'بقالة وسوبرماركت', '🛒', PALETTE[0]),
    cat('dining', 'expense', 'Eating out', 'مطاعم وقهوة', '🍽️', PALETTE[1]),
    cat('transport', 'expense', 'Transport', 'مواصلات', '🚗', PALETTE[2]),
    cat('housing', 'expense', 'Rent & home', 'سكن وإيجار', '🏠', PALETTE[3]),
    cat('bills', 'expense', 'Bills', 'فواتير', '💡', PALETTE[4]),
    cat('health', 'expense', 'Health', 'صحة', '💊', PALETTE[5]),
    cat('shopping', 'expense', 'Shopping', 'تسوق', '🛍️', PALETTE[6]),
    cat('education', 'expense', 'Exams & courses', 'امتحانات وكورسات', '🎓', PALETTE[7]),
    cat('travel', 'expense', 'Travel', 'سفر', '✈️', PALETTE[0]),
    cat('family', 'expense', 'Family', 'العائلة', '👨‍👩‍👧', PALETTE[1]),
    cat('subscriptions', 'expense', 'Subscriptions', 'اشتراكات', '🔁', PALETTE[2]),
    cat('other-expense', 'expense', 'Other', 'أخرى', '📦', '#898781'),
    cat('salary', 'income', 'Salary', 'الراتب', '💼', PALETTE[0]),
    cat('freelance', 'income', 'Extra work', 'عمل إضافي', '🦷', PALETTE[1]),
    cat('gift', 'income', 'Gifts', 'هدايا', '🎁', PALETTE[2]),
    cat('refund', 'income', 'Refunds', 'مرتجعات', '↩️', PALETTE[3]),
    cat('other-income', 'income', 'Other income', 'دخل آخر', '💰', '#898781'),
  ];
}

export const OTHER_CATEGORY = { expense: 'other-expense', income: 'other-income' };

export function defaultInvestmentTypes() {
  return [
    { id: 'gold', names: { en: 'Gold', ar: 'ذهب' }, icon: '🪙' },
    { id: 'certificates', names: { en: 'Certificates & deposits', ar: 'شهادات وودائع' }, icon: '📜' },
    { id: 'stocks', names: { en: 'Stocks & funds', ar: 'أسهم وصناديق' }, icon: '📈' },
    { id: 'realestate', names: { en: 'Real estate', ar: 'عقارات' }, icon: '🏢' },
    { id: 'crypto', names: { en: 'Crypto', ar: 'عملات رقمية' }, icon: '₿' },
    { id: 'other-inv', names: { en: 'Other', ar: 'أخرى' }, icon: '💼' },
  ];
}

const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * @param opts.currencies       currencies the user works with
 * @param opts.reportCurrency   main currency for net worth and reports (also the
 *                              internal base that exchange rates are stored against)
 * @param opts.defaultCurrency  currency pre-selected when adding a transaction
 * @param opts.goals            goals created during onboarding (may be empty)
 */
export function createInitialState({ lang = 'en', currencies = KNOWN_CURRENCIES, reportCurrency, defaultCurrency, goals = [] } = {}) {
  const base = reportCurrency || currencies[0] || 'USD';
  const enabled = [...new Set([...currencies, base])];
  return {
    v: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    settings: {
      lang,
      baseCurrency: base,
      reportCurrency: base,
      currencies: enabled,
      defaultCurrency: enabled.includes(defaultCurrency) ? defaultCurrency : enabled[0],
      autoLockMinutes: 2,
      backupReminderDays: 14,
      lastBackupAt: null,
      ratesUpdatedAt: null,
      ratesSource: 'default',
    },
    rates: startingRates(base, enabled),
    categories: defaultCategories(),
    transactions: [],
    budgets: [],
    goals: goals.map(newGoal),
    accounts: [],
    liabilities: [],
    loans: [],
    invTypes: defaultInvestmentTypes(),
    holdings: [],
    recurring: { confirmed: [], dismissed: [] },
    snapshots: {},
    alerts: {},
  };
}

/**
 * A goal: the user's own name, amount and currency, an optional target date,
 * and what funds it — 'savings' (cash accounts), 'investments' (holdings) or
 * 'both'. `accounts` / `holdings` are 'all' or a list of ids that count.
 */
export function newGoal(g = {}) {
  return {
    id: g.id ?? uid(),
    name: g.name ?? '',
    target: Number(g.target) || 0,
    currency: g.currency,
    targetDate: g.targetDate || null,
    funding: ['savings', 'investments', 'both'].includes(g.funding) ? g.funding : 'both',
    accounts: Array.isArray(g.accounts) ? g.accounts : 'all',
    holdings: Array.isArray(g.holdings) ? g.holdings : 'all',
    excludeReceivables: !!g.excludeReceivables,
    createdAt: g.createdAt ?? isoToday(),
  };
}

// Brings older or partial data (e.g. from a backup) up to the current shape.
export function migrate(state) {
  const base = state.settings?.baseCurrency || state.settings?.reportCurrency || state.settings?.currencies?.[0] || 'USD';
  const fresh = createInitialState({ currencies: state.settings?.currencies ?? [base], reportCurrency: base });
  const s = { ...fresh, ...state };
  s.settings = { ...fresh.settings, ...(state.settings ?? {}), baseCurrency: base };
  s.rates = { ...fresh.rates, ...(state.rates ?? {}), [base]: 1 };
  s.recurring = { ...fresh.recurring, ...(state.recurring ?? {}) };
  for (const k of ['categories', 'invTypes']) if (!Array.isArray(s[k]) || !s[k].length) s[k] = fresh[k];
  for (const k of ['transactions', 'budgets', 'goals', 'accounts', 'liabilities', 'loans', 'holdings']) if (!Array.isArray(s[k])) s[k] = [];
  for (const k of ['snapshots', 'alerts']) if (!s[k] || typeof s[k] !== 'object') s[k] = {};
  for (const id of Object.values(OTHER_CATEGORY)) {
    if (!s.categories.some((c) => c.id === id)) s.categories.push(fresh.categories.find((c) => c.id === id));
  }
  s.goals = s.goals.map((g) => newGoal({ currency: base, ...g }));
  s.v = SCHEMA_VERSION;
  return s;
}
