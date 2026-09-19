// CA Study — service worker. Caches the app shell so it works offline.
// All actual data lives in IndexedDB, which this worker never touches —
// updating/replacing these files never affects your saved notes/data.
//
// Strategy: network-first for index.html/app.js — when you're online, you
// always get the latest code straight away, and the cache is only a
// fallback for when you're offline. Static assets (icons, manifest) that
// essentially never change use cache-first with a background refresh
// instead, since waiting on the network for a file that hasn't changed in
// months just adds latency for no benefit. Bump CACHE_NAME whenever you
// deploy a new version so old caches get cleared out automatically.
const CACHE_NAME = 'castudy-cache-v23';
const APP_SHELL = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './sidebar-logo.png',
  './favicon-32.png',
  './favicon-16.png',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png'
];
const STATIC_ASSET_NAMES = ['manifest.json', 'sidebar-logo.png', 'favicon-32.png', 'favicon-16.png',
  'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-192-maskable.png', 'icon-512-maskable.png'];
function isStaticAsset(url) {
  try { const path = new URL(url).pathname; return STATIC_ASSET_NAMES.some((name) => path.endsWith(name)); }
  catch (e) { return false; }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting(); // activate this new version immediately, don't wait for old tabs to close
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim(); // take control of any already-open windows (including the installed PWA) right away
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (isStaticAsset(event.request.url)) {
    // Cache-first, refresh in the background — instant response when
    // available, and the cache quietly catches up for next time if the
    // asset ever does change (e.g. swapping the logo).
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchAndUpdate = fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached);
        return cached || fetchAndUpdate;
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request)) // offline fallback only
  );
});
