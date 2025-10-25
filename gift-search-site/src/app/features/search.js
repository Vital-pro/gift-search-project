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
// [ДОБАВЛЕНО] Защита от гонок: id активной сессии поиска
let activeSearchSessionId = 0;


// === Вспомогательный рендер результатов (внутренний) ===
function renderSearchResultsGrid(GIFT_CARD_DEPS) {
  // [ДОБАВЛЕНО] Фиксируем ид текущей сессии для всех вложенных async
  const sessionId = activeSearchSessionId;
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
  // [ДОБАВЛЕНО] Делаем счётчик «живым» для скринридеров и мягко фокусируем заголовок
  resultsCount.setAttribute('aria-live', 'polite'); // обновления озвучиваются «вежливо»
  resultsCount.setAttribute('role', 'status');

  // Фокус на заголовке, чтобы пользователь клавиатуры/скринридер сразу был в нужном месте
  resultsTitle.setAttribute('tabindex', '-1'); // можно фокусировать DIV/span/h2
  resultsTitle.focus({ preventScroll: true }); // без пролистывания страницы

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
    // [ПРОВЕРКА СЕССИИ] защита от гонки: если уже начат новый поиск — не обновляем DOM
    if (sessionId !== activeSearchSessionId) return;
    batch.forEach((g) => grid.appendChild(createGiftCard(g, GIFT_CARD_DEPS)));
    searchOffset += batch.length;

    if (searchOffset < searchAll.length) {
      // есть что догружать: показываем "Посмотреть ещё" НИЖЕ CTA
      loadMoreBtn.textContent = 'Посмотреть ещё';
      loadMoreBtn.classList.remove('hidden');

      // [ИСПРАВЛЕНО] Сбрасываем прежний обработчик, чтобы не плодить onClick
      loadMoreBtn.onclick = null;

      loadMoreBtn.onclick = () => {
        // [ПРОВЕРКА СЕССИИ] если уже другой поиск — игнорируем
        if (sessionId !== activeSearchSessionId) return;

        fetchGiftsBatch(searchAll, searchOffset, LOAD_BATCH).then((more) => {
          // [ПРОВЕРКА СЕССИИ] защита от гонки
          if (sessionId !== activeSearchSessionId) return;

          more.forEach((g) => grid.appendChild(createGiftCard(g, GIFT_CARD_DEPS)));
          searchOffset += more.length;

          if (searchOffset < searchAll.length) {
            // ещё не конец — остаёмся на "Посмотреть ещё"
            loadMoreBtn.textContent = 'Посмотреть ещё';
            loadMoreBtn.classList.remove('hidden');
          } else {
            // дошли до конца — показываем "Начать поиск заново" и УБИРАЕМ CTA (чтобы не дублировать с футером)
            cta.innerHTML = '';
            cta.classList.add('hidden');

            loadMoreBtn.textContent = 'Начать поиск заново';
            loadMoreBtn.classList.remove('hidden');
            // [ИСПРАВЛЕНО] Сбросим старый обработчик перед установкой нового
            loadMoreBtn.onclick = null;
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
      // [ИСПРАВЛЕНО] Сбросим потенциальный прежний обработчик
      loadMoreBtn.onclick = null;
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
  activeSearchSessionId++;
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

    // [ДОБАВЛЕНО] Фокус на заголовок «Ничего не нашлось» + мягкий скролл с отступом
    const h = section?.querySelector('h3');
    if (h) {
      h.setAttribute('tabindex', '-1');
      h.focus({ preventScroll: true });
    }
    // уже используем хелпер с отступом, чтобы заголовок не «уезжал» под хедер
    scrollToSectionWithOffset(section, 12);
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
  // [ДОБАВЛЕНО] новая сессия поиска
  activeSearchSessionId++;
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

    // [ДОБАВЛЕНО] Фокус на заголовок «Ничего не нашлось» + мягкий скролл с отступом
    const h = section?.querySelector('h3');
    if (h) {
      h.setAttribute('tabindex', '-1');
      h.focus({ preventScroll: true });
    }
    // уже используем хелпер с отступом, чтобы заголовок не «уезжал» под хедер
    scrollToSectionWithOffset(section, 12);
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
  resetSearchView();
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (loadMoreBtn) loadMoreBtn.onclick = null;
  renderPromoGifts(Array.isArray(promoIds) ? promoIds : [1, 3, 5, 8, 12, 15], GIFT_CARD_DEPS);
  initCatalogList(GIFT_CARD_DEPS);
}
