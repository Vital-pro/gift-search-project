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


// [ВОССТАНОВЛЕНО] Явный список промо-ID как было в main.js
const PROMO_GIFTS_IDS = [1, 3, 5, 8, 12, 15];

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

  // [ВОССТАНОВЛЕНО] Ленивая отрисовка секций (каталог и др. получают .visible)
  initLazySections();

  initStickySearch();

  // [ДОБАВЛЕНО] вспомогательные UI (to-top, tooltip, UTM в футере)
  initUI();

  registerServiceWorker();

  // === Слушатели поиска (как было — но вызываем через прокси с deps)
  const searchBtn = document.getElementById('searchBtn');
  const searchInput = document.getElementById('searchInput');
  const altSearchBtn = document.getElementById('altSearchBtn');

  // Основной поиск по кнопке
  // Основной поиск по кнопке
  searchBtn?.addEventListener('click', () => window.performSearch?.());

  // [ИСПРАВЛЕНО] Enter только на keydown — чтобы не было двойного запуска
  const triggerEnterSearch = (e) => {
    if (e.key === 'Enter' || e.key === 'NumpadEnter') {
      e.preventDefault();
      window.performSearch?.();
    }
  };
  searchInput?.addEventListener('keydown', triggerEnterSearch); // ← оставили только keydown

  // Альтернативные контролы — по кнопке
  altSearchBtn?.addEventListener('click', () => window.performAlternativeSearch?.());

  // Enter для альтернативных контролов — только keydown
  const recipientSelect = document.getElementById('recipientSelect');
  const ageInput = document.getElementById('ageInput');
  const budgetInput = document.getElementById('budgetInput');

  const triggerAltEnter = (e) => {
    if (e.key === 'Enter' || e.key === 'NumpadEnter') {
      e.preventDefault();
      window.performAlternativeSearch?.();
    }
  };
  recipientSelect?.addEventListener('keydown', triggerAltEnter);
  ageInput?.addEventListener('keydown', triggerAltEnter);
  budgetInput?.addEventListener('keydown', triggerAltEnter);

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
}
