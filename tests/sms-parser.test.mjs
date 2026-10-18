// All messages below are FAKE, synthetic examples written for testing.
// They are not copies of real bank messages and contain no real data.
// Card digits 4321 and balance 8,765.43 are planted so we can check that they
// never appear in the parser output.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSms, detectBank, isOtpMessage, redact, formatBridgeLine, findDate } from '../js/sms/parser.js';
import { normalizeText } from '../js/sms/text.js';
import { BANK_RULES } from '../js/sms/banks.js';

const now = new Date(2026, 9, 18, 12, 0); // 18 Oct 2026

const ok = (msg, expected, opts = {}) => {
  const r = parseSms(msg, { now, ...opts });
  assert.equal(r.ok, true, `expected success for: ${msg} — got ${JSON.stringify(r)}`);
  for (const [k, v] of Object.entries(expected)) assert.deepEqual(r[k], v, `${k} for: ${msg}`);
  const out = JSON.stringify(r);
  assert.ok(!out.includes('4321'), `card digits leaked: ${out}`);
  assert.ok(!/8,?765/.test(out), `balance leaked: ${out}`);
  return r;
};

test('English purchase (QNB-style, fake)', () => {
  ok('QNB: Purchase of QAR 125.50 with your card ending 4321 at FAKE MART DOHA on 18/10/2026 14:22. Avl Bal QAR 8,765.43', {
    bank: 'qnb', type: 'expense', amount: 125.5, currency: 'QAR', merchant: 'FAKE MART DOHA', date: '2026-10-18',
  });
});

test('English credit card charge with limit (CIB-style, fake)', () => {
  ok('CIB: Your credit card **4321 was charged for EGP 1,250.00 at TEST STORE CAIRO on 05/09/26. Available limit EGP 8,765.43', {
    bank: 'cib', type: 'expense', amount: 1250, currency: 'EGP', merchant: 'TEST STORE CAIRO', date: '2026-09-05',
  });
});

test('Arabic purchase with Arabic-Indic digits (NBE-style, fake)', () => {
  ok('البنك الأهلي المصري: تم خصم مبلغ ٣٥٠٫٧٥ جنيه من بطاقتكم رقم ****4321 لدى متجر تجريبي في ١٢/١٠/٢٠٢٦ الرصيد المتاح ٨٬٧٦٥٫٤٣ جنيه', {
    bank: 'nbe', type: 'expense', amount: 350.75, currency: 'EGP', merchant: 'متجر تجريبي', date: '2026-10-12',
  });
});

test('Arabic purchase with month name (Banque Misr-style, fake)', () => {
  ok('بنك مصر: عملية شراء بقيمة 99.99 ج.م لدى FAKE CAFE يوم 3 أكتوبر 2026', {
    bank: 'banque-misr', type: 'expense', amount: 99.99, currency: 'EGP', merchant: 'FAKE CAFE', date: '2026-10-03',
  });
});

test('salary credit (income) with balance removed', () => {
  ok('Dear Customer, your account XXXX4321 has been credited with QAR 15,000.00 (SALARY) on 01-10-2026. Bal QAR 8,765.43', {
    type: 'income', amount: 15000, currency: 'QAR', date: '2026-10-01',
  });
});

test('Arabic deposit (income), account number removed', () => {
  const r = ok('تم إيداع ٥٠٠٠ ريال في حسابك رقم 4321***4321 بتاريخ 2026-10-01', {
    type: 'income', amount: 5000, currency: 'QAR', date: '2026-10-01',
  });
  assert.equal(r.merchant, null);
});

test('incoming transfer names the sender as merchant', () => {
  ok('You received QAR 500.00 from FAKE PERSON via transfer.', { type: 'income', amount: 500, merchant: 'FAKE PERSON' });
});

test('USD, GBP symbol and "جنيه إسترليني" are recognised', () => {
  ok('Purchase of USD 12.99 at FAKESTREAM.COM on 07 Oct 2026', { currency: 'USD', amount: 12.99, merchant: 'FAKESTREAM.COM', date: '2026-10-07' });
  ok('£45.20 spent at FAKE GROCER on 10/10/2026', { currency: 'GBP', amount: 45.2, merchant: 'FAKE GROCER' });
  ok('تم خصم 20 جنيه إسترليني لدى متجر وهمي', { currency: 'GBP', amount: 20, merchant: 'متجر وهمي' });
  ok('POS purchase 1,234.50 LE at FAKE HYPER', { currency: 'EGP', amount: 1234.5 });
  ok('Paid QR 75 to FAKE TAXI', { currency: 'QAR', amount: 75, merchant: 'FAKE TAXI' });
});

test('bank default currency is used when the message has none', () => {
  const r = ok('QNB ALAHLI: Card 4321**** used for amount 300.00 at FAKE SHOP', {
    bank: 'qnb-alahli', currency: 'EGP', amount: 300, merchant: 'FAKE SHOP', type: 'expense',
  });
  assert.equal(r.guessed.currency, true);
});

test('fallback currency from options', () => {
  const r = parseSms('Purchase 42.00 at FAKE PLACE', { now, defaultCurrency: 'USD' });
  assert.equal(r.currency, 'USD');
  assert.equal(r.guessed.currency, true);
});

test('the first amount is the transaction even when a later one is not a labelled balance', () => {
  ok('Your purchase of QAR 50.00 at FAKE KIOSK leaves you with QAR 8,765.43 hmm', { amount: 50 }, {});
});

test('dates: no year, future dates roll back a year, day-first', () => {
  ok('Purchase QAR 60 at FAKE PETROL on 15/10', { date: '2026-10-15' });
  ok('Purchase QAR 60 at FAKE PETROL on 25/12', { date: '2025-12-25' });
  ok('Purchase QAR 60 at FAKE PETROL on 03/04/2026', { date: '2026-04-03' });
  ok('Purchase QAR 60 at FAKE PETROL 18OCT26', { date: '2026-10-18' });
  ok('Purchase QAR 60 at FAKE PETROL on Sep 9, 2026', { date: '2026-09-09' });
  const r = ok('Purchase QAR 60 at FAKE PETROL', {});
  assert.equal(r.date, '2026-10-18');
  assert.equal(r.guessed.date, true);
  assert.equal(findDate('12/31/2025', now), '2025-12-31'); // month-first when unambiguous
});

test('OTP and verification messages are refused (English)', () => {
  for (const m of [
    'Your OTP for transaction of QAR 100 at FAKE MART is 123456',
    'Use one-time password 482913 to confirm your purchase',
    'Your verification code is 1234',
    '552211 is your FakeBank login code',
    'Your code: 99887766. Do not share it.',
    'One Time Passcode for EGP 300.00: 112233',
  ]) {
    assert.deepEqual(parseSms(m, { now }), { ok: false, reason: 'otp' }, m);
  }
});

test('OTP and verification messages are refused (Arabic)', () => {
  for (const m of [
    'رمز التحقق الخاص بك هو 123456',
    'كلمة مرور لمرة واحدة: ٩٩٩٩ لعملية بمبلغ ٥٠٠ جنيه',
    'رمز التأكيد 4455 لا تشاركه مع أحد',
    'الرقم السري المؤقت هو 7788',
    'كود التفعيل: 3344',
  ]) {
    assert.deepEqual(parseSms(m, { now }), { ok: false, reason: 'otp' }, m);
  }
});

test('a bank disclaimer can be whitelisted per bank', () => {
  const msg = 'FAKEBANK: Purchase QAR 20.00 at FAKE BAKERY. Never share your OTP with anyone.';
  assert.equal(parseSms(msg, { now }).reason, 'otp');
  const rules = [{ id: 'fakebank', name: 'FakeBank', defaultCurrency: 'QAR', detect: [/FAKEBANK/], safeDisclaimers: ['Never share your OTP with anyone.'] }];
  const r = parseSms(msg, { now, rules });
  assert.equal(r.ok, true);
  assert.equal(r.amount, 20);
  // ...but a real OTP from the same bank is still refused
  assert.equal(parseSms('FAKEBANK: your OTP is 123456. Never share your OTP with anyone.', { now, rules }).reason, 'otp');
});

test('messages without an amount are rejected', () => {
  assert.deepEqual(parseSms('Hello, your statement is ready', { now }), { ok: false, reason: 'no_amount' });
  assert.deepEqual(parseSms('   ', { now }), { ok: false, reason: 'empty' });
});

test('redaction removes cards, accounts, IBANs and balances', () => {
  const text = normalizeText(
    'Card ****4321 / A/C no. 0012345678 / IBAN QA58FAKE000000000000004321 / Avl Bal QAR 8,765.43 / الرصيد المتاح ٨٬٧٦٥٫٤٣ جنيه / call +974 4444 4321',
  );
  const out = redact(text);
  assert.ok(!/4321|8,765|12345678/.test(out), out);
});

test('bank detection prefers more specific banks first', () => {
  assert.equal(detectBank('QNB ALAHLI: something')?.id, 'qnb-alahli');
  assert.equal(detectBank('QNB: something')?.id, 'qnb');
  assert.equal(detectBank('رسالة من البنك الأهلي المصري')?.id, 'nbe');
  assert.equal(detectBank('no bank here'), null);
  assert.equal(detectBank('Purchase', { hint: 'CIB' })?.id, 'cib');
});

test('custom rule patterns with named groups are applied first', () => {
  const rules = [
    ...BANK_RULES,
    {
      id: 'fakebank', name: 'FakeBank', defaultCurrency: 'QAR', detect: [/FAKEBANK/],
      patterns: [{ type: 'income', re: /FAKEBANK refund (?<amount>[\d.]+) (?<currency>[A-Z]{3}) from (?<merchant>.+?) dated (?<date>\S+)/ }],
    },
  ];
  const r = parseSms('FAKEBANK refund 19.99 USD from FAKE ONLINE STORE dated 2026-10-02', { now, rules });
  assert.equal(r.bank, 'fakebank');
  assert.equal(r.type, 'income');
  assert.equal(r.amount, 19.99);
  assert.equal(r.currency, 'USD');
  assert.equal(r.merchant, 'FAKE ONLINE STORE');
  assert.equal(r.date, '2026-10-02');
});

test('bridge line round-trips', () => {
  const line = formatBridgeLine({ type: 'expense', amount: 120.5, currency: 'QAR', date: '2026-10-18', merchant: 'FAKE; MART' });
  const r = parseSms(line, { now });
  assert.equal(r.ok, true);
  assert.deepEqual([r.type, r.amount, r.currency, r.date, r.merchant], ['expense', 120.5, 'QAR', '2026-10-18', 'FAKE MART']);
});

test('isOtpMessage on its own', () => {
  assert.equal(isOtpMessage('Your OTP is 1234'), true);
  assert.equal(isOtpMessage('Purchase of QAR 10 at FAKE'), false);
});

test('result never contains the original text', () => {
  const msg = 'QNB: Purchase of QAR 10.00 at FAKE MART on 18/10/2026. Thank you for banking with us SECRETWORD';
  const r = parseSms(msg, { now });
  assert.deepEqual(Object.keys(r).sort(), ['amount', 'bank', 'bankName', 'currency', 'date', 'guessed', 'merchant', 'ok', 'type']);
  assert.ok(!JSON.stringify(r).includes('SECRETWORD'));
});
