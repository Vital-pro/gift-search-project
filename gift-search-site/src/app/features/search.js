// gift-search-site/src/app/features/search.js
// Единая логика поиска: текстовый и альтернативные контролы.
// Управление экранами — через searchView (enterSearchMode/resetSearchView/scrollWithOffset).

import { GIFTS } from '../../../data/index.js';
import { parseQuery } from '../../domain/parseQuery.js';
import { filterGifts } from '../../domain/filterGifts.js';

import { createGiftCard } from '../../ui/components/GiftCard.js';
import { createTelegramCTA } from '../../ui/components/TelegramCTA.js';

import { INITIAL_BATCH, LOAD_BATCH, TELEGRAM_BOT_URL } from '../config.js';
import { fetchGiftsBatch, renderPromoGifts } from './promo.js';
import { initCatalogList } from './catalog.js';

import {
  enterSearchMode,
  resetSearchView,
  clearTextInputsEverywhere,
  clearAltControlsEverywhere,
  scrollToSectionWithOffset,
} from '../ui/searchView.js';
import { formatRecipientGenitive } from '../utils/format.js';

// --- модульное состояние поиска ---
let searchAll = [];
let searchOffset = 0;
let currentParams = { recipient: null, age: null, budget: null };

// === Вспомогательный рендер результатов (внутренний) ===
function renderSearchResultsGrid(GIFT_CARD_DEPS) {
  const section = document.getElementById('searchResults');
  const resultsCount = document.getElementById('resultsCount');
  const resultsTitle = document.getElementById('resultsTitle');
  const grid = document.getElementById('resultsGrid');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const cta = document.getElementById('searchCTAContainer');

  if (!section || !grid || !loadMoreBtn || !cta) return;

  // [НОВОЕ] — порядок: СНАЧАЛА CTA, ПОТОМ кнопка
  // Переставляем контейнер CTA перед кнопкой (DOM может быть изначально наоборот)
  if (loadMoreBtn.parentNode && cta.parentNode && cta.nextElementSibling !== loadMoreBtn) {
    loadMoreBtn.parentNode.insertBefore(cta, loadMoreBtn);
  }

let title = 'Результаты поиска';
if (currentParams.recipient) {
  const rGen = formatRecipientGenitive(currentParams.recipient);
  title = `Подарки для ${rGen}`;
}
resultsTitle.textContent = title;
resultsCount.textContent = `— найдено ${searchAll.length}`;

  // Очистка
  grid.innerHTML = '';
  searchOffset = 0;

  // Рисуем CTA прямо сейчас (над кнопкой)
  cta.innerHTML = '';
  cta.appendChild(createTelegramCTA(TELEGRAM_BOT_URL));
  cta.classList.remove('hidden');

  // Показ секции результатов
  section.classList.remove('hidden');

  // Первая порция
  fetchGiftsBatch(searchAll, searchOffset, INITIAL_BATCH).then((batch) => {
    batch.forEach((g) => grid.appendChild(createGiftCard(g, GIFT_CARD_DEPS)));
    searchOffset += batch.length;

    if (searchOffset < searchAll.length) {
      // есть что догружать: показываем "Посмотреть ещё" НИЖЕ CTA
      loadMoreBtn.textContent = 'Посмотреть ещё';
      loadMoreBtn.classList.remove('hidden');

      loadMoreBtn.onclick = () => {
        fetchGiftsBatch(searchAll, searchOffset, LOAD_BATCH).then((more) => {
          more.forEach((g) => grid.appendChild(createGiftCard(g, GIFT_CARD_DEPS)));
          searchOffset += more.length;

          if (searchOffset >= searchAll.length) {
            // дошли до конца — показываем "Начать поиск заново" и УБИРАЕМ CTA (чтобы не дублировать с футером)
            cta.innerHTML = '';
            cta.classList.add('hidden');

            loadMoreBtn.textContent = 'Начать поиск заново';
            loadMoreBtn.classList.remove('hidden');
            loadMoreBtn.onclick = () => resetSearchAndBack(GIFT_CARD_DEPS);
          }
        });
      };
    } else {
      // результат влез в один экран — кнопка "Начать поиск заново"
      // и УБИРАЕМ CTA (внизу уже есть вариант в футере)
      cta.innerHTML = '';
      cta.classList.add('hidden');

      loadMoreBtn.textContent = 'Начать поиск заново';
      loadMoreBtn.classList.remove('hidden');
      loadMoreBtn.onclick = () => resetSearchAndBack(GIFT_CARD_DEPS);
    }

    // Прокрутка с отступом от header — чтобы заголовок не уехал под хедер
    setTimeout(() => scrollToSectionWithOffset(section, 12), 60);
  });
}

/**
 * Полнотекстовый поиск (поле #searchInput)
 */
export function performSearch(GIFT_CARD_DEPS) {
  const searchInput = document.getElementById('searchInput');
  const query = searchInput?.value.trim() || '';

  // при текстовом поиске очищаем альтернативные контролы (везде)
  clearAltControlsEverywhere();

  if (!query) {
    // показываем «нет результатов» и выходим из режима
    document.getElementById('noResults')?.classList.remove('hidden');
    document.getElementById('searchResults')?.classList.add('hidden');
    return;
  }

  const params = parseQuery(query);
  const filtered = filterGifts(GIFTS, params);

  if (!filtered.length) {
    enterSearchMode(); // скрываем стартовый UI
    const section = document.getElementById('noResults');
    section?.classList.remove('hidden');
    document.getElementById('searchResults')?.classList.add('hidden');
    return;
  }

  currentParams = params;
  searchAll = filtered;
  enterSearchMode();
  renderSearchResultsGrid(GIFT_CARD_DEPS);
}

/**
 * Поиск через альтернативные контролы (select + inputs)
 */
export function performAlternativeSearch(GIFT_CARD_DEPS) {
  const recipient = document.getElementById('recipientSelect')?.value || '';
  const ageRaw = document.getElementById('ageInput')?.value || '';
  const budgetRaw = document.getElementById('budgetInput')?.value || '';

  // при альтернативном поиске очищаем текстовые поля (везде)
  clearTextInputsEverywhere();

  const params = {
    recipient: recipient || null,
    age: ageRaw ? parseInt(ageRaw, 10) : null,
    budget: budgetRaw ? parseInt(budgetRaw, 10) : null,
  };

  const filtered = filterGifts(GIFTS, params);

  if (!filtered.length) {
    enterSearchMode(); // скрываем стартовый UI
    const section = document.getElementById('noResults');
    section?.classList.remove('hidden');
    document.getElementById('searchResults')?.classList.add('hidden');
    return;
  }

  currentParams = params;
  searchAll = filtered;
  enterSearchMode();
  renderSearchResultsGrid(GIFT_CARD_DEPS);
}

/**
 * Полный сброс к промо/каталогу (кнопка «Начать поиск заново»)
 */
export function resetSearchAndBack(GIFT_CARD_DEPS, promoIds) {
  resetSearchView(); // очистка полей + возврат стартовых секций
  renderPromoGifts(Array.isArray(promoIds) ? promoIds : [1, 3, 5, 8, 12, 15], GIFT_CARD_DEPS);
  initCatalogList(GIFT_CARD_DEPS);
}
