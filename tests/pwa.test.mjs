// Checks on the app files themselves: every file is cached for offline use,
// every translation key exists in both languages, and nothing loads from
// other sites.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { STRINGS } from '../js/strings.js';

const root = new URL('..', import.meta.url).pathname;
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const appFiles = ['js', 'css', 'icons'].flatMap((d) => walk(join(root, d))).map((p) => relative(root, p));

test('service worker caches every app file', () => {
  const sw = readFileSync(join(root, 'sw.js'), 'utf8');
  for (const f of [...appFiles, 'index.html', 'manifest.webmanifest']) assert.ok(sw.includes(`'${f}'`), `sw.js is missing ${f}`);
});

test('every translation key used in the code exists in English and Arabic', () => {
  const used = new Set();
  for (const f of appFiles.filter((p) => p.endsWith('.js'))) {
    const src = readFileSync(join(root, f), 'utf8');
    for (const m of src.matchAll(/'((?:about|app|backup|bridge|budget|cat|clip|common|connect|entry|error|goals|home|inv|ios|loans|lock|more|nw|onb|quick|rates|rec|report|settings|sms|tab|tx)\.[A-Za-z0-9.]+)'/g)) used.add(m[1]);
  }
  // keys built at runtime
  for (const k of ['savings', 'investments', 'both']) used.add(`goals.funding.${k}`).add(`goals.fundingShort.${k}`).add(`goals.noSources.${k}`);
  for (const k of ['savings', 'contributions', 'none']) used.add(`goals.rate.${k}`);
  for (const k of ['accounts', 'holdings']) used.add(`goals.all.${k}`);
  for (const k of ['default', 'manual', 'online']) used.add(`rates.src.${k}`);
  for (const k of ['system', 'light', 'dark']) used.add(`settings.theme.${k}`);
  for (const k of ['home', 'tx', 'goals', 'invest', 'more']) used.add(`tab.${k}`);
  for (const k of ['QAR', 'EGP', 'GBP', 'USD']) used.add(`ccy.${k}`);
  for (const k of ['lend', 'borrow', 'repayIn', 'repayOut']) used.add(`quick.loan.${k}`);
  for (const k of ['savings', 'investments', 'both', 'receivables', 'payables']) used.add(`goals.part.${k}`);
  const missing = [];
  for (const k of used) for (const lang of ['en', 'ar']) if (!(k in STRINGS[lang])) missing.push(`${lang}:${k}`);
  assert.deepEqual(missing, []);
  const enKeys = Object.keys(STRINGS.en).sort();
  const arKeys = Object.keys(STRINGS.ar).sort();
  assert.deepEqual(enKeys.filter((k) => !arKeys.includes(k)), [], 'keys missing in Arabic');
  assert.deepEqual(arKeys.filter((k) => !enKeys.includes(k)), [], 'keys missing in English');
});

test('no third-party resources, strict CSP present', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /script-src 'self'/);
  assert.doesNotMatch(html, /<script[^>]+src="https?:/);
  assert.doesNotMatch(html, /<link[^>]+href="https?:/);
  for (const f of appFiles.filter((p) => p.endsWith('.js') || p.endsWith('.css'))) {
    const src = readFileSync(join(root, f), 'utf8');
    for (const m of src.matchAll(/https?:\/\/[^\s'"`)]+/g)) {
      assert.ok(m[0] === 'http://www.w3.org/2000/svg' || /^https:\/\/(open\.er-api\.com|github\.com\/AhmedFouad-Dentist|www\.icloud\.com\/shortcuts\/)/.test(m[0]), `unexpected URL ${m[0]} in ${f}`);
    }
    assert.doesNotMatch(src, /\binnerHTML\b|insertAdjacentHTML|document\.write|\beval\(|new Function/, `unsafe DOM/JS API in ${f}`);
  }
});

test('manifest and icons', () => {
  const m = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.display, 'standalone');
  for (const i of m.icons) assert.ok(appFiles.includes(i.src), `missing icon ${i.src}`);
  assert.ok(appFiles.includes('icons/apple-touch-icon.png'));
});
