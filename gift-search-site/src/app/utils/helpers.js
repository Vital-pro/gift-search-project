// gift-search-site/src/app/utils/helpers.js
// Универсальные хелперы для карточек, переходов, ссылок и overlay-анимации.

import { showTransitionOverlay } from '../../ui/components/Overlay.js';
import { formatPrice, translateCategory } from './format.js';

// ============================================
// [1] Base64 → безопасная для URL версия
// ============================================
// [ИСПРАВЛЕНО] безопасное кодирование UTF-8 для любых символов (в том числе кириллицы)
export function b64url(str) {
  try {
    const utf8 = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode('0x' + p1)
    );
    return btoa(utf8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (err) {
    console.warn('[b64url] Ошибка кодирования:', err);
    return '';
  }
}


// ============================================
// [2] Проверка партнёрских URL
// ============================================
// [ВОССТАНОВЛЕНО] Строгая валидация партнёрских URL (как было в main.js)
export function validatePartnerUrl(raw) {
  // 🔒 Базовые проверки
  if (!raw || typeof raw !== 'string') return { ok: false, reason: 'empty' };
  if (!/^https?:\/\//i.test(raw)) return { ok: false, reason: 'no-scheme' };
  if (/^\s*erid\s*=/i.test(raw)) return { ok: false, reason: 'starts-with-param' };
  if (/\s/.test(raw)) return { ok: false, reason: 'spaces' };

  // 🚦 Разбор URL
  let u;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: 'bad-url' };
  }

  // Протокол и хост
  if (u.protocol !== 'http:' && u.protocol !== 'https:')
    return { ok: false, reason: 'bad-protocol' };
  const hostLooksOk = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(u.hostname);
  if (!hostLooksOk) return { ok: false, reason: 'bad-host' };

  // 🧩 Специальные правила для аффилиатных доменов
  const affiliateDomains = new Set([
    'xpuvo.com',
    'rthsu.com',
    'ujhjj.com',
    'kjuzv.com', // chitai-gorod.ru
    'www.floraexpress.ru',
    'kpwfp.com',
    'bywiola.com',
    'yyczo.com', // mir-kubikov.ru
    'qwpeg.com',
    'dhwnh.com',
    'gndrz.com',
    'ytebb.com',
    'ogsib.com',
    'uuwgc.com',
    'admitad.com',
    'advcake.com',
  ]);
  const CLICK_PARAMS = ['erid', 'subid', 'sub_id', 'sub1', 'clickid', 'admitad_uid'];

  if (affiliateDomains.has(u.hostname)) {
    // должны присутствовать кликовые параметры
    const hasClickParam = CLICK_PARAMS.some((p) => u.searchParams.has(p));
    if (!hasClickParam) return { ok: false, reason: 'no-click-param' };

    // и корректный ulp (внутренняя целевая ссылка)
    const ulp = u.searchParams.get('ulp');
    if (!ulp) return { ok: false, reason: 'no-ulp' };

    try {
      const target = new URL(decodeURIComponent(ulp));
      const targetProtoOk = target.protocol === 'http:' || target.protocol === 'https:';
      const targetHostOk = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(target.hostname);
      const targetPathOk = typeof target.pathname === 'string' && target.pathname.length >= 2;
      if (!targetProtoOk || !targetHostOk || !targetPathOk)
        return { ok: false, reason: 'bad-ulp-url' };
    } catch {
      return { ok: false, reason: 'bad-ulp-decode' };
    }
  }

  return { ok: true };
}


// ============================================
// [3] Формирование перехода через /api/go
// ============================================
// [ВОССТАНОВЛЕНО] Возвращаем ПРЯМОЙ партнёрский URL из gift.*
// ВАЖНО: /api/go формируется в GiftCard.js, как в оригинале
export function resolveGiftUrl(gift) {
  if (!gift) return null;

  // как в твоём main.js: поддерживаем строку и массив ссылок
  if (Array.isArray(gift.link)) {
    const first = gift.link.find(Boolean);
    if (first && /^https?:\/\//i.test(first)) return first;
  }
  if (typeof gift.link === 'string' && /^https?:\/\//i.test(gift.link)) return gift.link;

  // (опц.) совместимость, если где-то лежит в url/href
  if (typeof gift.url === 'string' && /^https?:\/\//i.test(gift.url)) return gift.url;
  if (typeof gift.href === 'string' && /^https?:\/\//i.test(gift.href)) return gift.href;

  return null;
}


// ============================================
// [4] Прелоадер-переход с overlay-анимацией
// ============================================
// [ВОССТАНОВЛЕНО] Полноценный прелоадер в новой вкладке, как в оригинальном main.js
export function openWithPreloader(
  targetUrl,
  title = 'Подбираем подарки…',
  sub = 'Скоро откроем магазин',
  delayMs = 1600
) {
  const w = window.open('', '_blank');
  if (!w) {
    // попапы заблокированы — показываем оверлей в текущей вкладке и идём туда же
    if (typeof window.showTransitionOverlay === 'function') {
      window.showTransitionOverlay('Открываем магазин…', 1800);
    }
    setTimeout(() => {
      window.location.href = targetUrl;
    }, 100);
    return;
  }

  const html = `<!DOCTYPE html><html lang="ru"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>${title}</title>
<style>
  body {
    margin: 0;
    background: transparent;
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  .overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.12);
    backdrop-filter: blur(14px) saturate(130%);
    -webkit-backdrop-filter: blur(14px) saturate(130%);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .overlay.show {
    opacity: 1;
    pointer-events: all;
  }
  .overlay::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle at center, rgba(255, 255, 255, 0.15) 0%, transparent 70%);
    opacity: 0.3;
    pointer-events: none;
    z-index: -1;
  }
  .overlay-content {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    color: #ffffff;
    animation: fadeInUpOverlay 0.6s ease both;
    max-width: 90vw;
    padding: 24px 20px;
    background: #8a84ff;
    border-radius: 20px;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 10px 32px rgba(0, 0, 0, 0.08);
  }
  .spinner {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    border: 4px solid transparent;
    border-top-color: #ff7e5f;
    border-right-color: #00c9ff;
    border-bottom-color: #6c63ff;
    animation: spinSmooth 1.4s linear infinite, glowPulse 3s ease-in-out infinite alternate;
  }
  .overlay-text {
    font-size: 1.1rem;
    font-weight: 500;
    opacity: 0.92;
    line-height: 1.4;
    color: #ffffff;
  }
  @keyframes spinSmooth { to { transform: rotate(360deg); } }
  @keyframes glowPulse {
    from { filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.15)); }
    to   { filter: drop-shadow(0 0 18px rgba(255, 255, 255, 0.4)); }
  }
  @keyframes fadeInUpOverlay {
    from { opacity: 0; transform: translateY(24px) scale(0.95); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
</style>
</head>
<body>
  <div class="overlay show" role="status" aria-live="polite">
    <div class="overlay-content" aria-label="${title}">
      <div class="spinner" aria-hidden="true"></div>
      <div class="overlay-text">${title}</div>
      <div class="overlay-text" style="opacity:.7; font-size:.95rem;">${sub}</div>
    </div>
  </div>

  <script>
    try { window.opener = null; } catch(e){}
    let moved = false;
    function go(){
      if (moved) return; moved = true;
      location.href = ${JSON.stringify(targetUrl)};
    }
    setTimeout(go, ${Math.max(0, delayMs) | 0});
    setTimeout(go, 5000); // страховка
  </script>
  <noscript><meta http-equiv="refresh" content="0; url=${targetUrl}"></noscript>
</body>
</html>`;

  try {
    w.document.open();
    w.document.write(html);
    w.document.close();
  } catch {
    try {
      w.location.href = targetUrl;
    } catch {}
  }
}

// ============================================
// [5] Сборка зависимостей для карточек подарков
// ============================================
export function createGiftCardDeps(API_BASE) {
  return {
    showTransitionOverlay,
    openWithPreloader,
    resolveGiftUrl: (gift) => resolveGiftUrl(gift, API_BASE),
    validatePartnerUrl,
    b64url,
    translateCategory,
    formatPrice,
    API_BASE,
  };
}
