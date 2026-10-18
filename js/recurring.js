// Finds likely subscriptions / recurring payments: the same merchant, a
// similar amount, roughly once a month. The user confirms or dismisses each.

import { parseDate, isoDate } from './finance.js';

const DAY = 86_400_000;

export function merchantKey(merchant) {
  return String(merchant ?? '')
    .toLowerCase()
    .replace(/[\d*#]+/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * @param transactions  all transactions
 * @param opts.minCount      minimum occurrences (default 3)
 * @param opts.amountTolerance  allowed relative difference from the median amount (default 0.15)
 * @returns [{ key, merchant, currency, amount, count, intervalDays, lastDate, nextDate, categoryId }]
 */
export function detectRecurring(transactions, { minCount = 3, amountTolerance = 0.15 } = {}) {
  const groups = new Map();
  for (const tx of transactions) {
    if (tx.type !== 'expense' || !tx.merchant) continue;
    const mk = merchantKey(tx.merchant);
    if (!mk) continue;
    const key = `${mk}|${tx.currency}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(tx);
  }

  const out = [];
  for (const [key, txs] of groups) {
    // one entry per day, newest last; look at the latest 12 occurrences
    const byDay = new Map();
    for (const tx of txs) if (!byDay.has(tx.date)) byDay.set(tx.date, tx);
    const list = [...byDay.values()].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-12);
    if (list.length < minCount) continue;

    const amounts = list.map((t) => Number(t.amount));
    const med = median(amounts);
    const similar = amounts.filter((a) => Math.abs(a - med) <= med * amountTolerance).length;
    if (similar / amounts.length < 0.75) continue;

    const intervals = [];
    for (let i = 1; i < list.length; i++) {
      intervals.push((parseDate(list[i].date) - parseDate(list[i - 1].date)) / DAY);
    }
    const medInt = median(intervals);
    const monthly = intervals.filter((d) => d >= 20 && d <= 40).length;
    if (medInt < 26 || medInt > 35 || monthly / intervals.length < 0.7) continue;

    const last = list.at(-1);
    out.push({
      key,
      merchant: last.merchant,
      currency: last.currency,
      amount: Math.round(med * 100) / 100,
      count: list.length,
      intervalDays: Math.round(medInt),
      lastDate: last.date,
      nextDate: isoDate(new Date(parseDate(last.date).getTime() + Math.round(medInt) * DAY)),
      categoryId: last.categoryId,
    });
  }
  return out.sort((a, b) => b.amount - a.amount);
}
