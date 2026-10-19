// Decides what happens when the user types (or says) something like "قهوة 15":
// save it straight away, or ask because something is missing or unclear.
// Pure function — the screens apply the plan.

import { suggestCategory } from './categorize.js';
import { OTHER_CATEGORY, uid } from './model.js';
import { openLoansWith, loanRemaining, convert, rateOf } from './finance.js';

const tidy = (s) => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : null);

/**
 * @returns {action:'ask', reason}
 *        | {action:'tx', record}
 *        | {action:'loan', loan}
 *        | {action:'repay', loanId, repayment, settles}
 */
export function planQuickSave(r, state, { now = new Date() } = {}) {
  if (!r?.ok) return { action: 'ask', reason: r?.reason ?? 'empty' };
  if (r.ambiguous) return { action: 'ask', reason: 'ambiguous' };
  const dc = state.settings.defaultCurrency;

  if (r.kind === 'tx') {
    const currency = r.currency ?? dc;
    const merchant = tidy(r.item);
    const categoryId = r.categoryId
      ?? suggestCategory(merchant, r.type, state.transactions, state.categories)
      ?? OTHER_CATEGORY[r.type];
    return {
      action: 'tx',
      record: {
        id: uid(), type: r.type, amount: r.amount, currency, rate: rateOf(state.rates, currency),
        categoryId, merchant, date: r.date, note: null, source: 'text', createdAt: now.toISOString(),
      },
    };
  }

  if (r.action === 'lend' || r.action === 'borrow') {
    return {
      action: 'loan',
      loan: {
        id: uid(), person: r.person, direction: r.action === 'lend' ? 'lent' : 'borrowed', amount: r.amount,
        currency: r.currency ?? dc, date: r.date, dueDate: null, note: null, repayments: [], settledAt: null,
      },
    };
  }

  // a repayment: only automatic when there is exactly one open loan with that person
  const open = openLoansWith(state, r.person, r.action === 'repayIn' ? 'lent' : 'borrowed');
  if (open.length !== 1) return { action: 'ask', reason: open.length ? 'which-loan' : 'no-loan' };
  const loan = open[0];
  const amount = r.currencyGuessed || !r.currency || r.currency === loan.currency
    ? r.amount
    : Math.round(convert(r.amount, r.currency, loan.currency, state.rates) * 100) / 100;
  return {
    action: 'repay',
    loanId: loan.id,
    repayment: { id: uid(), amount, date: r.date, note: null },
    settles: amount >= loanRemaining(loan) - 0.004,
  };
}
