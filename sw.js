const CACHE_NAME = 'mobile-v3';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/js/mobile.js',
  '/img/bg-low.webp',
  '/fonts/inter.woff2'
];

// 安装阶段
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 缓存优先策略
self.addEventListener('fetch', (e) => {
  if(e.request.mode === 'navigate' || 
     e.request.destination === 'image') {
    e.respondWith(
      caches.match(e.request)
        .then(cached => cached || fetchAndCache(e.request))
    );
  }
});

async function fetchAndCache(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request);
    await cache.put(request, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await cache.match(request);
    return cached || caches.match('/offline.html');
  }
}
