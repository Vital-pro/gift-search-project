/* eslint-env serviceworker */
// ↑ [указали среду service worker для ESLint]

/**
 * Минимальный безопасный Service Worker для Gift Search
 * Изменения в этом ревизии:
 *  - [FIX] все обращения к глобалам заменены на sw.* (sw = globalThis):
 *          sw.caches, sw.fetch, sw.Response, sw.URL, sw.location
 */

const sw = globalThis; // [FIX] единая ссылка на глобалы среды SW

const SW_VERSION = 'v1.0.2'; // ↑ bump версии — форс-обновление SW
const STATIC_CACHE = `static-${SW_VERSION}`;

// Пути, которые НЕ трогаем (особенно /api/go)
const API_PREFIX = '/api/';

// Минимальный precache набора стабильных файлов
const PRECACHE_URLS = [
  '/', // HTML-старт
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/og/share-default.png',
];

// Установка: кладём precache и сразу активируемся
sw.addEventListener('install', (event) => {
  sw.skipWaiting(); // применить сразу
  event.waitUntil(
    sw.caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {}),
  );
});

// Активация: чистим старые кэши и берём управление
sw.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      sw.clients.claim(); // управляем сразу
      const keys = await sw.caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('static-') && key !== STATIC_CACHE)
          .map((key) => sw.caches.delete(key)),
      );
    })(),
  );
});

// Стратегия: stale-while-revalidate для статики
async function staleWhileRevalidate(request) {
  const cache = await sw.caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const networkFetch = sw
    .fetch(request)
    .then((response) => {
      if (response && response.status === 200 && response.type === 'basic') {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);
  return cached || networkFetch || Promise.reject('no-response');
}

// Стратегия: network-first для HTML, офлайн — из кэша/заглушка
async function networkFirstHtml(request) {
  const cache = await sw.caches.open(STATIC_CACHE);
  try {
    const fresh = await sw.fetch(request);
    if (fresh && fresh.status === 200) {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (e) {
    // const fallback = await cache.match(request);
    // if (fallback) return fallback;
    const offlinePage = await cache.match('/offline.html');
    if (offlinePage) return offlinePage;
    // fallback на случай, если offline.html не закэширован
    return new sw.Response(
      '<!doctype html><meta charset="utf-8"><title>Нет подключения</title>' +
        '<body style="font-family:system-ui;padding:24px;text-align:center;">' +
        '<h1>Нет подключения</h1><p>Попробуйте позже.</p></body>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}

// Главный роутер запросов
sw.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new sw.URL(request.url);

  // ❌ Внешние домены (партнёры, метрики) — не перехватываем
  if (url.origin !== sw.location.origin) return;

  // ❌ Любые /api/* — не трогаем (особенно /api/go)
  if (url.pathname.startsWith(API_PREFIX)) return;

  const accept = request.headers.get('accept') || '';
  const isHtml = accept.includes('text/html') || url.pathname.endsWith('.html');
  const isStatic = /\.(?:js|css|png|jpg|jpeg|webp|svg|ico|gif|woff2?|ttf|otf)$/i.test(url.pathname);

  if (isHtml) {
    event.respondWith(networkFirstHtml(request));
    return;
  }
  if (isStatic) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // По умолчанию — мягко: сначала кэш, обновляем на фоне
  event.respondWith(staleWhileRevalidate(request));
});

// Сообщение от клиента для немедленного применения новой версии (опц.)
sw.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    sw.skipWaiting();
  }
});
