/**
 * Diamond Challenge service worker (story 004): offline after the first load.
 *
 * - install: precache the app shell (index.html, manifest, icon) plus every
 *   hashed ./assets/* file index.html references. The first page load runs
 *   before this worker controls the page, so those assets are fetched here.
 * - activate: delete caches from older CACHE_NAME versions, take control.
 * - fetch (same-origin GET only):
 *     navigations -> network first, fall back to the cached index.html, so a
 *                    new deploy is picked up whenever the device is online;
 *     everything else -> cache first, network fallback; successful network
 *                    responses are stored for next time.
 *
 * All URLs are relative to this file, so it works under a GitHub Pages
 * subpath. Hand-written on purpose: no build plugin, no dependencies.
 * Bump CACHE_NAME only to force-drop old cached files.
 */
const CACHE_NAME = 'diamond-challenge-v1';
const SHELL_URLS = ['./', './index.html', './manifest.webmanifest', './icon.svg'];
const ASSET_URL_PATTERN = /(?:src|href)="(\.?\/?assets\/[^"]+)"/g;

/** Shell URLs plus the hashed assets referenced by the current index.html. */
async function precacheUrls() {
  const response = await fetch('./index.html', { cache: 'no-cache' });
  const html = await response.text();
  const assets = Array.from(html.matchAll(ASSET_URL_PATTERN), (match) => match[1]);
  return [...SHELL_URLS, ...assets];
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(await precacheUrls());
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

/** Stores a copy of a good same-origin response. */
async function remember(request, response) {
  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstNavigation(request) {
  try {
    return await remember(new Request('./index.html'), await fetch(request));
  } catch {
    const cached = await caches.match('./index.html');
    if (cached) return cached;
    throw new Error('offline and no cached app shell');
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  return remember(request, await fetch(request));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(request.mode === 'navigate' ? networkFirstNavigation(request) : cacheFirst(request));
});
