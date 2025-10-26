/* eslint-env serviceworker */
// ↑ [указали среду service worker для ESLint]

/**
 * Минимальный безопасный Service Worker для Gift Search
 * Изменения в этом ревизии:
 *  - [FIX] все обращения к глобалам заменены на sw.* (sw = globalThis):
 *          sw.caches, sw.fetch, sw.Response, sw.URL, sw.location
 */

const sw = globalThis; // [FIX] единая ссылка на глобалы среды SW

const SW_VERSION = 'v1.0.3'; // ↑ bump версии — форс-обновление SW
const STATIC_CACHE = `static-${SW_VERSION}`;

function isCacheableResponse(response, request) {
  if (!response || !response.ok) return false;           // только 2xx
  if (request && request.method && request.method !== 'GET') return false;

  const cc = response.headers.get('Cache-Control') || '';
  if (/\bno-store\b/i.test(cc) || /\bno-cache\b/i.test(cc)) return false;

  const ct = response.headers.get('Content-Type') || '';
  // Разрешаем только типичные кэшируемые ассеты + HTML
  return (
    ct.includes('text/html') ||
    ct.includes('text/css') ||
    ct.includes('application/javascript') ||
    ct.includes('text/javascript') ||
    ct.startsWith('image/') ||
    ct.startsWith('font/') ||
    ct.includes('application/font-') ||
    ct.includes('application/manifest+json')
  );
}


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

// <-- ВСТАВЬ СЮДА: лимиты кэша и утилиты TTL>
const MAX_ASSET_ENTRIES = 120;       // максимум ассетов (js/css/img/fonts/svg)
const MAX_HTML_ENTRIES  = 10;        // максимум HTML-документов
const ASSET_TTL_MS      = 7 * 24 * 60 * 60 * 1000;  // 7 дней
const HTML_TTL_MS       = 24 * 60 * 60 * 1000;      // 1 день

// Сохраняем в кэш ответ с меткой времени (x-sw-cache-time)
async function cachePutWithTimestamp(cache, request, response) {
  try {
    const headers = new Headers(response.headers);
    headers.set('x-sw-cache-time', String(Date.now()));
    const body = await response.clone().arrayBuffer();
    const wrapped = new sw.Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
    await cache.put(request, wrapped);
  } catch (_) {
    // молча пропускаем — лучше без кэша, чем с падением
  }
}

// Ограничение по количеству (удаляем самые ранние)
async function trimCache(cacheName, maxEntries, matchFn = null) {
  const cache = await sw.caches.open(cacheName);
  const keys = await cache.keys();
  const targets = matchFn ? keys.filter(matchFn) : keys.slice();
  const extra = targets.length - maxEntries;
  if (extra > 0) {
    const toDelete = targets.slice(0, extra);
    await Promise.all(toDelete.map((req) => cache.delete(req)));
  }
}

// Очистка по TTL (x-sw-cache-time старше порога)
async function trimCacheByTTL(cacheName, ttlMs, matchFn = null) {
  const cache = await sw.caches.open(cacheName);
  const now = Date.now();
  const keys = await cache.keys();
  const targets = matchFn ? keys.filter(matchFn) : keys.slice();

  for (const req of targets) {
    const res = await cache.match(req);
    if (!res) continue;
    const ts = Number(res.headers.get('x-sw-cache-time') || 0);
    if (!Number.isFinite(ts)) continue;
    if (now - ts > ttlMs) {
      await cache.delete(req);
    }
  }
}

// Хелперы-матчеры
function isAssetPath(pathname) {
  return /\.(?:js|css|png|jpg|jpeg|webp|svg|ico|gif|woff2?|ttf|otf)$/i.test(pathname);
}
function isHtmlRequest(req, url) {
  const accept = req.headers.get('accept') || '';
  return req.mode === 'navigate' || accept.includes('text/html') || url.pathname.endsWith('.html');
}
// <-- /ВСТАВЬ СЮДА


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

// Стратегия: stale-while-revalidate для статики (с лимитами и TTL)
async function staleWhileRevalidate(request, event) {
  const cache = await sw.caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  const networkFetch = sw.fetch(request)
    .then(async (response) => {
      if (isCacheableResponse(response, request)) {
        await cachePutWithTimestamp(cache, request, response);

        // Фоновая чистка ассетов
        const matcher = (req) => isAssetPath(new sw.URL(req.url).pathname);
        const cleanup = Promise.all([
          trimCache(STATIC_CACHE, MAX_ASSET_ENTRIES, matcher),
          trimCacheByTTL(STATIC_CACHE, ASSET_TTL_MS, matcher),
        ]);
        if (event && event.waitUntil) event.waitUntil(cleanup);
        else cleanup.catch(() => {});
      }
      return response;
    })
    .catch(() => undefined);

  return cached || networkFetch || Promise.reject('no-response');
}


// Стратегия: network-first для HTML, офлайн — сразу offline.html (с лимитами и TTL)
async function networkFirstHtml(request, event) {
  const cache = await sw.caches.open(STATIC_CACHE);
  try {
    const fresh = await sw.fetch(request);
    if (isCacheableResponse(fresh, request)) {
      await cachePutWithTimestamp(cache, request, fresh);

      // Фоновая чистка HTML
      const matcher = (req) => {
        const u = new sw.URL(req.url);
        return isHtmlRequest(req, u);
      };
      const cleanup = Promise.all([
        trimCache(STATIC_CACHE, MAX_HTML_ENTRIES, matcher),
        trimCacheByTTL(STATIC_CACHE, HTML_TTL_MS, matcher),
      ]);
      if (event && event.waitUntil) event.waitUntil(cleanup);
      else cleanup.catch(() => {});
    }
    return fresh;
  } catch (e) {
    const offlinePage = await cache.match('/offline.html');
    if (offlinePage) return offlinePage;

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

  // Внешние домены — не перехватываем
  if (url.origin !== sw.location.origin) return;

  // Любые /api/* — не трогаем (особенно /api/go)
  if (url.pathname.startsWith(API_PREFIX)) return;

  const accept = request.headers.get('accept') || '';
  const isHtml =
    request.mode === 'navigate' ||
    accept.includes('text/html') ||
    url.pathname.endsWith('.html');
  const isStatic = isAssetPath(url.pathname);

  if (isHtml) {
    event.respondWith(networkFirstHtml(request, event));
    return;
  }
  if (isStatic) {
    event.respondWith(staleWhileRevalidate(request, event));
    return;
  }

  // Прочее — как статику (иконки манифеста и т.д.)
  event.respondWith(staleWhileRevalidate(request, event));
});


// Сообщение от клиента для немедленного применения новой версии (опц.)
sw.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    sw.skipWaiting();
  }
});
