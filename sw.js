const CACHE_VERSION = 'v5';
const CORE_ASSETS = [
  '/',
  '/css/core.css',
  '/js/core.js',
  '/img/bg-mobile.webp'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => 
      Promise.all(keys.map(key => 
        key !== CACHE_VERSION ? caches.delete(key) : null
      ))
    )
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  
  // 网络优先策略
  if(request.headers.get('Save-Data')) {
    return cacheFirst(request);
  }
  
  e.respondWith(
    fetch(request)
      .then(networkResponse => {
        // 更新缓存
        caches.open(CACHE_VERSION)
          .then(cache => cache.put(request, networkResponse.clone()));
        return networkResponse;
      })
      .catch(() => caches.match(request))
  );
});

function cacheFirst(request) {
  return caches.match(request)
    .then(cached => cached || fetch(request));
}
