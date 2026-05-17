/**
 * sw.js — Service Worker
 * سوبرماركت أشرفية صحنايا
 *
 * Strategy:
 *   App Shell  → Cache-First   (instant repeat loads)
 *   Images     → Stale-While-Revalidate
 *   Fonts      → Cache-First
 */

const SHELL_CACHE  = 'dsm-shell-v2';
const IMAGE_CACHE  = 'dsm-images-v2';

const SHELL_ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './js/db.js',
  './js/cart.js',
  './js/ui.js',
  './js/app.js',
  './manifest.json',
];

/* INSTALL */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache =>
      Promise.allSettled(SHELL_ASSETS.map(url => cache.add(url).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

/* ACTIVATE — purge old caches */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== SHELL_CACHE && k !== IMAGE_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* FETCH */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  /* Images: stale-while-revalidate */
  if (request.destination === 'image') {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
    return;
  }

  /* Fonts */
  if (url.hostname.includes('fonts.google') || url.hostname.includes('fonts.gstatic')) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  /* App shell: cache-first */
  if (url.origin === location.origin) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
  }
});

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(cacheName)).put(req, res.clone());
    return res;
  } catch { return new Response('Offline', { status: 503 }); }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchP = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
  return cached || fetchP || new Response('', { status: 404 });
}
