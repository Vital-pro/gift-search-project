/* eslint-env browser */
/* global window, document, URLSearchParams, location */

// Импорт данных о подарках
import { GIFTS as GIFTS } from './data/index.js';
import { parseQuery } from './src/domain/parseQuery.js';
import { filterGifts } from './src/domain/filterGifts.js';
import { createTelegramCTA } from './src/ui/components/TelegramCTA.js';
import { createGiftCard } from './src/ui/components/GiftCard.js';
import { showTransitionOverlay } from './src/ui/components/Overlay.js';
import { initStickySearch } from './src/ui/stickySearch.js';


import { registerServiceWorker } from './src/services/sw-register.js';


// ===============================
// Конфиг
// ===============================
const TELEGRAM_BOT_URL = 'https://t.me/presentsuperBot';
const INITIAL_BATCH = 15;
const LOAD_BATCH = 9;
const PROMO_GIFTS_IDS = [1, 3, 5, 8, 12, 15];

// === БАЗА API для межстраничного редиректа ===
// В проде используем относительный путь (тот же домен).
// На localhost прокидываем на прод-домен, где реально работает /api/go.
const PROD_ORIGIN = 'https://gift-search-project.vercel.app'; // ← если у тебя другой домен — подставь его
const API_BASE =
  typeof location !== 'undefined' && location.hostname === 'localhost' ? PROD_ORIGIN : '';

// Состояние приложения
let currentFilters = { recipient: null, age: null, budget: null };
let isSearchMode = false;

// --- Состояние каталога ---
let shuffledCatalogGifts = [];
let catalogOffset = 0;

// --- Состояние поиска ---
let searchAll = [];
let searchOffset = 0;

// ===============================
// Хелперы UI
// ===============================
function formatPrice(price) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function translateCategory(category) {
  const translations = {
    beauty: 'Красота',
    health: 'Здоровье',
    tech: 'Техника',
    hobby: 'Хобби',
    tools: 'Инструменты',
    toys: 'Игрушки',
    education: 'Образование',
    creative: 'Творчество',
    jewelry: 'Украшения',
    perfume: 'Парфюм',
    sport: 'Спорт',
    grooming: 'Уход',
    office: 'Офис',
    food: 'Еда',
    home: 'Дом',
    photo: 'Фото',
    entertainment: 'Развлечения',
    transport: 'Транспорт',
    books: 'Книги',
    clothes: 'Одежда',
    outdoor: 'Outdoor',
    universal: 'Универсальное',
  };
  return translations[category] || category;
}


function openWithPreloader(
  targetUrl,
  title = 'Подбираем подарки…',
  sub = 'Скоро откроем магазин',
  delayMs = 1600,
) {
  const w = window.open('', '_blank');
  if (!w) {
    // попапы заблокированы — показываем наш оверлей в текущей вкладке и идём в ту же
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
    from {
      opacity: 0;
      transform: translateY(24px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
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
    // основной таймер
    setTimeout(go, ${Math.max(0, delayMs) | 0});
    // страховка
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

// Отладка: Shift+O покажет оверлей. И окно window.__overlayTest()
// [ИЗМЕНЕНО] тест тоже показывает новый текст
window.__overlayTest = () => showTransitionOverlay('🎁 Подбираем лучший подарок для вас...', 1200);

document.addEventListener('keydown', (e) => {
  if (e.shiftKey && (e.key === 'O' || e.key === 'О')) {
    window.__overlayTest();
  }
});

// ===============================
// Валидация партнёрских ссылок (без сети)
// ===============================
function resolveGiftUrl(gift) {
  if (Array.isArray(gift.link)) {
    const first = gift.link.find(Boolean);
    if (first && /^https?:\/\//i.test(first)) return first;
  }
  if (typeof gift.link === 'string' && /^https?:\/\//i.test(gift.link)) return gift.link;
  return null;
}

function validatePartnerUrl(raw) {
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
      const targetProtoOk = target.protocol === 'http:' || 'https:' === target.protocol;
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

// base64url
function b64url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// === deps for GiftCard component (собираем в одном месте)
const GIFT_CARD_DEPS = {
  showTransitionOverlay,
  openWithPreloader,
  resolveGiftUrl,
  validatePartnerUrl,
  b64url,
  translateCategory,
  formatPrice,
  API_BASE,
};





// ===============================
// Псевдо-запрос к БД (эмуляция задержки)
function fetchGiftsBatch(allItems, offset, limit) {
  const slice = allItems.slice(offset, offset + limit);
  return new Promise((resolve) => {
    console.log(`[fetch] offset=${offset}, limit=${limit}, willReturn=${slice.length}`);
    setTimeout(() => resolve(slice), 250);
  });
}


// =====ПРОМО==========================
function renderPromoGifts() {
  const grid = document.getElementById('randomGifts');
  if (!grid) return;

  grid.innerHTML = '';

  const promoGifts = GIFTS.filter((g) => PROMO_GIFTS_IDS.includes(g.id)).slice(0, 6);
  promoGifts.forEach((gift) => grid.appendChild(createGiftCard(gift, GIFT_CARD_DEPS)));
;


  // Скрываем спиннер ТОЛЬКО ПОСЛЕ рендера
  const loader = document.getElementById('promoLoader');
  if (loader) {
    loader.classList.add('hidden');
    loader.setAttribute('aria-hidden', 'true'); // [fix] не падаем, если элемента нет
  }
}

// ===============================
// Каталог
function initCatalogList() {
  const catalogGrid = document.getElementById('catalogGifts');
  const catalogShowMoreBtn = document.getElementById('catalogShowMoreBtn');
  const catalogCTAContainer = document.getElementById('catalogCTAContainer');
  const catalogLoader = document.getElementById('catalogLoader');
  const catalogResetBtn = document.getElementById('catalogResetBtn');
  if (!catalogGrid || !catalogShowMoreBtn || !catalogCTAContainer) return;

  const nonPromoGifts = GIFTS.filter((g) => !PROMO_GIFTS_IDS.includes(g.id));
  shuffledCatalogGifts = [...nonPromoGifts];
  for (let i = shuffledCatalogGifts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledCatalogGifts[i], shuffledCatalogGifts[j]] = [
      shuffledCatalogGifts[j],
      shuffledCatalogGifts[i],
    ];
  }

  catalogOffset = 0;
  catalogGrid.innerHTML = '';
  catalogShowMoreBtn.classList.add('hidden');
  catalogResetBtn?.classList.add('hidden');
  catalogCTAContainer.innerHTML = '';
  catalogCTAContainer.appendChild(createTelegramCTA(TELEGRAM_BOT_URL)); // [изменено] передаём URL бота

  const catalogInitialLoader = document.getElementById('catalogInitialLoader');
  catalogInitialLoader?.classList.remove('hidden');
  catalogLoader?.classList.add('hidden'); // скрываем пагинационный спиннер
  catalogLoader?.setAttribute('aria-hidden', 'true'); // [fix] через optional chaining

  fetchGiftsBatch(shuffledCatalogGifts, catalogOffset, INITIAL_BATCH).then((batch) => {
    batch.forEach((g) => catalogGrid.appendChild(createGiftCard(g, GIFT_CARD_DEPS)));
    catalogOffset += batch.length;
    catalogInitialLoader?.classList.add('hidden');
    catalogInitialLoader?.setAttribute('aria-hidden', 'true');
    // catalogLoader?.classList.add('hidden');

    if (catalogOffset < shuffledCatalogGifts.length) {
      catalogShowMoreBtn.classList.remove('hidden');
    } else {
      catalogShowMoreBtn.classList.add('hidden');
      catalogResetBtn?.classList.remove('hidden');
    }
  });

  catalogShowMoreBtn.onclick = () => {
    if (catalogOffset >= shuffledCatalogGifts.length) return;
    catalogLoader?.classList.remove('hidden');
    // catalogShowMoreBtn.setAttribute('aria-busy', 'true');
    // catalogShowMoreBtn.disabled = true;
    // catalogShowMoreBtn.textContent = 'Загружаем…';

    fetchGiftsBatch(shuffledCatalogGifts, catalogOffset, LOAD_BATCH)
      .then((batch) => {
        batch.forEach((g) => catalogGrid.appendChild(createGiftCard(g, GIFT_CARD_DEPS)));
        catalogOffset += batch.length;
      })
      .catch((err) => {
        console.error('[catalog] Ошибка загрузки:', err);
      })
      .finally(() => {
        catalogLoader?.classList.add('hidden');
        // catalogShowMoreBtn.setAttribute('aria-busy', 'false');
        // catalogShowMoreBtn.disabled = false;
        // catalogShowMoreBtn.textContent = 'Посмотреть ещё';
        if (catalogOffset >= shuffledCatalogGifts.length) {
          catalogShowMoreBtn.classList.add('hidden');
          catalogResetBtn?.classList.remove('hidden');
        }
      });
  };

  if (catalogResetBtn) catalogResetBtn.onclick = resetToPromo;
}


function resetToPromo() {
  const catalogGrid = document.getElementById('catalogGifts');
  const catalogShowMoreBtn = document.getElementById('catalogShowMoreBtn');
  const catalogCTAContainer = document.getElementById('catalogCTAContainer');
  const catalogResetBtn = document.getElementById('catalogResetBtn');

  if (catalogGrid) catalogGrid.innerHTML = '';
  catalogShowMoreBtn?.classList.add('hidden');
  catalogCTAContainer && (catalogCTAContainer.innerHTML = '');
  catalogResetBtn?.classList.add('hidden');

  initCatalogList();

  const promoSection = document.querySelector('.random-gifts');
  if (promoSection) promoSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===============================
// Поиск
function performSearch() {
  const searchInput = document.getElementById('searchInput');
  const query = searchInput?.value.trim() || '';

  if (!query) {
    showNoResults('Введите запрос для поиска');
    hideSection('searchResults');
    return;
  }

  const params = parseQuery(query);
  const filtered = filterGifts(GIFTS, params);

  if (filtered.length === 0) {
    showNoResults();
    hideSection('searchResults');
    return;
  }

  isSearchMode = true;
  currentFilters = params;
  searchAll = filtered;
  searchOffset = 0;

  showSearchResults(filtered, params);
}

function performAlternativeSearch() {
  const recipient = document.getElementById('recipientSelect').value;
  const age = document.getElementById('ageInput').value;
  const budget = document.getElementById('budgetInput').value;

  const params = {
    recipient: recipient || null,
    age: age ? parseInt(age) : null,
    budget: budget ? parseInt(budget) : null,
  };

  const filtered = filterGifts(GIFTS, params);

  if (filtered.length === 0) {
    showNoResults();
    hideSection('searchResults');
    return;
  }

  isSearchMode = true;
  currentFilters = params;
  searchAll = filtered;
  searchOffset = 0;

  showSearchResults(filtered, params);
}

function showSearchResults(gifts, params) {
  const section = document.getElementById('searchResults');
  const resultsCount = document.getElementById('resultsCount');
  const resultsTitle = document.getElementById('resultsTitle');
  const randomSection = document.getElementById('randomGifts')?.closest('section');
  const catalogSection = document.getElementById('catalogSection');
  const heroSection = document.querySelector('.hero');
  const searchBlock = document.querySelector('.search-block');
  const grid = document.getElementById('resultsGrid');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const searchCTAContainer = document.getElementById('searchCTAContainer');

  if (!section || !grid || !loadMoreBtn || !searchCTAContainer) return;

  randomSection?.classList.add('hidden');
  catalogSection?.classList.add('hidden');

  heroSection?.classList.add('compact');
  searchBlock?.classList.add('compact');

  let title = 'Результаты поиска';
  if (params.recipient) title = `Подарки для: ${params.recipient}`;
  resultsTitle.textContent = title;
  resultsCount.textContent = `(${gifts.length})`;

  grid.innerHTML = '';
  searchOffset = 0;

  searchCTAContainer.innerHTML = '';
  searchCTAContainer.appendChild(createTelegramCTA(TELEGRAM_BOT_URL)); // [изменено] передаём URL бота

  section.classList.remove('hidden');

  fetchGiftsBatch(searchAll, searchOffset, INITIAL_BATCH).then((batch) => {
    batch.forEach((g) => grid.appendChild(createGiftCard(g, GIFT_CARD_DEPS)));
    searchOffset += batch.length;

    if (searchOffset < searchAll.length) {
      loadMoreBtn.textContent = 'Посмотреть ещё';
      loadMoreBtn.classList.remove('hidden');
      // loadMoreBtn.setAttribute('aria-busy', 'false');
      // loadMoreBtn.disabled = false;
      // loadMoreBtn.textContent = 'Посмотреть ещё';
      loadMoreBtn.onclick = handleSearchLoadMore;
    } else {
      loadMoreBtn.textContent = 'Начать поиск заново';
      loadMoreBtn.classList.remove('hidden');
      loadMoreBtn.onclick = resetSearch;
    }

    setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  });
}

function handleSearchLoadMore() {
  const grid = document.getElementById('resultsGrid');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (!grid || !loadMoreBtn) return;

  fetchGiftsBatch(searchAll, searchOffset, LOAD_BATCH).then((batch) => {
    batch.forEach((g) => grid.appendChild(createGiftCard(g, GIFT_CARD_DEPS)));
    searchOffset += batch.length;

    if (searchOffset < searchAll.length) {
      loadMoreBtn.textContent = 'Посмотреть ещё';
      loadMoreBtn.classList.remove('hidden');
    } else {
      loadMoreBtn.textContent = 'Начать поиск заново';
      loadMoreBtn.classList.remove('hidden');
      loadMoreBtn.onclick = resetSearch;
    }
  });
}


function initLazySections() {
  const sections = document.querySelectorAll('.lazy-section');
  const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);
  sections.forEach((section) => observer.observe(section));
}

function initThemeToggle() {
  const themeToggle = document.querySelector('.theme-toggle');
  const themeIcon = document.querySelector('.theme-icon');
  const saved = localStorage.getItem('theme');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  let theme = saved || (systemDark ? 'dark' : 'light');
  const apply = (t) => {
    document.documentElement.setAttribute('data-theme', t);
    themeIcon && (themeIcon.textContent = t === 'dark' ? '☀️' : '🌙');
    themeToggle && themeToggle.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
  };
  apply(theme);
  themeToggle?.addEventListener('click', () => {
    theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', theme);
    apply(theme);
  });
  if (!saved) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', (e) => {
      theme = e.matches ? 'dark' : 'light';
      apply(theme);
    });
  }
}

function initTooltip() {
  const helpBtn = document.querySelector('.help-btn');
  const tooltip = document.getElementById('tooltip');
  if (!helpBtn || !tooltip) return;
  helpBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (tooltip.classList.contains('hidden')) {
      const rect = helpBtn.getBoundingClientRect();
      tooltip.style.top = `${rect.bottom + 10}px`;
      tooltip.style.left = `${rect.left - 200}px`;
      tooltip.classList.remove('hidden');
    } else {
      tooltip.classList.add('hidden');
    }
  });
  document.addEventListener('click', () => tooltip.classList.add('hidden'));
}

function setTelegramLink() {
  const telegramLink = document.getElementById('telegramLink');
  if (telegramLink) {
    const utm = new URLSearchParams({
      start: 'web_catalog',
      utm_source: 'site',
      utm_medium: 'footer',
      utm_campaign: 'giftbot',
    }).toString();
    telegramLink.href = `${TELEGRAM_BOT_URL}?${utm}`;
  }
}



function initToTopButton() {
  const toTopBtn = document.getElementById('toTopBtn');
  if (!toTopBtn) return;
  const SCROLL_THRESHOLD = 300;
  let ticking = false;
  function updateToTopButton() {
    const scrolled = window.pageYOffset || document.documentElement.scrollTop;
    if (scrolled > SCROLL_THRESHOLD) toTopBtn.classList.remove('hidden');
    else toTopBtn.classList.add('hidden');
    ticking = false;
  }
  function requestTick() {
    if (!ticking) {
      window.requestAnimationFrame(updateToTopButton);
      ticking = true;
    }
  }
  window.addEventListener('scroll', requestTick);
  toTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  updateToTopButton();
}

// ===============================
// Нет результатов / утилиты
function showNoResults(message = null) {
  const section = document.getElementById('noResults');
  section.classList.remove('hidden');
  if (message) {
    const p = section.querySelector('p');
    p.textContent = message;
  }
}
function hideSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) section.classList.add('hidden');
}
function resetSearch() {
  isSearchMode = false;

  const randomSection = document.getElementById('randomGifts')?.closest('section');
  const catalogSection = document.getElementById('catalogSection');
  const heroSection = document.querySelector('.hero');
  const searchBlock = document.querySelector('.search-block');
  const resultsSection = document.getElementById('searchResults');
  const noResultsSection = document.getElementById('noResults');
  const searchInput = document.getElementById('searchInput');

  randomSection?.classList.remove('hidden');
  catalogSection?.classList.remove('hidden');
  heroSection?.classList.remove('compact');
  searchBlock?.classList.remove('compact');
  resultsSection?.classList.add('hidden');
  noResultsSection?.classList.add('hidden');
  if (searchInput) searchInput.value = '';

  renderPromoGifts();
  initCatalogList();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===============================
// Инициализация
function init() {
  // Показываем спиннеры ДО загрузки
  const promoLoader = document.getElementById('promoLoader');
  const catalogInitialLoader = document.getElementById('catalogInitialLoader');
  if (promoLoader) promoLoader.classList.remove('hidden');
  if (catalogInitialLoader) catalogInitialLoader.classList.remove('hidden');

  renderPromoGifts();
  initCatalogList();

  // initParallax();
  initLazySections();
  initThemeToggle();
  initTooltip();
  initStickySearch();
  initToTopButton();
  setTelegramLink();

  registerServiceWorker();

  const searchBtn = document.getElementById('searchBtn');
  const searchInput = document.getElementById('searchInput');
  const altSearchBtn = document.getElementById('altSearchBtn');

  searchBtn?.addEventListener('click', performSearch);
  searchInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
  });
  altSearchBtn?.addEventListener('click', performAlternativeSearch);

  searchInput?.focus();

  const urlParams = new URLSearchParams(window.location.search);
  const q = urlParams.get('q');
  if (q && searchInput) {
    searchInput.value = q;
    performSearch();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

if (typeof window !== 'undefined') {
  window.showTransitionOverlay = showTransitionOverlay;
  window.openWithPreloader = openWithPreloader;
  // чтобы копия поиска могла триггерить действия:
  window.performSearch = performSearch;
  window.performAlternativeSearch = performAlternativeSearch;
}

