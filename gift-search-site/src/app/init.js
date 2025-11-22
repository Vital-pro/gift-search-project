// gift-search-site/src/app/init.js
// Единая инициализация приложения: промо, каталог, lazy-секции, sticky-панель, PWA и обработчики поиска.
// Поведение 1:1 с тем, как было в main.js, только разнесено по модулям.

import { showTransitionOverlay } from '../ui/components/Overlay.js';
import { initStickySearch } from '../ui/stickySearch.js';
import { registerServiceWorker } from '../services/sw-register.js';

import { renderPromoGifts } from './features/promo.js';
import { initCatalogList } from './features/catalog.js';
import { performSearch, performAlternativeSearch, resetSearchAndBack } from './features/search.js';

import { initLazySections } from './features/lazy-sections.js';

import { createGiftCardDeps, openWithPreloader } from './utils/helpers.js';
import { API_BASE } from './config.js';
import { initUI } from './initUI.js';


// Явный список промо-ID как было в main.js
const PROMO_GIFTS_IDS = [330, 18, 2207, 3357, 5501, 3368];

export function initApp() {
  // === Собираем зависимости для карточек (как было в main.js)
  const GIFT_CARD_DEPS = createGiftCardDeps(API_BASE);

  // === Тест-оверлей (Shift+O / Shift+О) — переносим без изменений
  window.__overlayTest = () =>
    showTransitionOverlay('🎁 Подбираем лучший подарок для вас...', 1200);
  document.addEventListener('keydown', (e) => {
    if (e.shiftKey && (e.key === 'O' || e.key === 'О')) {
      window.__overlayTest();
    }
  });

  // === Показываем спиннеры до загрузки (как было)
  const promoLoader = document.getElementById('promoLoader');
  const catalogInitialLoader = document.getElementById('catalogInitialLoader');
  if (promoLoader) promoLoader.classList.remove('hidden');
  if (catalogInitialLoader) catalogInitialLoader.classList.remove('hidden');

  // === Рендер стартовых секций
  renderPromoGifts(PROMO_GIFTS_IDS, GIFT_CARD_DEPS);
  initCatalogList(GIFT_CARD_DEPS);

  // Ленивая отрисовка секций (каталог и др. получают .visible)
  initLazySections();

  initStickySearch();

  // вспомогательные UI (to-top, tooltip, UTM в футере)
  initUI();

  registerServiceWorker();

  // === Слушатели поиска — НАДЁЖНО, без обращения к window.* до их назначения
  const searchBtn = document.getElementById('searchBtn');
  const searchInput = document.getElementById('searchInput');
  const altSearchBtn = document.getElementById('altSearchBtn');

  const recipientSelect = document.getElementById('recipientSelect');
  const ageInput = document.getElementById('ageInput');
  const budgetInput = document.getElementById('budgetInput');
  const layer2 = document.getElementsByClassName('layer-shape-2')[0];
  const layer3 = document.getElementsByClassName('layer-shape-3')[0];
  setTimeout(() => {
    layer2.classList.add('work-bg')
    layer3.classList.add('work-bg')
  }, 4000);

  // Локальные триггеры, захватывающие GIFT_CARD_DEPS
  function triggerTextSearch() {
    performSearch(GIFT_CARD_DEPS);
  }
  function triggerAltSearch() {
    performAlternativeSearch(GIFT_CARD_DEPS);
  }

  // Клик по "Найти"
  searchBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    triggerTextSearch();
  });

  // Enter в текстовом поле поиска — только keydown, один раз
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'NumpadEnter') {
      e.preventDefault();
      triggerTextSearch();
    }
  });

  // Клик по "Подобрать" (альтернативные контролы)
  altSearchBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    triggerAltSearch();
  });

  // Enter в любом из альтернативных контролов
  const handleAltEnter = (e) => {
    if (e.key === 'Enter' || e.key === 'NumpadEnter') {
      e.preventDefault();
      triggerAltSearch();
    }
  };
  recipientSelect?.addEventListener('keydown', handleAltEnter);
  ageInput?.addEventListener('keydown', handleAltEnter);
  budgetInput?.addEventListener('keydown', handleAltEnter);

  // Фокус в поле поиска при загрузке
  searchInput?.focus();

  // === Автопоиск по query (?q=...)
  const urlParams = new URLSearchParams(window.location.search);
  const q = urlParams.get('q');
  if (q && searchInput) {
    searchInput.value = q;
    window.performSearch?.();
  }

  // === Глобальные прокси (нужны stickySearch и внешним кнопкам)
  window.showTransitionOverlay = showTransitionOverlay;
  window.openWithPreloader = openWithPreloader;

  // Обёртки, чтобы в модули поиска попадали deps
  window.performSearch = () => performSearch(GIFT_CARD_DEPS);
  window.performAlternativeSearch = () => performAlternativeSearch(GIFT_CARD_DEPS);

  // Сброс к стартовому экрану с перерисовкой промо/каталога
  window.resetSearch = () => resetSearchAndBack(GIFT_CARD_DEPS, PROMO_GIFTS_IDS);

  // === Обработчик кнопки "Начать поиск заново" в блоке noResults ===
const restartBtn = document.getElementById('restartSearchBtn');
if (restartBtn) {
  restartBtn.addEventListener('click', () => {
    window.location.href = '/';
  });
}

}
