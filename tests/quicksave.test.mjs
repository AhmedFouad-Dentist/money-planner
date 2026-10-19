import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planQuickSave } from '../js/quicksave.js';
import { parseQuickText } from '../js/nlp/quicktext.js';
import { createInitialState } from '../js/model.js';

const now = new Date(2026, 9, 19);
const state = () => ({ ...createInitialState({ reportCurrency: 'QAR', currencies: ['QAR', 'EGP', 'GBP', 'USD'] }), rates: { QAR: 1, EGP: 13, GBP: 0.2, USD: 0.27 } });
const plan = (text, st = state()) => planQuickSave(parseQuickText(text, { defaultCurrency: st.settings.defaultCurrency, now }), st, { now });

test('"قهوة 15" is saved straight away with category and default currency', () => {
  const p = plan('قهوة 15');
  assert.equal(p.action, 'tx');
  assert.equal(p.record.amount, 15);
  assert.equal(p.record.currency, 'QAR');
  assert.equal(p.record.categoryId, 'dining');
  assert.equal(p.record.merchant, 'قهوة');
  assert.equal(p.record.date, '2026-10-19');
  assert.equal(p.record.rate, 1);
});

test('English item is tidied, unknown items fall back to Other, income works', () => {
  assert.equal(plan('coffee 15').record.merchant, 'Coffee');
  const other = plan('widget 12');
  assert.equal(other.record.categoryId, 'other-expense');
  const inc = plan('+5000 مرتب');
  assert.equal(inc.record.type, 'income');
  assert.equal(inc.record.categoryId, 'salary');
});

test('history beats keywords when guessing the category', () => {
  const st = state();
  st.transactions.push({ id: 'x', type: 'expense', amount: 5, currency: 'QAR', categoryId: 'family', merchant: 'Widget', date: '2026-10-01' });
  assert.equal(plan('widget 12', st).record.categoryId, 'family');
});

test('asks when the amount is missing or unclear', () => {
  assert.deepEqual(plan('قهوة'), { action: 'ask', reason: 'no_amount' });
  assert.deepEqual(plan('2 قهوة 30'), { action: 'ask', reason: 'ambiguous' });
  assert.deepEqual(plan('Your OTP is 1234'), { action: 'ask', reason: 'otp' });
});

test('loan phrases create a loan; repayments apply to the single open loan', () => {
  const st = state();
  const lend = plan('سلفت أحمد 500 ريال', st);
  assert.equal(lend.action, 'loan');
  assert.deepEqual([lend.loan.person, lend.loan.direction, lend.loan.amount, lend.loan.currency], ['أحمد', 'lent', 500, 'QAR']);
  st.loans.push(lend.loan);
  const rep = plan('أحمد رجعلي 200', st);
  assert.equal(rep.action, 'repay');
  assert.equal(rep.loanId, lend.loan.id);
  assert.equal(rep.repayment.amount, 200);
  assert.equal(rep.settles, false);
  assert.equal(plan('أحمد رجعلي 500', st).settles, true);
  // currency said differs from the loan: converted
  assert.equal(plan('أحمد رجعلي 26 جنيه', st).repayment.amount, 2);
  // no loan / two loans: ask
  assert.deepEqual(plan('Omar paid me back 5', st), { action: 'ask', reason: 'no-loan' });
  st.loans.push({ ...lend.loan, id: 'second' });
  assert.deepEqual(plan('أحمد رجعلي 100', st), { action: 'ask', reason: 'which-loan' });
});
