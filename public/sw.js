const CACHE_NAME = 'aturduitku-v17-pwa-fast-shell';
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
        const fresh = fetch(e.request, { cache: 'no-store' }).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put('/index.html', clone);
              cache.put('/', res.clone());
            });
          }
          return res;
        }).catch(() => cached || caches.match('/'));
        return cached || fresh;
      })
    );
    return;
  }
  // Stale-while-revalidate for built assets: instant PWA taps/launch, still updates in background.
  const isAsset = e.request.url.match(/\.(html|js|css|jsx)$/);
  if (isAsset) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const fresh = fetch(e.request, { cache: 'no-store' }).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return res;
        }).catch(() => cached);
        return cached || fresh;
      })
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
