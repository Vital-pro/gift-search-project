// Импорт данных о подарках
import { GIFTS as GIFTS } from './data/index.js';
import { recipientMap } from './vendor/recipient-map.js';

// ===============================
// Конфиг
// ===============================
const TELEGRAM_BOT_URL = 'https://t.me/presentsuperBot';
const INITIAL_BATCH = 15;
const LOAD_BATCH = 9;
const PROMO_GIFTS_IDS = [1, 3, 5, 8, 12, 15];

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

// ===============================
// Оверлей плавного перехода на исходной вкладке
// ===============================
function showTransitionOverlay(msg = 'Открываем магазин…', autoHideMs = 1200) {
  const el = document.getElementById('transitionOverlay');
  if (!el) return;
  const text = el.querySelector('.overlay-text');
  if (text) text.textContent = msg;

  // FIX: фон оверлея не перехватывает клики по ссылкам под ним
  el.style.pointerEvents = 'none';

  el.classList.remove('hidden');
  // force reflow
  // eslint-disable-next-line no-unused-expressions
  el.offsetHeight;
  el.classList.add('visible');
  if (autoHideMs > 0) setTimeout(() => hideTransitionOverlay(), autoHideMs);
}

function hideTransitionOverlay() {
  const el = document.getElementById('transitionOverlay');
  if (!el) return;
  el.classList.remove('visible');
  setTimeout(() => {
    el.classList.add('hidden');
    // Чистим на всякий случай, чтобы не «прилипло»
    el.style.pointerEvents = '';
  }, 220);
}

// ===============================
// Валидация партнёрских ссылок (без сети)
// ===============================
function resolveGiftUrl(gift) {
  if (Array.isArray(gift.link)) {
    const first = gift.link.find(Boolean);
    if (first && /^https?:\/\//i.test(first)) return first;
  }
  if (typeof gift.link === 'string' && /^https?:\/\//i.test(gift.link))
    return gift.link;
  return null;
}

function validatePartnerUrl(raw) {
  if (!raw || typeof raw !== 'string') return { ok: false, reason: 'empty' };
  if (!/^https?:\/\//i.test(raw)) return { ok: false, reason: 'no-scheme' };
  if (/^\s*erid\s*=/i.test(raw))
    return { ok: false, reason: 'starts-with-param' };
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
  const CLICK_PARAMS = [
    'erid',
    'subid',
    'sub_id',
    'sub1',
    'clickid',
    'admitad_uid',
  ];

  if (affiliateDomains.has(u.hostname)) {
    const hasClickParam = CLICK_PARAMS.some((p) => u.searchParams.has(p));
    if (!hasClickParam) return { ok: false, reason: 'no-click-param' };
    const ulp = u.searchParams.get('ulp');
    if (!ulp) return { ok: false, reason: 'no-ulp' };
    try {
      const target = new URL(decodeURIComponent(ulp));
      const targetProtoOk =
        target.protocol === 'http:' || 'https:' === target.protocol;
      const targetHostOk = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(target.hostname);
      const targetPathOk =
        typeof target.pathname === 'string' && target.pathname.length >= 2;
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

// ===============================
// «Кому»: группировка и фильтрация
// ===============================
const CHILD_MAX_AGE = 13;
const RECIPIENT_GROUPS = {
  maleChild: new Set(['брат', 'сын', 'мальчик', 'племянник', 'внук']),
  femaleChild: new Set(['сестра', 'дочь', 'девочка', 'внучка', 'племянница']),
  childAny: new Set([
    'ребенок',
    'ребёнок',
    'дети',
    'ребенку',
    'ребёнку',
    'детям',
  ]),
  maleAdult: new Set([
    'муж',
    'парень',
    'папа',
    'отец',
    'дедушка',
    'начальник',
    'друг',
    'коллега',
  ]),
  femaleAdult: new Set([
    'жена',
    'девушка',
    'мама',
    'мать',
    'бабушка',
    'подруга',
    'сестра',
    'коллега',
  ]),
  adultAny: new Set(['родственник', 'родня', 'семья', 'человек']),
};
const TAGS_MALE_CHILD = new Set([
  'сын',
  'брат',
  'мальчик',
  'внук',
  'племянник',
]);
const TAGS_FEMALE_CHILD = new Set([
  'дочь',
  'сестра',
  'девочка',
  'внучка',
  'племянница',
]);
const TAGS_GENERIC_CHILD = new Set([
  'ребёнок',
  'ребенок',
  'дети',
  'семья',
  'унисекс',
]);
const TAGS_MALE_ADULT = new Set([
  'муж',
  'папа',
  'отец',
  'дедушка',
  'парень',
  'брат',
  'коллега',
  'начальник',
]);
const TAGS_FEMALE_ADULT = new Set([
  'жена',
  'мама',
  'бабушка',
  'девушка',
  'сестра',
  'подруга',
  'коллега',
  'начальник',
]);
const TAGS_GENERIC_ADULT = new Set([
  'семья',
  'унисекс',
  'пара',
  'дом',
  'универсально',
]);

function intersects(setA, setB) {
  for (const v of setB) if (setA.has(v)) return true;
  return false;
}
function inferRecipientGroup(recipient, age) {
  const r = (recipient || '').toLowerCase();
  const isChild = age != null && age <= CHILD_MAX_AGE;
  if (isChild) {
    if (RECIPIENT_GROUPS.maleChild.has(r)) return 'maleChild';
    if (RECIPIENT_GROUPS.femaleChild.has(r)) return 'femaleChild';
    if (RECIPIENT_GROUPS.childAny.has(r)) return 'childAny';
    return 'childAny';
  } else {
    if (RECIPIENT_GROUPS.maleAdult.has(r)) return 'maleAdult';
    if (RECIPIENT_GROUPS.femaleAdult.has(r)) return 'femaleAdult';
    return 'adultAny';
  }
}
function matchesRecipientGroup(gift, group) {
  const tags = (gift.recipientTags || []).map((t) => t.toLowerCase());
  const tagSet = new Set(tags);
  if (group === 'maleChild') {
    const allow =
      intersects(tagSet, TAGS_MALE_CHILD) ||
      intersects(tagSet, TAGS_GENERIC_CHILD);
    const onlyFemale =
      intersects(tagSet, TAGS_FEMALE_CHILD) &&
      !intersects(tagSet, TAGS_MALE_CHILD) &&
      !intersects(tagSet, TAGS_GENERIC_CHILD);
    return allow && !onlyFemale;
  }
  if (group === 'femaleChild') {
    const allow =
      intersects(tagSet, TAGS_FEMALE_CHILD) ||
      intersects(tagSet, TAGS_GENERIC_CHILD);
    const onlyMale =
      intersects(tagSet, TAGS_MALE_CHILD) &&
      !intersects(tagSet, TAGS_FEMALE_CHILD) &&
      !intersects(tagSet, TAGS_GENERIC_CHILD);
    return allow && !onlyMale;
  }
  if (group === 'childAny') {
    return (
      intersects(tagSet, TAGS_GENERIC_CHILD) ||
      intersects(tagSet, TAGS_MALE_CHILD) ||
      intersects(tagSet, TAGS_FEMALE_CHILD)
    );
  }
  if (group === 'maleAdult') {
    const allow =
      intersects(tagSet, TAGS_MALE_ADULT) ||
      intersects(tagSet, TAGS_GENERIC_ADULT);
    const onlyFemale =
      intersects(tagSet, TAGS_FEMALE_ADULT) &&
      !intersects(tagSet, TAGS_MALE_ADULT) &&
      !intersects(tagSet, TAGS_GENERIC_ADULT);
    return allow && !onlyFemale;
  }
  if (group === 'femaleAdult') {
    const allow =
      intersects(tagSet, TAGS_FEMALE_ADULT) ||
      intersects(tagSet, TAGS_GENERIC_ADULT);
    const onlyMale =
      intersects(tagSet, TAGS_MALE_ADULT) &&
      !intersects(tagSet, TAGS_FEMALE_ADULT) &&
      !intersects(tagSet, TAGS_GENERIC_ADULT);
    return allow && !onlyMale;
  }
  return (gift.recipientTags || []).length > 0;
}

// ===============================
// Парсер строки поиска
// ===============================
function parseQuery(input) {
  const result = { recipient: null, age: null, budget: null };
  if (!input || !input.trim()) return result;

  const normalized = input.toLowerCase().trim();
  const tokens = normalized.split(/\s+/);
  const numbers = [];
  const words = [];

  tokens.forEach((token) => {
    const num = parseInt(token);
    if (!isNaN(num) && num > 0) numbers.push(num);
    else words.push(token);
  });

  const recipientQuery = words.join(' ');
  for (const [key, synonymsList] of Object.entries(recipientMap)) {
    const allVariants = [key, ...synonymsList];
    if (allVariants.some((variant) => recipientQuery.includes(variant))) {
      result.recipient = key;
      break;
    }
  }

  if (numbers.length === 1) {
    if (numbers[0] >= 1000) result.budget = numbers[0];
    else if (numbers[0] <= 100) result.age = numbers[0];
    else result.budget = numbers[0];
  } else if (numbers.length >= 2) {
    const sorted = [...numbers].sort((a, b) => a - b);
    if (sorted[0] <= 100) {
      result.age = sorted[0];
      result.budget = sorted[sorted.length - 1];
    } else {
      result.budget = sorted[sorted.length - 1];
    }
  }
  return result;
}

// ===============================
// Фильтрация подарков
// ===============================
function filterGifts(gifts, params) {
  const age = params.age != null ? parseInt(params.age) : null;
  const budget = params.budget != null ? parseInt(params.budget) : null;
  const recipient = params.recipient || null;
  const group = inferRecipientGroup(recipient, age);

  return gifts.filter((gift) => {
    if (age !== null && age !== undefined) {
      if (
        !Array.isArray(gift.ageRange) ||
        age < gift.ageRange[0] ||
        age > gift.ageRange[1]
      )
        return false;
    }
    if (budget !== null && budget !== undefined) {
      if (typeof gift.price === 'number' && gift.price > budget) return false;
    }
    if (recipient) {
      if (!matchesRecipientGroup(gift, group)) return false;
    }
    return true;
  });
}

// ===============================
// CTA блок
// ===============================
function createTelegramCTA() {
  const ctaBlock = document.createElement('div');
  ctaBlock.className = 'telegram-cta-inline glass-effect';
  ctaBlock.innerHTML = `
    <div class="telegram-cta-content">
      <h3 class="telegram-cta-title">🤖 Подарочный помощник в твоём кармане</h3>
      <p class="telegram-cta-text">Наш чат-бот в Telegram подскажет идеи подарков за секунды — где бы ты ни был</p>
      <a href="${TELEGRAM_BOT_URL}?start=catalog&utm_source=site&utm_medium=inline_cta&utm_campaign=giftbot" class="telegram-cta-btn">
        <svg class="telegram-icon" viewBox="0 0 24 24" width="20" height="20">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121L8.32 13.617l-2.96-.924c-.64-.203-.658-.64.135-.953l11.566-4.458c.538-.196 1.006.128.832.941z"/>
        </svg>
        Перейти в Telegram-бота
      </a>
    </div>
    <div class="telegram-cta-decoration"><span class="decoration-icon">🎁</span></div>
  `;
  return ctaBlock;
}

// ===============================
// Межстраничный переход: карточка
// ===============================
function createGiftCard(gift) {
  const card = document.createElement('div');
  card.className = 'gift-card';
  card.style.animationDelay = `${Math.random() * 0.2}s`;

  const categoryIcons = {
    beauty: '💄',
    health: '💊',
    tech: '💻',
    hobby: '🎨',
    tools: '🔧',
    toys: '🧸',
    education: '📚',
    creative: '🎨',
    jewelry: '💎',
    perfume: '🌸',
    sport: '⚽',
    grooming: '🧔',
    office: '💼',
    food: '🍰',
    home: '🏠',
    photo: '📸',
    entertainment: '🎬',
    transport: '🛴',
    books: '📖',
    clothes: '👕',
    outdoor: '🏔️',
    universal: '🎁',
  };
  const icon = categoryIcons[gift.category] || '🎁';

  // Каркас
  card.innerHTML = `
    <div class="gift-card-image" aria-hidden="true">
      <span style="font-size: 4rem; line-height: 1;">${icon}</span>
    </div>
    <div class="gift-card-body">
      <h3 class="gift-card-title">${gift.name}</h3>
      <p class="gift-card-description">${gift.description || ''}</p>
      <div class="gift-card-price">${formatPrice(gift.price)}</div>
      <div class="gift-card-tags">
        ${
          Array.isArray(gift.recipientTags)
            ? gift.recipientTags
                .slice(0, 3)
                .map((t) => `<span class="gift-tag">${t}</span>`)
                .join('')
            : ''
        }
      </div>
      <div class="gift-card-footer">
        <span class="age-range">${gift.ageRange?.[0] ?? 0}-${
    gift.ageRange?.[1] ?? 120
  } лет</span>
        <span class="category-badge">${translateCategory(gift.category)}</span>
      </div>
      <div class="gift-card-actions" style="margin-top:12px;"></div>
    </div>
  `;

  const partnerUrl = resolveGiftUrl(gift);
  const actions = card.querySelector('.gift-card-actions');

  const setUnavailable = () => {
    if (!actions) return;
    actions.innerHTML = `<button class="gift-buy-btn" disabled aria-disabled="true" title="Товар временно недоступен">Ожидаем поставку</button>`;
    card.style.cursor = 'default';
    card.removeAttribute('role');
    card.removeAttribute('tabindex');
    card.removeAttribute('aria-label');
  };

  // [ИЗМЕНЕНО] — аккуратное поведение: ссылка работает нативно, карточка открывает в новой вкладке.
  // Оверлей не мешает клику (см. правку pointer-events для #transitionOverlay).
  const setAvailable = (partnerUrl) => {
    if (!actions) return;

    // const interstitialUrl = `/go.html?t=${b64url(partnerUrl)}`;
    
    // ИЗМЕНЕНО: используем серверный редирект вместо фронтовой страницы
    const interstitialUrl = `/api/go?t=${b64url(partnerUrl)}`;

    // 1) Рендерим НАСТОЯЩУЮ ссылку. Пусть браузер сам открывает её (надежнее всего).
    actions.innerHTML = `
    <a class="gift-buy-btn"
       href="${interstitialUrl}"
       target="_blank"
       rel="noopener nofollow sponsored"
       aria-label="Перейти к товару на площадке">К товару</a>
  `;
    const linkEl = actions.querySelector('.gift-buy-btn');

    // Показываем оверлей до клика — НО не блокируем событие.
    // linkEl.addEventListener('mousedown', () => showTransitionOverlay(), {
    //   passive: true,
    // });

    // Важно: НЕ делаем preventDefault. Только остановим всплытие, чтобы карточка не открыла вторую вкладку.
    linkEl.addEventListener('click', (e) => {
      e.stopPropagation(); // не даём событию «дойти» до обработчика карточки
    });

    // 2) Карточка: клик по пустому месту — открыть межстраницу в НОВОЙ вкладке.
    card.style.cursor = 'pointer';
    card.setAttribute('role', 'link');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Открыть товар: ${gift.name}`);

    // Только ЛКМ без модификаторов — открываем одну новую вкладку.
    card.addEventListener('click', (e) => {
      const isPrimary = e.button === 0;
      const hasMods = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
      if (!isPrimary || hasMods) return;
      window.open(interstitialUrl, '_blank', 'noopener'); // без фолбэка на текущую вкладку
    });

    // Доступность: Enter/Space
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        window.open(interstitialUrl, '_blank', 'noopener');
      }
    });
  };

  if (!partnerUrl) {
    setUnavailable();
    return card;
  }
  const v = validatePartnerUrl(partnerUrl);
  if (!v.ok) {
    setUnavailable();
    return card;
  }
  setAvailable(partnerUrl);
  return card;
}

// ===============================
// Псевдо-запрос к БД (эмуляция задержки)
function fetchGiftsBatch(allItems, offset, limit) {
  const slice = allItems.slice(offset, offset + limit);
  return new Promise((resolve) => {
    console.log(
      `[fetch] offset=${offset}, limit=${limit}, willReturn=${slice.length}`
    );
    setTimeout(() => resolve(slice), 250);
  });
}

// ===============================
// ПРОМО
function renderPromoGifts() {
  const promoGifts = GIFTS.filter((g) => PROMO_GIFTS_IDS.includes(g.id)).slice(
    0,
    6
  );
  const grid = document.getElementById('randomGifts');
  if (!grid) return;
  grid.innerHTML = '';
  promoGifts.forEach((gift) => grid.appendChild(createGiftCard(gift)));
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
  catalogCTAContainer.appendChild(createTelegramCTA());

  catalogLoader?.classList.remove('hidden');
  fetchGiftsBatch(shuffledCatalogGifts, catalogOffset, INITIAL_BATCH).then(
    (batch) => {
      batch.forEach((g) => catalogGrid.appendChild(createGiftCard(g)));
      catalogOffset += batch.length;
      catalogLoader?.classList.add('hidden');

      if (catalogOffset < shuffledCatalogGifts.length) {
        catalogShowMoreBtn.classList.remove('hidden');
      } else {
        catalogShowMoreBtn.classList.add('hidden');
        catalogResetBtn?.classList.remove('hidden');
      }
    }
  );

  catalogShowMoreBtn.onclick = () => {
    if (catalogOffset >= shuffledCatalogGifts.length) return;
    catalogLoader?.classList.remove('hidden');
    fetchGiftsBatch(shuffledCatalogGifts, catalogOffset, LOAD_BATCH).then(
      (batch) => {
        batch.forEach((g) => catalogGrid.appendChild(createGiftCard(g)));
        catalogOffset += batch.length;
        catalogLoader?.classList.add('hidden');

        if (catalogOffset < shuffledCatalogGifts.length) {
          catalogShowMoreBtn.classList.remove('hidden');
        } else {
          catalogShowMoreBtn.classList.add('hidden');
          catalogResetBtn?.classList.remove('hidden');
        }
      }
    );
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
  if (promoSection)
    promoSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  const randomSection = document
    .getElementById('randomGifts')
    ?.closest('section');
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
  searchCTAContainer.appendChild(createTelegramCTA());

  section.classList.remove('hidden');

  fetchGiftsBatch(searchAll, searchOffset, INITIAL_BATCH).then((batch) => {
    batch.forEach((g) => grid.appendChild(createGiftCard(g)));
    searchOffset += batch.length;

    if (searchOffset < searchAll.length) {
      loadMoreBtn.textContent = 'Посмотреть ещё';
      loadMoreBtn.classList.remove('hidden');
      loadMoreBtn.onclick = handleSearchLoadMore;
    } else {
      loadMoreBtn.textContent = 'Начать поиск заново';
      loadMoreBtn.classList.remove('hidden');
      loadMoreBtn.onclick = resetSearch;
    }

    setTimeout(
      () => section.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      80
    );
  });
}

function handleSearchLoadMore() {
  const grid = document.getElementById('resultsGrid');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (!grid || !loadMoreBtn) return;

  fetchGiftsBatch(searchAll, searchOffset, LOAD_BATCH).then((batch) => {
    batch.forEach((g) => grid.appendChild(createGiftCard(g)));
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

// ===============================
// Прочие UI-фичи
function initParallax() {
  const layers = document.querySelectorAll('.parallax-layer');
  let ticking = false,
    mouseX = 0,
    mouseY = 0;

  function updateParallax() {
    const scrolled = window.pageYOffset;
    const windowHeight = window.innerHeight;
    const scrollProgress = Math.min(scrolled / Math.max(windowHeight, 1), 1);

    layers.forEach((layer, index) => {
      const speed = 0.55 * (index + 1);
      const yPos = -(scrolled * speed);
      const mouseEffect = 36;
      const mouseXOffset =
        ((mouseX - window.innerWidth / 2) / window.innerWidth) *
        mouseEffect *
        (index + 1);
      const mouseYOffset =
        ((mouseY - window.innerHeight / 2) / window.innerHeight) *
        mouseEffect *
        (index + 1);
      layer.style.transform = `translate(${mouseXOffset}px, ${
        yPos + mouseYOffset
      }px) scale(${1 + scrollProgress * 0.12})`;
    });
    ticking = false;
  }
  function requestTick() {
    if (!ticking) {
      window.requestAnimationFrame(updateParallax);
      ticking = true;
    }
  }
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;
  if (!prefersReducedMotion) {
    window.addEventListener('scroll', requestTick);
    window.addEventListener('resize', requestTick);
    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      requestTick();
    });
  }
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
    themeToggle &&
      themeToggle.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
  };
  apply(theme);
  themeToggle?.addEventListener('click', () => {
    theme =
      document.documentElement.getAttribute('data-theme') === 'dark'
        ? 'light'
        : 'dark';
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

function initStickySearch() {
  const searchBlock = document.querySelector('.search-block');
  const hero = document.querySelector('.hero');
  if (!searchBlock || !hero) return;

  let ticking = false;
  function updateStickyState() {
    const scrolled = window.pageYOffset || document.documentElement.scrollTop;
    const heroHeight = hero.offsetHeight;
    const headerHeight = 60;
    const stickyPoint = heroHeight - headerHeight - 70;
    const details = document.querySelector('.controls-dropdown');

    if (scrolled > stickyPoint) {
      searchBlock.classList.add('sticky');
      if (details) details.open = !true;
    } else {
      searchBlock.classList.remove('sticky');
      if (details) details.open = false;
    }
    ticking = false;
  }
  function requestTick() {
    if (!ticking) {
      window.requestAnimationFrame(updateStickyState);
      ticking = true;
    }
  }
  window.addEventListener('scroll', requestTick);
  window.addEventListener('resize', requestTick);
  updateStickyState();
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
  toTopBtn.addEventListener('click', () =>
    window.scrollTo({ top: 0, behavior: 'smooth' })
  );
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

  const randomSection = document
    .getElementById('randomGifts')
    ?.closest('section');
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
  renderPromoGifts();
  initCatalogList();

  initParallax();
  initLazySections();
  initThemeToggle();
  initTooltip();
  initStickySearch();
  initToTopButton();
  setTelegramLink();

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
