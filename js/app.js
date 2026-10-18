// Boot: capture a bank SMS from the URL fragment, then show onboarding, the
// lock screen or the app. Handles auto-lock and the service worker.

import { readTextFromHash } from './sms/fragment.js';
import { parseSms } from './sms/parser.js';
import { parseQuickText } from './nlp/quicktext.js';
import * as vault from './vault.js';
import { requestPersistence } from './db.js';
import { migrate } from './model.js';
import { store, flushSave, recordSnapshot } from './store.js';
import { setLang, applyTheme, t } from './i18n.js';
import { closeAllSheets, toast } from './ui.js';
import { renderLock, renderOnboarding, renderBridge } from './views/auth.js';
import { mountShell, unmountShell } from './views/shell.js';
import { handleSmsResult } from './views/entry.js';
import { handleQuickResult } from './views/quick.js';

// ---------------------------------------------------------------- text from URL
// #sms= (bank message) or #say= (Siri / dictated text). Parsed immediately;
// only the extracted fields are kept, and the fragment is removed from the
// address bar and history right away.
let pending = null;

function captureTextFromUrl() {
  const data = readTextFromHash(location.hash);
  if (!data) return false;
  history.replaceState(null, '', location.pathname + location.search);
  pending = data.kind === 'sms'
    ? { kind: 'sms', result: parseSms(data.text, { bankHint: data.from }) }
    // the user's own dictated words are kept in memory only, for the Safari bridge
    : { kind: 'say', result: parseQuickText(data.text), text: data.text };
  data.text = null;
  return true;
}

function deliverPending() {
  if (!pending || !store.state) return;
  const p = pending;
  pending = null;
  if (p.kind === 'sms') handleSmsResult(p.result);
  else handleQuickResult(p.result);
}

window.addEventListener('hashchange', () => {
  if (captureTextFromUrl() && store.state) deliverPending();
});

// ---------------------------------------------------------------- auto-lock
let lastActive = Date.now();
let hiddenAt = 0;
const lockAfterMs = () => (store.state?.settings.autoLockMinutes ?? 2) * 60_000;

for (const ev of ['pointerdown', 'keydown', 'touchstart', 'scroll']) {
  addEventListener(ev, () => (lastActive = Date.now()), { passive: true, capture: true });
}
setInterval(() => {
  if (store.state && Date.now() - lastActive > lockAfterMs()) lockNow();
}, 10_000);

const cover = () => document.getElementById('privacy-cover');
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    if (store.state) {
      cover().hidden = false;
      flushSave();
    }
  } else {
    cover().hidden = true;
    if (store.state && Date.now() - hiddenAt > lockAfterMs()) lockNow();
  }
});
addEventListener('pagehide', () => store.state && flushSave());

async function lockNow() {
  if (!store.state) return;
  await flushSave();
  store.state = null;
  vault.lock();
  closeAllSheets();
  unmountShell();
  renderLock(onUnlocked);
}

// ---------------------------------------------------------------- start
function onUnlocked(state) {
  store.state = migrate(state);
  setLang(store.state.settings.lang);
  applyTheme(store.state.settings.theme);
  lastActive = Date.now();
  recordSnapshot(store.state);
  mountShell({ lock: lockNow });
  requestPersistence();
  deliverPending();
}

async function boot() {
  captureTextFromUrl();
  const meta = await vault.getMeta().catch(() => null);
  setLang(meta?.lang ?? (navigator.language?.startsWith('ar') ? 'ar' : 'en'));
  applyTheme(meta?.theme);
  if (meta) return renderLock(onUnlocked);
  if (pending) {
    return renderBridge(pending, { onSetupHere: () => renderOnboarding(onUnlocked) });
  }
  renderOnboarding(onUnlocked);
}

// ---------------------------------------------------------------- service worker
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const offer = (w) => toast(t('app.updateReady'), { ms: 15_000, action: { label: t('app.updateNow'), run: () => w.postMessage('skip-waiting') } });
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => w.state === 'installed' && navigator.serviceWorker.controller && offer(w));
    });
  }).catch(() => {});
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', async () => {
    if (reloading || !hadController) return;
    reloading = true;
    if (store.state) await flushSave();
    location.reload();
  });
}

boot();
