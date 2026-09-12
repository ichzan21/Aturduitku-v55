const CACHE_NAME = 'aturduitku-v28-valid-assets';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon-32.png',
  '/favicon-48.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match('/index.html').then(cached => {
        return fetch(e.request, { cache: 'no-store' }).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put('/index.html', clone);
              cache.put('/', res.clone());
            });
          }
          return res;
        }).catch(() => cached || caches.match('/'));
      })
    );
    return;
  }
  // Network-first keeps the current HTML and hashed chunks on the same deployment.
  // Cached assets remain available when the device is genuinely offline.
  const isAsset = e.request.url.match(/\.(html|js|css|jsx)$/);
  if (isAsset) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).then(res => {
          const path = new URL(e.request.url).pathname;
          const contentType = String(res.headers.get('content-type') || '').toLowerCase();
          const expectsScript = /\.(?:js|jsx)$/.test(path);
          const expectsStyle = /\.css$/.test(path);
          const validType = expectsScript
            ? /javascript|ecmascript/.test(contentType)
            : expectsStyle
              ? contentType.includes('text/css')
              : contentType.includes('text/html');
          if (!res.ok || !validType) {
            return caches.match(e.request).then(cached => cached || new Response('', {
              status: 503,
              statusText: 'Asset version expired',
              headers: { 'Content-Type': expectsStyle ? 'text/css' : 'application/javascript' },
            }));
          }
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return res;
        }).catch(() => caches.match(e.request))
    );
    return;
  }
  // Cache-first for everything else (images, fonts)
  e.respondWith(
    caches.match(e.request).then(cached => {
      const networkFetch = fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
