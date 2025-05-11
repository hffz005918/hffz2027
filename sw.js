// 缓存名称和版本控制
const CACHE_NAME = 'employee-portal-v2';
const OFFLINE_URL = '/offline.html';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/styles.css',
  '/js/lite.js',
  '/bg-low.webp',
  '/bg.jpg',
  OFFLINE_URL
];

// 安装阶段：预缓存关键资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// 激活阶段：清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 网络请求拦截
self.addEventListener('fetch', event => {
  // 跳过非GET请求和跨域请求
  if (event.request.method !== 'GET' || 
      !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // 返回缓存或网络请求
        return cachedResponse || fetch(event.request)
          .then(response => {
            // 动态缓存可缓存资源
            if (isCacheable(event.request)) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, responseToCache));
            }
            return response;
          })
          .catch(() => {
            // 网络失败时返回离线页面
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }
          });
      })
  );
});

// 可缓存资源判断
function isCacheable(request) {
  return request.method === 'GET' &&
         !request.url.includes('/api/') &&
         (request.url.endsWith('.html') || 
          request.url.endsWith('.css') || 
          request.url.endsWith('.js') || 
          /\.(webp|avif|jpg)$/.test(request.url));
}

// 监听消息（用于触发更新等）
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
