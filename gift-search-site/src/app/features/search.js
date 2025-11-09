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
import { recipientMap } from '../../../vendor/recipient-map.js';
import { appendSortedCards } from '../../utils/card-sorter.js'; // <-- ДОБАВЬ ЭТУ СТРОКУ

// --- модульное состояние поиска ---
let searchAll = [];
let searchOffset = 0;
let currentParams = { recipient: null, age: null, budget: null };
// [ДОБАВЛЕНО] Защита от гонок: id активной сессии поиска
let activeSearchSessionId = 0;

// <-- ВСТАВЬ СЮДА: нормализация получателя по recipientMap -->
function normalizeRecipient(raw) {
  if (!raw) return null;
  const r = String(raw).trim().toLowerCase();
  for (const [key, synonymsList] of Object.entries(recipientMap)) {
    if (r === key) return key;
    if (Array.isArray(synonymsList) && synonymsList.includes(r)) return key;
  }
  // если не распознали ни как ключ, ни как синоним — считаем, что получателя нет
  return null;
}

// <-- ВСТАВЬ СЮДА: чтение значений альтернативных контролов с учётом липкой панели -->
function readAltControlsValues() {
  // Если видна плавающая панель — читаем из неё (у неё нет id)
  const floatHost = document.querySelector('.search-float.visible');
  if (floatHost) {
    const recipientEl = floatHost.querySelector('.controls-grid select');
    const numberEls = floatHost.querySelectorAll('.controls-grid input[type="number"]');
    const recipient = recipientEl ? recipientEl.value : '';
    const ageRaw = numberEls[0] ? numberEls[0].value : '';
    const budgetRaw = numberEls[1] ? numberEls[1].value : '';
    return { recipient, ageRaw, budgetRaw, source: 'float' };
  }

  // Иначе — читаем из оригинальных контролов по id
  const recipient = document.getElementById('recipientSelect')?.value || '';
  const ageRaw = document.getElementById('ageInput')?.value || '';
  const budgetRaw = document.getElementById('budgetInput')?.value || '';
  return { recipient, ageRaw, budgetRaw, source: 'original' };
}

function rankAndSortGifts(items, params) {
  const rec = (params?.recipient || '').toLowerCase().trim();
  const age = Number.isFinite(params?.age) ? params.age : null;
  const budget = Number.isFinite(params?.budget) ? params.budget : null;

  console.log('=== DEBUG rankAndSortGifts ===');
  console.log('Получатель:', rec);
  console.log('Возраст:', age);
  console.log('Бюджет:', budget);
  console.log('Всего карточек на входе:', items.length);

  // Если получатель не указан - работаем по старой логике
  if (!rec) {
    console.log('❌ Получатель не указан - обычная сортировка');
    return items
      .map((g) => scoreOne(g))
      .sort(compareScored)
      .map((x) => x.g);
  }

  // ПРОСТАЯ ЛОГИКА: сначала ВСЕ с точным тегом, потом ВСЕ остальные
  const exact = [];
  const rest = [];

  const hasExactTag = (g) => {
    const has =
      Array.isArray(g.recipientTags) &&
      g.recipientTags.some((tag) => String(tag).toLowerCase() === rec);

    if (has) {
      console.log(`✅ Точное совпадение: "${g.name}" - теги: [${g.recipientTags}]`);
    }
    return has;
  };

  for (const g of items) {
    if (hasExactTag(g)) {
      exact.push(g);
    } else {
      rest.push(g);
    }
  }

  console.log(`📊 ИТОГ: exact=${exact.length}, rest=${rest.length}`);

  // ВАЖНО: внутри каждой группы сортируем по обычным правилам
  const exactSorted = exact
    .map((g) => scoreOne(g))
    .sort(compareScored)
    .map((x) => x.g);

  const restSorted = rest
    .map((g) => scoreOne(g))
    .sort(compareScored)
    .map((x) => x.g);

  console.log('=== КОНЕЦ DEBUG ===');

  // Сначала ВСЕ точные совпадения, потом ВСЕ остальные
  return [...exactSorted, ...restSorted];

  // --- вспомогательные внутри функции ---
  function scoreOne(g) {
    let score = 0;

    // ТОЛЬКО возраст и бюджет - получатель уже учтен в разделении на группы
    // (B) Возраст
    if (age != null && Array.isArray(g.ageRange) && g.ageRange.length === 2) {
      const [min, max] = g.ageRange;
      if (Number.isFinite(min) && Number.isFinite(max)) {
        if (age >= min && age <= max) {
          const mid = (min + max) / 2;
          const width = Math.max(1, max - min);
          const dist = Math.abs(age - mid) / width;
          score += Math.max(0, 30 - Math.round(dist * 60));
        } else {
          const d = age < min ? min - age : age > max ? age - max : 0;
          score -= Math.min(25, d * 2);
        }
      }
    }

    // (C) Бюджет
    if (budget != null && Number.isFinite(g.price)) {
      const diff = Math.abs(g.price - budget);
      const ratio = diff / Math.max(1, budget);
      if (ratio <= 0.2) score += 22;
      else if (ratio <= 0.5) score += 10;
      else if (g.price > budget) score -= 10;
      else score += 4;
    }

    // (D) Небольшой детерминированный «джиттер»
    const id = Number(g.id) || 0;
    score += id % 5;

    return { g, score };
  }

  function compareScored(a, b) {
    if (b.score !== a.score) return b.score - a.score;
    const ap = Number(a.g.price) || 0;
    const bp = Number(b.g.price) || 0;
    if (ap !== bp) return ap - bp;
    const ai = Number(a.g.id) || 0;
    const bi = Number(b.g.id) || 0;
    return ai - bi;
  }
}

// === Вспомогательный рендер результатов (внутренний) ===

function renderSearchResultsGrid(GIFT_CARD_DEPS) {
  const sessionId = activeSearchSessionId;
  const section = document.getElementById('searchResults');
  const resultsCount = document.getElementById('resultsCount');
  const resultsTitle = document.getElementById('resultsTitle');
  const grid = document.getElementById('resultsGrid');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const cta = document.getElementById('searchCTAContainer');
  const sortToggle = document.getElementById('sortToggle'); // ДОБАВИЛ

  if (!section || !grid || !loadMoreBtn || !cta || !sortToggle) return;

  // ИЗМЕНЕНИЕ: Вспомогательная функция для склонения слова "подарок"
  function getGiftWordForm(count) {
    // Получаем последнюю цифру числа (для единиц)
    const lastDigit = count % 10;
    // Получаем последние две цифры числа (для десятков, чтобы учесть 11, 12, 13, 14)
    const lastTwoDigits = count % 100;

    // Если число заканчивается на 11, 12, 13, 14, то всегда "подарков"
    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
      return 'подарков';
    }

    // В остальных случаях склоняем по последней цифре:
    // 1 -> "подарок"
    if (lastDigit === 1) {
      return 'подарок';
    }
    // 2, 3, 4 -> "подарка"
    if (lastDigit >= 2 && lastDigit <= 4) {
      return 'подарка';
    }
    // 0, 5, 6, 7, 8, 9 -> "подарков"
    return 'подарков';
  }

  // === ДИАГНОСТИКА: проверяем порядок ДО изменений ===
  console.log('🔍 renderSearchResultsGrid - ДИАГНОСТИКА:');
  console.log('Всего карточек:', searchAll.length);
  console.log('Получатель:', currentParams?.recipient);

  if (currentParams?.recipient) {
    const rec = currentParams.recipient.toLowerCase();
    const exactCount = searchAll.filter(
      (g) =>
        Array.isArray(g.recipientTags) &&
        g.recipientTags.some((tag) => String(tag).toLowerCase() === rec),
    ).length;
    console.log(`Точных совпадений: ${exactCount}`);

    console.log('Первые 6 карточек:');
    searchAll.slice(0, 6).forEach((g, i) => {
      const isExact =
        Array.isArray(g.recipientTags) &&
        g.recipientTags.some((tag) => String(tag).toLowerCase() === rec);
      console.log(`${i + 1}. "${g.name}" - exact: ${isExact} - теги: [${g.recipientTags}]`);
    });
  }

  // === НОВАЯ ЛОГИКА: Настраиваем кнопку сортировки ===
  setupSortToggle();

  // [НОВОЕ] — порядок: СНАЧАЛА CTA, ПОТОМ кнопка
  if (loadMoreBtn.parentNode && cta.parentNode && cta.nextElementSibling !== loadMoreBtn) {
    loadMoreBtn.parentNode.insertBefore(cta, loadMoreBtn);
  }

  let title = 'Результаты поиска';
  if (currentParams.recipient) {
    const rGen = formatRecipientGenitive(currentParams.recipient);
    title = `Подарки для ${rGen}`;
  }
  resultsTitle.textContent = title;
  // resultsCount.textContent = `— ${searchAll.length} подарок`;
  // ИЗМЕНЕНИЕ: Используем функцию getGiftWordForm для динамического склонения слова "подарок"
  resultsCount.textContent = `— ${searchAll.length} ${getGiftWordForm(searchAll.length)}`;

  // Перезапуск короткой анимации появления заголовка
  resultsTitle.classList.remove('results-title-fade');
  resultsCount.classList.remove('results-title-fade');
  void resultsTitle.offsetWidth;
  resultsTitle.classList.add('results-title-fade');
  resultsCount.classList.add('results-title-fade');

  resultsCount.setAttribute('aria-live', 'polite');
  resultsCount.setAttribute('role', 'status');

  resultsTitle.setAttribute('tabindex', '-1');
  resultsTitle.focus({ preventScroll: true });

  // Очистка
  grid.innerHTML = '';
  searchOffset = 0;

  // Рисуем CTA
  cta.innerHTML = '';
  cta.appendChild(createTelegramCTA(TELEGRAM_BOT_URL));
  cta.classList.remove('hidden');

  // Показ секции результатов
  section.classList.remove('hidden');

  // Рендерим первую порцию
  renderCurrentBatch();

  // === НОВЫЕ ФУНКЦИИ ДЛЯ СОРТИРОВКИ ===

  function setupSortToggle() {
    // Показываем кнопку только если есть результаты
    if (searchAll.length > 1) {
      sortToggle.classList.remove('hidden');
      sortToggle.setAttribute('aria-label', 'Изменить сортировку результатов');
    } else {
      sortToggle.classList.add('hidden');
      return;
    }

    // Сбрасываем обработчики
    sortToggle.onclick = null;

    // Обработчик клика
    sortToggle.onclick = () => {
      const currentState = sortToggle.getAttribute('aria-pressed');
      const sortText = sortToggle.querySelector('.sort-text');

      if (currentState === 'false') {
        // Первое нажатие: сортируем по убыванию цены (дорогие сначала)
        sortToggle.setAttribute('aria-pressed', 'true');
        sortText.textContent = 'Сначала недорогие';
        applyPriceSort('desc');
      } else if (currentState === 'true') {
        // Второе нажатие: сортируем по возрастанию цены (недорогие сначала)
        sortToggle.setAttribute('aria-pressed', 'asc');
        sortText.textContent = 'По умолчанию';
        applyPriceSort('asc');
      } else {
        // Третье нажатие: возврат к исходной сортировке
        sortToggle.setAttribute('aria-pressed', 'false');
        sortText.textContent = 'Сначала дорогие';
        resetToDefaultSort();
      }
    };
  }

  function applyPriceSort(order) {
    const sorted = [...searchAll].sort((a, b) => {
      const priceA = a.price || 0;
      const priceB = b.price || 0;
      return order === 'desc' ? priceB - priceA : priceA - priceB;
    });

    // Обновляем данные и перерисовываем
    searchAll = sorted;
    searchOffset = 0;
    grid.innerHTML = '';
    renderCurrentBatch();

    // Плавная прокрутка к началу
    setTimeout(() => {
      resultsTitle.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }

  function resetToDefaultSort() {
    // Восстанавливаем исходную сортировку через rankAndSortGifts
    const prioritized = rankAndSortGifts(GIFTS, currentParams);
    const filtered = filterGifts(prioritized, currentParams);
    searchAll = filtered;
    searchOffset = 0;
    grid.innerHTML = '';
    renderCurrentBatch();
  }

  function renderCurrentBatch() {
    fetchGiftsBatch(searchAll, searchOffset, INITIAL_BATCH).then((batch) => {
      if (sessionId !== activeSearchSessionId) return;

      // Собираем все карточки сначала
      const allCards = [];
      batch.forEach((gift) => {
        const card = createGiftCard(gift, GIFT_CARD_DEPS);
        if (card) {
          allCards.push(card);
        }
      });

      // Добавляем отсортированные карточки в grid
      appendSortedCards(grid, allCards);
      searchOffset += batch.length;

      if (searchOffset < searchAll.length) {
        loadMoreBtn.textContent = 'Посмотреть ещё';
        loadMoreBtn.classList.remove('hidden');
        loadMoreBtn.onclick = null;
        loadMoreBtn.onclick = handleLoadMore;
      } else {
        cta.innerHTML = '';
        cta.classList.add('hidden');
        loadMoreBtn.textContent = 'Начать поиск заново';
        loadMoreBtn.classList.remove('hidden');
        loadMoreBtn.onclick = null;
        loadMoreBtn.onclick = () => {
          window.location.href = '/';
        };
      }

      setTimeout(() => scrollToSectionWithOffset(section, 12), 60);
    });
  }

  function handleLoadMore() {
    if (sessionId !== activeSearchSessionId) return;

    fetchGiftsBatch(searchAll, searchOffset, LOAD_BATCH).then((more) => {
      if (sessionId !== activeSearchSessionId) return;

      // Собираем все карточки сначала
      const allCards = [];
      more.forEach((gift) => {
        const card = createGiftCard(gift, GIFT_CARD_DEPS);
        if (card) {
          allCards.push(card);
        }
      });

      // Добавляем отсортированные карточки в grid
      appendSortedCards(grid, allCards);
      searchOffset += more.length;

      if (searchOffset < searchAll.length) {
        loadMoreBtn.textContent = 'Посмотреть ещё';
        loadMoreBtn.classList.remove('hidden');
      } else {
        cta.innerHTML = '';
        cta.classList.add('hidden');
        loadMoreBtn.textContent = 'Начать поиск заново';
        loadMoreBtn.classList.remove('hidden');
        loadMoreBtn.onclick = null;
        loadMoreBtn.onclick = () => {
          window.location.href = '/';
        };
      }
    });
  }
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

  // Разбор текста
  const params = parseQuery(query);

  // Нормализация получателя по единому словарю
  params.recipient = normalizeRecipient(params.recipient);
  window.currentSearchRecipient = params.recipient;

  // «Анти-блабла»: если в тексте есть буквы, но НЕ распознали получателя
  // и одновременно нет ни возраста, ни бюджета — не запускаем поиск.
  const hasLetters = /\p{L}/u.test(query);
  if (hasLetters && !params.recipient && params.age == null && params.budget == null) {
    enterSearchMode(); // скрываем стартовый UI, показываем секцию с сообщением
    const section = document.getElementById('noResults');
    section?.classList.remove('hidden');
    document.getElementById('searchResults')?.classList.add('hidden');

    const h = section?.querySelector('h3');
    if (h) {
      h.setAttribute('tabindex', '-1');
      h.focus({ preventScroll: true });
    }
    scrollToSectionWithOffset(section, 12);
    return;
  }

  // === ИЗМЕНЕНИЕ: Сначала сортировка по тегу, потом фильтрация ===
  currentParams = params;

  // Сначала сортируем ВСЕ подарки по приоритету тега
  const prioritized = rankAndSortGifts(GIFTS, params);
  // Потом фильтруем по возрасту/бюджету
  const filtered = filterGifts(prioritized, params);

  if (!filtered.length) {
    enterSearchMode(); // скрываем стартовый UI
    const section = document.getElementById('noResults');
    section?.classList.remove('hidden');
    document.getElementById('searchResults')?.classList.add('hidden');

    const h = section?.querySelector('h3');
    if (h) {
      h.setAttribute('tabindex', '-1');
      h.focus({ preventScroll: true });
    }
    scrollToSectionWithOffset(section, 12);
    return;
  }

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
  const { recipient, ageRaw, budgetRaw } = readAltControlsValues();

  // при альтернативном поиске очищаем текстовые поля (везде)
  clearTextInputsEverywhere();

  const params = {
    recipient: normalizeRecipient(recipient),
    age: ageRaw ? parseInt(ageRaw, 10) : null,
    budget: budgetRaw ? parseInt(budgetRaw, 10) : null,
  };

  // === ДОБАВЛЕНО: Сохраняем получателя для сортировки тегов в карточках ===
  window.currentSearchRecipient = params.recipient;

  // === ИЗМЕНЕНИЕ: Сначала сортировка по тегу, потом фильтрация ===
  currentParams = params;

  // Сначала сортируем ВСЕ подарки по приоритету тега
  const prioritized = rankAndSortGifts(GIFTS, params);
  // Потом фильтруем по возрасту/бюджету
  const filtered = filterGifts(prioritized, params);

  if (!filtered.length) {
    enterSearchMode(); // скрываем стартовый UI
    const section = document.getElementById('noResults');
    section?.classList.remove('hidden');
    document.getElementById('searchResults')?.classList.add('hidden');

    const h = section?.querySelector('h3');
    if (h) {
      h.setAttribute('tabindex', '-1');
      h.focus({ preventScroll: true });
    }
    scrollToSectionWithOffset(section, 12);
    return;
  }

  searchAll = filtered;
  enterSearchMode();
  renderSearchResultsGrid(GIFT_CARD_DEPS);
}

/**
 * Полный сброс к промо/каталогу (кнопка «Начать поиск заново»)
 */
// export function resetSearchAndBack(GIFT_CARD_DEPS, promoIds) {
//   // 1) Сбросим режим и прокрутим мгновенно (чтоб фокус не «съедал» smooth)
//   resetSearchView({ instantScroll: true });

//   // 2) Явно вернём видимость оригинальной панели и уберём липкую
//   const floatHost = document.querySelector('.search-float');
//   const originalBlock = document.querySelector('.search-block');
//   // липкую выключаем
//   if (floatHost) {
//     floatHost.classList.remove('visible');
//     floatHost.classList.remove('force-visible'); // на всякий случай
//   }
//   // оригинальную показываем
//   if (originalBlock) {
//     originalBlock.classList.remove('search-original-hidden');
//     originalBlock.classList.remove('compact');
//   }

//   // 3) Сброс обработчика и перерисовка стартового экрана
//   const loadMoreBtn = document.getElementById('loadMoreBtn');
//   if (loadMoreBtn) loadMoreBtn.onclick = null;

//   renderPromoGifts(Array.isArray(promoIds) ? promoIds : [1, 3, 5, 8, 12, 15], GIFT_CARD_DEPS);
//   initCatalogList(GIFT_CARD_DEPS);
// }

export function resetSearchAndBack(GIFT_CARD_DEPS, promoIds) {
  // 1) Сбросим режим и прокрутим мгновенно (чтоб фокус не «съедал» smooth)
  resetSearchView({ instantScroll: true });

  // 2) Сбрасываем состояние сортировки
  const sortToggle = document.getElementById('sortToggle');
  if (sortToggle) {
    sortToggle.classList.add('hidden');
    sortToggle.setAttribute('aria-pressed', 'false');
    const sortText = sortToggle.querySelector('.sort-text');
    if (sortText) sortText.textContent = 'Сначала дорогие';
  }

  // 3) Явно вернём видимость оригинальной панели и уберём липкую
  const floatHost = document.querySelector('.search-float');
  const originalBlock = document.querySelector('.search-block');
  // липкую выключаем
  if (floatHost) {
    floatHost.classList.remove('visible');
    floatHost.classList.remove('force-visible'); // на всякий случай
  }
  // оригинальную показываем
  if (originalBlock) {
    originalBlock.classList.remove('search-original-hidden');
    originalBlock.classList.remove('compact');
  }

  // 4) Сброс обработчика и перерисовка стартового экрана
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (loadMoreBtn) loadMoreBtn.onclick = null;

  renderPromoGifts(Array.isArray(promoIds) ? promoIds : [1, 3, 5, 8, 12, 15], GIFT_CARD_DEPS);
  initCatalogList(GIFT_CARD_DEPS);
}
