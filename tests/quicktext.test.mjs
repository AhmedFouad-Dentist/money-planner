// Quick text / voice entry parser. All examples are made up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuickText, guessCategory } from '../js/nlp/quicktext.js';

const now = new Date(2026, 9, 18);
const p = (text, defaultCurrency = 'QAR') => parseQuickText(text, { defaultCurrency, now });
const tx = (text, expected, dc) => {
  const r = p(text, dc);
  assert.equal(r.ok, true, `${text} → ${JSON.stringify(r)}`);
  assert.equal(r.kind, 'tx', text);
  for (const [k, v] of Object.entries(expected)) assert.deepEqual(r[k], v, `${k} for "${text}"`);
  return r;
};
const loan = (text, expected) => {
  const r = p(text);
  assert.equal(r.kind, 'loan', `${text} → ${JSON.stringify(r)}`);
  for (const [k, v] of Object.entries(expected)) assert.deepEqual(r[k], v, `${k} for "${text}"`);
  return r;
};

test("owner's examples", () => {
  tx('اشتريت قهوة بـ 15 ريال', { type: 'expense', amount: 15, currency: 'QAR', item: 'قهوة', categoryId: 'dining' });
  tx('دفعت إيجار 3000 جنيه', { type: 'expense', amount: 3000, currency: 'EGP', item: 'إيجار', categoryId: 'housing' });
  tx('صرفت 50 باوند بنزين', { type: 'expense', amount: 50, currency: 'GBP', item: 'بنزين', categoryId: 'transport' });
  tx('I bought groceries for 120 QAR', { type: 'expense', amount: 120, currency: 'QAR', item: 'groceries', categoryId: 'groceries' });
  tx('got salary 18000 riyal', { type: 'income', amount: 18000, currency: 'QAR', item: 'salary', categoryId: 'salary' });
});

test('Arabic-Indic digits and number words', () => {
  tx('دفعت ٢ ألف جنيه إيجار', { amount: 2000, currency: 'EGP' });
  tx('صرفت ألفين جنيه على الكورس', { amount: 2000, categoryId: 'education' });
  tx('قبضت المرتب 15 ألف ريال', { type: 'income', amount: 15000, categoryId: 'salary' });
  tx('دفعت ألف ونص جنيه كهربا', { amount: 1500, categoryId: 'bills' });
  tx('صرفت خمسمية جنيه فطار', { amount: 500, categoryId: 'dining' });
  tx('دفعت 3 آلاف جنيه', { amount: 3000 });
  tx('paid two hundred and fifty dollars for a hotel', { amount: 250, currency: 'USD', categoryId: 'travel' });
  tx('spent 2.5k pounds on a flight', { amount: 2500, currency: 'GBP', categoryId: 'travel' });
  tx('one thousand riyal rent', { amount: 1000, currency: 'QAR', categoryId: 'housing' });
  tx('اشتريت دوا بـ٣٥٠ جنيه', { amount: 350, categoryId: 'health' });
});

test('currency words, and the default when none is said', () => {
  tx('اشتريت هدوم بـ 40 استرليني', { currency: 'GBP' });
  tx('دفعت 20 جنيه استرليني تاكسي', { currency: 'GBP', categoryId: 'transport' });
  tx('coffee 18 dollars', { currency: 'USD' });
  const r = tx('اشتريت عيش بـ 10', { currency: 'EGP', currencyGuessed: true }, 'EGP');
  assert.equal(r.item, 'عيش');
});

test('date: yesterday', () => {
  tx('صرفت 100 ريال امبارح غدا', { date: '2026-10-17' });
  tx('spent 30 QAR on lunch yesterday', { date: '2026-10-17' });
  tx('spent 30 QAR on lunch', { date: '2026-10-18' });
});

test('loan phrases', () => {
  loan('سلفت أحمد 500 ريال', { action: 'lend', person: 'أحمد', amount: 500, currency: 'QAR' });
  loan('اتسلفت من محمد 2000 جنيه', { action: 'borrow', person: 'محمد', amount: 2000, currency: 'EGP' });
  loan('محمد رجّعلي 200', { action: 'repayIn', person: 'محمد', amount: 200, currencyGuessed: true });
  loan('I lent Sara 100 GBP', { action: 'lend', person: 'Sara', amount: 100, currency: 'GBP' });
  loan('paid back Omar 50 dollars', { action: 'repayOut', person: 'Omar', amount: 50, currency: 'USD' });
  loan('رجعت لعلي 300 ريال', { action: 'repayOut', person: 'علي' });
  loan('borrowed 200 dollars from Ali', { action: 'borrow', person: 'Ali' });
  loan('Sara paid me back 20', { action: 'repayIn', person: 'Sara' });
  loan('استلفت 1000 جنيه من خالد', { action: 'borrow', person: 'خالد', amount: 1000 });
  // plain purchases are not loans
  assert.equal(p('paid my car loan 500 riyal').kind, 'tx');
  assert.equal(p('دفعت للبقال 50 جنيه').kind, 'tx');
});

test('refusals', () => {
  assert.deepEqual(p('Your OTP is 123456'), { ok: false, reason: 'otp' });
  assert.deepEqual(p('اشتريت عيش'), { ok: false, reason: 'no_amount' });
  assert.deepEqual(p('   '), { ok: false, reason: 'empty' });
});

test('guessCategory on its own', () => {
  assert.equal(guessCategory('netflix', 'expense'), 'subscriptions');
  assert.equal(guessCategory('عيدية', 'income'), 'gift');
  assert.equal(guessCategory('something else', 'expense'), null);
});
