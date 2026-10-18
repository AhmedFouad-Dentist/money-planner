// Boot: capture a bank SMS from the URL fragment, then show onboarding, the
// lock screen or the app. Handles auto-lock and the service worker.

import { readSmsFromHash } from './sms/fragment.js';
import { parseSms } from './sms/parser.js';
import * as vault from './vault.js';
import { requestPersistence } from './db.js';
import { migrate } from './model.js';
import { store, flushSave, recordSnapshot } from './store.js';
import { setLang, applyTheme, t } from './i18n.js';
import { closeAllSheets, toast } from './ui.js';
import { renderLock, renderOnboarding, renderBridge } from './views/auth.js';
import { mountShell, unmountShell } from './views/shell.js';
import { handleSmsResult } from './views/entry.js';

// ---------------------------------------------------------------- SMS from URL
// Parse immediately and keep ONLY the extracted fields; the message text and
// the fragment are dropped right away (and removed from the address bar/history).
let pendingSms = null;

function captureSmsFromUrl() {
  const data = readSmsFromHash(location.hash);
  if (!data) return false;
  history.replaceState(null, '', location.pathname + location.search);
  pendingSms = parseSms(data.sms, { bankHint: data.from });
  data.sms = null;
  return true;
}

function deliverPendingSms() {
  if (!pendingSms || !store.state) return;
  const r = pendingSms;
  pendingSms = null;
  handleSmsResult(r);
}

window.addEventListener('hashchange', () => {
  if (captureSmsFromUrl() && store.state) deliverPendingSms();
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
  deliverPendingSms();
}

async function boot() {
  captureSmsFromUrl();
  const meta = await vault.getMeta().catch(() => null);
  setLang(meta?.lang ?? (navigator.language?.startsWith('ar') ? 'ar' : 'en'));
  applyTheme(meta?.theme);
  if (meta) return renderLock(onUnlocked);
  if (pendingSms) {
    return renderBridge(pendingSms, { onSetupHere: () => renderOnboarding(onUnlocked) });
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
