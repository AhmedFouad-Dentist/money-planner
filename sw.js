// Service worker: makes the app work offline. It only caches the app's own
// files. It never sees your data (that lives in IndexedDB) and never touches
// requests to other sites (the optional exchange-rate update goes straight to
// the network).

const VERSION = 'dev'; // replaced with the commit id when deployed
const CACHE = `money-planner-${VERSION}`;

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'js/app.js',
  'js/categorize.js',
  'js/charts.js',
  'js/config.js',
  'js/crypto.js',
  'js/db.js',
  'js/finance.js',
  'js/i18n.js',
  'js/icons.js',
  'js/model.js',
  'js/nlp/quicktext.js',
  'js/quicksave.js',
  'js/rates.js',
  'js/recurring.js',
  'js/store.js',
  'js/strings.js',
  'js/ui.js',
  'js/vault.js',
  'js/version.js',
  'js/sms/banks.js',
  'js/sms/fragment.js',
  'js/sms/parser.js',
  'js/sms/text.js',
  'js/sms/vocab.js',
  'js/views/auth.js',
  'js/views/common.js',
  'js/views/connect.js',
  'js/views/entry.js',
  'js/views/goals.js',
  'js/views/home.js',
  'js/views/invest.js',
  'js/views/loans.js',
  'js/views/more.js',
  'js/views/quick.js',
  'js/views/report.js',
  'js/views/shell.js',
  'js/views/transactions.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((a) => new Request(a, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('money-planner-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Navigations (any URL inside the app) get the app shell.
    const hit = req.mode === 'navigate'
      ? (await cache.match('index.html')) ?? (await cache.match('./'))
      : await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(req);
    } catch {
      return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }
  })());
});
