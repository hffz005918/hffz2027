const CACHE_NAME = 'v2-{{timestamp}}';
const API_CACHE = 'api-v1';
const OFFLINE_URL = '/offline.html';

// 预缓存资源
const PRECACHE = [
  '/',
  '/critical.css',
  '/critical.js',
  '/bg-low.webp',
  OFFLINE_URL
];

// 网络策略
const STRATEGIES = {
  STATIC: networkFirst,
  API: staleWhileRevalidate,
  IMAGE: cacheFirst,
  FALLBACK: offlineFallback
};

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => 
      Promise.all(keys.map(key => 
        key !== CACHE_NAME && caches.delete(key)
      ))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  if(url.origin === location.origin) {
    // 静态资源
    if(url.pathname.startsWith('/static/')) {
      return event.respondWith(STRATEGIES.IMAGE(event.request));
    }
    // API请求
    if(url.pathname.startsWith('/api/')) {
      return event.respondWith(STRATEGIES.API(event.request));
    }
    // 页面导航
    if(event.request.mode === 'navigate') {
      return event.respondWith(
        STRATEGIES.STATIC(event.request).catch(() => 
          caches.match(OFFLINE_URL))
      );
    }
  }
  
  event.respondWith(STRATEGIES.STATIC(event.request));
});

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch {
    return caches.match(request);
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  return cached || fetch(request);
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(networkResponse => {
    cache.put(request, networkResponse.clone());
    return networkResponse;
  });
  return cached || fetchPromise;
}

function offlineFallback() {
  return caches.match(OFFLINE_URL);
}
