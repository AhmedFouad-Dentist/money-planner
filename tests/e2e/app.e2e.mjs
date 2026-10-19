// Browser test of the real app on a simulated iPhone (Playwright + Chromium).
//
//   npm run e2e                        # starts a local server and tests it
//   BASE=https://…/money-planner/ npm run e2e   # test the live site instead
//
// Needs Playwright (not a project dependency): `npm i -g playwright`, or set
// PLAYWRIGHT=/path/to/playwright/index.mjs. All data typed here is fake.

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pw = await import(process.env.PLAYWRIGHT ?? 'playwright').catch(() => null);
if (!pw) {
  console.log('Playwright is not installed — skipping the browser test.');
  process.exit(0);
}
const { chromium, devices } = pw.default ?? pw;
const SHOTS = process.env.SHOTS ?? join(tmpdir(), 'money-planner-shots');
mkdirSync(SHOTS, { recursive: true });

let server = null;
let BASE = process.env.BASE;
if (!BASE) {
  server = spawn(process.execPath, [new URL('../../tools/serve.mjs', import.meta.url).pathname, '8091'], { stdio: 'ignore' });
  BASE = 'http://localhost:8091/';
  await new Promise((r) => setTimeout(r, 600));
}

let passed = 0;
const ok = (cond, msg) => {
  if (!cond) throw new Error(`FAILED: ${msg}`);
  passed++;
  console.log('  ✓', msg);
};
const iphone = devices['iPhone 13'];
const errors = [];
const browser = await chromium.launch();

async function newPhone(opts) {
  const ctx = await browser.newContext({ ...iphone, permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true, ...opts });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return { ctx, page };
}

async function setup(page, pin) {
  await page.goto(BASE);
  await page.waitForSelector('.pin-boxes');
  await page.fill('.pin-boxes', pin);
  await page.click('.btn.huge');
  await page.waitForSelector('.quick-input', { timeout: 20000 });
}

async function type(page, text) {
  await page.fill('.quick-input', text);
  await page.press('.quick-input', 'Enter');
}

async function swipe(page, sel) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const r = el.getBoundingClientRect();
    const touch = (x) => new Touch({ identifier: 1, target: el, clientX: x, clientY: r.top + r.height / 2 });
    el.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(r.right - 20)], bubbles: true }));
    for (let x = r.right - 40; x > r.left; x -= 40) el.dispatchEvent(new TouchEvent('touchmove', { touches: [touch(x)], bubbles: true }));
    el.dispatchEvent(new TouchEvent('touchend', { touches: [], bubbles: true }));
  }, sel);
}

try {
  // ------------------------------------------------------------ Arabic phone in Qatar
  console.log('Arabic phone (Qatar)');
  {
    const { ctx, page } = await newPhone({ locale: 'ar-QA', timezoneId: 'Asia/Qatar' });
    await page.goto(BASE);
    await page.waitForSelector('.pin-boxes');
    ok(await page.evaluate(() => document.documentElement.lang) === 'ar', 'setup is in Arabic (from the phone)');
    ok(await page.inputValue('.big-select') === 'QAR', 'main currency preselected: QAR');
    ok(await page.locator('.screen input, .screen select').count() === 2, 'setup has only currency + PIN');
    await page.screenshot({ path: join(SHOTS, '01-setup.png') });
    await page.fill('.pin-boxes', '1234');
    await page.click('.btn.huge');
    await page.waitForSelector('.quick-input', { timeout: 20000 });
    ok(await page.locator('.tab').count() === 3, 'bottom bar: 3 tabs');
    ok(await page.getAttribute('.quick-input', 'placeholder') === 'قهوة 15', 'input placeholder "قهوة 15"');

    await type(page, 'قهوة 15');
    await page.waitForSelector('.toast:has-text("اتسجّل")');
    ok(await page.locator('.sheet').count() === 0, '"قهوة 15" saved with no questions');
    ok((await page.textContent('.spent-value')).includes('15'), 'spent this month = 15');
    for (const text of ['15 قهوة', 'بنزين ١٠٠', '+5000 مرتب', 'I bought groceries for 120 QAR']) {
      await type(page, text);
      await page.waitForTimeout(120);
    }
    ok(await page.locator('.sheet').count() === 0, '"15 قهوة", "بنزين ١٠٠", "+5000 مرتب" saved directly');
    ok(await page.locator('.recent .list-row').count() === 5, 'home lists the last 5 entries');
    ok((await page.textContent('.recent')).includes('+5,000'), 'income shown with +');

    await type(page, 'كيك 30');
    await page.click('.toast-btn:has-text("تراجع")');
    await page.waitForTimeout(200);
    ok(!(await page.textContent('.recent')).includes('كيك'), 'Undo removes it');
    await type(page, 'شاي 5');
    await page.click('.toast-btn:has-text("تعديل")');
    await page.waitForSelector('.sheet .amount-input');
    ok(await page.inputValue('.sheet .amount-input') === '5', 'Edit opens it');
    await page.click('.sheet-close');
    await page.waitForTimeout(300);

    await type(page, '2 قهوة 30');
    await page.waitForSelector('.sheet');
    ok(true, 'two numbers → asks');
    await page.click('.sheet-close');
    await page.waitForTimeout(300);
    await type(page, 'عصير');
    await page.waitForSelector('.sheet .amount-input');
    await page.fill('.sheet .amount-input', '12');
    await page.click('.sheet .cat-chip >> nth=1');
    await page.waitForTimeout(300);
    ok((await page.textContent('.recent')).includes('عصير'), 'no amount → asks for it, then saves');

    await type(page, 'سلفت أحمد 500 ريال');
    await page.waitForSelector('.toast:has-text("سلّفت أحمد")');
    await type(page, 'أحمد رجّعلي 200');
    await page.waitForSelector('.toast:has-text("فاضل")');
    ok(true, 'loan and repayment by text');

    const firstBefore = await page.locator('.recent .row-title').first().textContent();
    await swipe(page, '.recent .list-row');
    await page.waitForSelector('.toast:has-text("اتمسح")');
    ok(await page.locator('.recent .row-title').first().textContent() !== firstBefore, 'swipe deletes');

    await page.evaluate(() => navigator.clipboard.writeText('QNB: Purchase of QAR 125.50 with your card ending 4321 at FAKE MART DOHA on 18/10/2026. Avl Bal QAR 8,765.43'));
    await page.click('.small-btn');
    await page.waitForSelector('.sheet .notice');
    await page.click('.sheet .cat-chip >> nth=0');
    await page.click('.sheet .btn.primary.grow');
    await page.waitForSelector('.toast:has-text("125.50")');
    ok(true, 'copied bank SMS → check sheet → saved');
    ok(await page.evaluate(() => navigator.clipboard.readText()) === '', 'clipboard cleared after reading');
    await page.evaluate(() => navigator.clipboard.writeText('Your OTP is 123456'));
    await page.click('.small-btn');
    await page.waitForSelector('.notice.danger');
    ok(true, 'copied OTP refused');
    await page.click('.sheet .btn.primary');
    await page.screenshot({ path: join(SHOTS, '02-home.png') });

    await page.click('.tab >> nth=2');
    ok((await page.textContent('main')).includes('كل فلوسك'), 'More: "كل فلوسك" instead of "net worth"');
    for (const label of ['أهدافي', 'استثماراتي', 'السلف', 'تقرير الشهر', 'نسخة احتياطية', 'الإعدادات']) ok((await page.textContent('main')).includes(label), `More lists ${label}`);
    await page.screenshot({ path: join(SHOTS, '03-more.png') });

    await page.click('.tab >> nth=0');
    await page.click('.offer .btn.primary');
    await page.waitForSelector('.sheet');
    await page.fill('.sheet input[maxlength="40"]', 'الانتقال لبريطانيا');
    await page.locator('.sheet .field:has-text("المبلغ") input').first().fill('100000');
    await page.selectOption('.sheet select', 'GBP');
    await page.locator('.sheet .field:has-text("حوّشت") input').fill('20000');
    await page.click('.sheet .btn.primary.grow');
    await page.waitForSelector('.goal-bar');
    ok((await page.textContent('.goal-bar')).includes('20'), 'goal from the Home card, progress from "saved so far"');
    await page.screenshot({ path: join(SHOTS, '04-home-goal.png') });

    // backup, then lock and unlock with 4 digits
    await page.click('.tab >> nth=2');
    await page.click('text=نسخة احتياطية');
    await page.locator('.field:has-text("كلمة مرور النسخة") input').fill('test-password-1');
    await page.locator('.field:has-text("كلمة المرور مرة أخرى") input').fill('test-password-1');
    await page.click('button:has-text("تشفير النسخة")');
    await page.waitForSelector('button:has-text("حفظ ملف النسخة")', { timeout: 20000 });
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("حفظ ملف النسخة")')]);
    const backupFile = join(tmpdir(), 'mp-e2e-backup.json');
    await dl.saveAs(backupFile);
    ok(!/قهوة|FAKE MART|أحمد/.test(readFileSync(backupFile, 'utf8')), 'backup file is encrypted');
    await page.click('.topbar-actions .icon-btn:last-child');
    await page.waitForSelector('.keypad');
    await page.screenshot({ path: join(SHOTS, '05-lock.png') });
    for (const d of '1234') await page.click(`.key[aria-label="${d}"]`);
    await page.waitForSelector('.quick-input', { timeout: 20000 });
    ok(true, 'unlocks automatically on the 4th digit');
    const raw = await page.evaluate(() => new Promise((res) => {
      const r = indexedDB.open('money-planner');
      r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get('vault'); g.onsuccess = () => res(new TextDecoder('latin1').decode(g.result.ct)); };
    }));
    ok(!/قهوة|FAKE|Groceries/.test(raw), 'stored data is encrypted');
    await ctx.close();

    // restore on a "new phone"
    const fresh = await newPhone({ locale: 'ar-QA', timezoneId: 'Asia/Qatar' });
    await fresh.page.goto(BASE);
    await fresh.page.waitForSelector('.pin-boxes');
    const [chooser] = await Promise.all([fresh.page.waitForEvent('filechooser'), fresh.page.click('text=استعادة من نسخة احتياطية')]);
    await chooser.setFiles(backupFile);
    await fresh.page.locator('.sheet input[type=password]').fill('wrong');
    await fresh.page.click('button:has-text("فتح النسخة")');
    await fresh.page.waitForSelector('.toast.error');
    await fresh.page.locator('.sheet input[type=password]').fill('test-password-1');
    await fresh.page.click('button:has-text("فتح النسخة")');
    await fresh.page.waitForSelector('.screen .pos', { timeout: 20000 });
    await fresh.page.fill('.pin-boxes', '9876');
    await fresh.page.click('.btn.huge');
    await fresh.page.waitForSelector('.goal-bar', { timeout: 20000 });
    ok(true, 'restore from backup (wrong password refused) → same goal and entries');
    await fresh.ctx.close();
  }

  // ------------------------------------------------------------ English phone in London
  console.log('English phone (London)');
  {
    const { ctx, page } = await newPhone({ locale: 'en-GB', timezoneId: 'Europe/London' });
    await page.goto(BASE);
    await page.waitForSelector('.pin-boxes');
    ok(await page.evaluate(() => document.documentElement.lang) === 'en', 'setup in English');
    ok(await page.inputValue('.big-select') === 'GBP', 'main currency preselected: GBP');
    await page.fill('.pin-boxes', '5678');
    await page.click('.btn.huge');
    await page.waitForSelector('.quick-input', { timeout: 20000 });
    ok(await page.getAttribute('.quick-input', 'placeholder') === 'coffee 15', 'placeholder "coffee 15"');
    await type(page, 'coffee 15');
    await page.waitForSelector('.toast:has-text("Saved: Coffee")');
    ok(true, '"coffee 15" → "Saved: Coffee £15.00"');
    await page.screenshot({ path: join(SHOTS, '06-home-en.png') });
    // #say from Siri while the app is open: confirm sheet, fragment removed
    await page.evaluate(() => { location.hash = '#say=' + encodeURIComponent('spent 30 pounds on lunch'); });
    await page.waitForSelector('.sheet');
    ok(await page.evaluate(() => location.hash) === '', '#say text removed from the address');
    await ctx.close();
  }

  // ------------------------------------------------------------ Safari bridge
  console.log('Opened from a Shortcut in Safari (no data there)');
  {
    const { ctx, page } = await newPhone({ locale: 'en-GB', timezoneId: 'Europe/London' });
    await page.goto(`${BASE}#sms=${encodeURIComponent('بنك مصر: عملية شراء بقيمة 99.99 ج.م لدى FAKE CAFE يوم 3 أكتوبر 2026')}`);
    await page.waitForSelector('button:has-text("Copy cleaned summary")');
    ok(!page.url().includes('#'), 'message removed from the address');
    await page.click('button:has-text("Copy cleaned summary")');
    ok(await page.evaluate(() => navigator.clipboard.readText()) === 'MP1;expense;99.99;EGP;2026-10-03;FAKE CAFE', 'only the cleaned fields are copied');
    await ctx.close();
  }

  ok(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  console.log(`\n${passed} checks passed. Screenshots: ${SHOTS}`);
} catch (e) {
  console.error(e.message);
  if (errors.length) console.error('page errors:', errors);
  process.exitCode = 1;
} finally {
  await browser.close();
  server?.kill();
}
