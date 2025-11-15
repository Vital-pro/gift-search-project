// gift-search-site/src/app/utils/links.js
// [НОВЫЙ ФАЙЛ] Утилиты ссылок и прелоадер-окно.
// Без зависимостей от глобального состояния приложения.

/**
 * Разрешение валидной URL подарка (как было)
 */
export function resolveGiftUrl(gift) {
  if (Array.isArray(gift.link)) {
    const first = gift.link.find(Boolean);
    if (first && /^https?:\/\//i.test(first)) return first;
  }
  if (typeof gift.link === 'string' && /^https?:\/\//i.test(gift.link)) return gift.link;
  return null;
}

/**
 * Базовая валидация партнёрских ссылок (как было)
 */
export function validatePartnerUrl(raw) {
  if (!raw || typeof raw !== 'string') return { ok: false, reason: 'empty' };
  if (!/^https?:\/\//i.test(raw)) return { ok: false, reason: 'no-scheme' };
  if (/^\s*erid\s*=/i.test(raw)) return { ok: false, reason: 'starts-with-param' };
  if (/\s/.test(raw)) return { ok: false, reason: 'spaces' };

  let u;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: 'bad-url' };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:')
    return { ok: false, reason: 'bad-protocol' };
  const hostLooksOk = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(u.hostname);
  if (!hostLooksOk) return { ok: false, reason: 'bad-host' };

  const affiliateDomains = new Set([
    'bywiola.com',
    'yyczo.com',
    'uuwgc.com',
    'qwpeg.com',
    'xpuvo.com',
    'admitad.com',
    'actionpay.net',
    'cityads.com',
    'effiliation.com',
    'advcake.com',
  ]);
  const CLICK_PARAMS = ['erid', 'subid', 'sub_id', 'sub1', 'clickid', 'admitad_uid'];

  if (affiliateDomains.has(u.hostname)) {
    const hasClickParam = CLICK_PARAMS.some((p) => u.searchParams.has(p));
    if (!hasClickParam) return { ok: false, reason: 'no-click-param' };
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

/**
 * Открытие targetUrl в новом окне с «прелоадерной» страницей (как было).
 * Без изменений логики/таймингов.
 */
export function openWithPreloader(
  targetUrl,
  title = 'Подбираем подарки…',
  sub = 'Скоро откроем магазин',
  delayMs = 1600,
) {
  const w = window.open('', '_blank');
  if (!w) {
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
  .overlay.show { opacity: 1; pointer-events: all; }
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
    background: rgba(255, 255, 255, 0.04);
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
  .overlay-text { font-size: 1.1rem; font-weight: 500; opacity: 0.92; line-height: 1.4; color: #ffffff; }
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
    setTimeout(go, 5000);
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
