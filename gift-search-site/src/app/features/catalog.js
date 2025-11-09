// gift-search-site/src/app/features/catalog.js
// [НОВЫЙ МОДУЛЬ] Логика каталога: подгрузка, пагинация, сброс к промо.

import { GIFTS } from '../../../data/index.js';
import { createGiftCard } from '../../ui/components/GiftCard.js';
import { appendSortedCards } from '../../utils/card-sorter.js'; // <-- ДОБАВЬ ЭТУ СТРОКУ
import { fetchGiftsBatch } from './promo.js';
import { INITIAL_BATCH, LOAD_BATCH, TELEGRAM_BOT_URL } from '../config.js';
import { createTelegramCTA } from '../../ui/components/TelegramCTA.js';
import { waitForVisible } from '../utils/lazy.js'; // [ДОБАВЛЕНО] отложим первичную загрузку

// === УТИЛИТЫ ДЛЯ СТАБИЛИЗАЦИИ СКРОЛЛА ПРИ ДОЗАГРУЗКЕ ===
// Суть: замеряем вертикальную позицию якоря до/после мутации DOM и компенсируем сдвиг прокруткой (без smooth).
function preserveAnchorScroll(anchorEl, mutateDOM) {
  try {
    if (!anchorEl || typeof mutateDOM !== 'function') {
      mutateDOM && mutateDOM();
      return;
    }
    const beforeTop = anchorEl.getBoundingClientRect().top; // позиция якоря до мутации
    mutateDOM(); // выполняем все изменения DOM разом
    const afterTop = anchorEl.getBoundingClientRect().top; // позиция якоря после мутации
    const delta = afterTop - beforeTop;
    if (delta !== 0 && Number.isFinite(delta)) {
      window.scrollBy(0, delta); // моментально компенсируем сдвиг
    }
  } catch (e) {
    console.warn('[preserveAnchorScroll] fallback без компенсации:', e);
    mutateDOM && mutateDOM();
  }
}

// Выбор лучшего якоря для стабилизации:
// 1) CTA-контейнер (стоит сразу под сеткой и перед кнопкой),
// 2) Кнопка "Посмотреть ещё" (если видима),
// 3) Последняя карточка в гриде (резерв).
function getAnchorEl(grid, btnShowMore, ctaContainer) {
  if (ctaContainer && !ctaContainer.classList.contains('hidden')) return ctaContainer;
  if (btnShowMore && !btnShowMore.classList.contains('hidden')) return btnShowMore;
  if (grid && grid.lastElementChild) return grid.lastElementChild;
  return null;
}

// === Глобальное состояние каталога ===
let catalogOffset = 0;
let shuffledCatalog = [];

// [НОВОЕ] Флаг: пока false — на первичной отрисовке НИКАКОГО автоскролла.
let isCatalogFirstRenderDone = false;

export function initCatalogList(GIFT_CARD_DEPS) {
  const grid = document.getElementById('catalogGifts');
  const btnShowMore = document.getElementById('catalogShowMoreBtn');
  const loader = document.getElementById('catalogInitialLoader');
  const ctaContainer = document.getElementById('catalogCTAContainer');

  if (!grid || !btnShowMore || !loader) return;

  // начальное состояние
  catalogOffset = 0;
  shuffledCatalog = [...GIFTS].sort(() => Math.random() - 0.5);

  // показываем спиннер
  loader.classList.remove('hidden');

  // [ИЗМЕНЕНО] Первую порцию грузим только когда секция каталога реально попала в зону видимости
  const catalogSection = document.getElementById('catalogSection');
  waitForVisible(catalogSection, { threshold: 0.25, rootMargin: '0px 0px -50px 0px' })
    .then(() => {
      // как только секция видима — делаем обычную первую загрузку
      return fetchGiftsBatch(shuffledCatalog, catalogOffset, INITIAL_BATCH);
    })

    .then((batch) => {
      loader.classList.add('hidden');
      grid.innerHTML = ''; // Очищаем сетку перед добавлением нового батча (это правильно для первой загрузки)

      const allCards = [];
      batch.forEach((gift, index) => {
        // Генерируем уникальный ID для первой карточки в батче
        const currentTempId = index === 0 ? `new-card-${Date.now()}` : null;
        // Создаем карточку, передавая ей временный ID через опции (только если currentTempId не null)
        const card = createGiftCard(
          gift,
          currentTempId ? { ...GIFT_CARD_DEPS, tempId: currentTempId } : GIFT_CARD_DEPS,
        );
        // [НОВОЕ] Если это первая карточка батча, сами пометим DOM-узел,
        // чтобы не зависеть от внутренней обработки options.tempId
        if (card && currentTempId) {
          card.setAttribute('data-temp-id', currentTempId);
        }

        if (card) {
          allCards.push(card);
        }
      });

      appendSortedCards(grid, allCards); // Добавляем все обработанные карточки в сетку
      catalogOffset += batch.length;
      // [НОВОЕ] Первая отрисовка каталога завершена — дальше можно скроллить ТОЛЬКО по клику.
      isCatalogFirstRenderDone = true;

      // показываем кнопку, если остались карточки
      if (catalogOffset < shuffledCatalog.length) {
        btnShowMore.classList.remove('hidden');
      } else {
        // если догрузок не будет, не дублируем CTA (он есть в футере)
        if (ctaContainer) ctaContainer.innerHTML = '';
      }

      // CTA-блок должен идти ПЕРЕД кнопкой «Посмотреть ещё»
      if (ctaContainer) {
        ctaContainer.innerHTML = '';
        const cta = createTelegramCTA(TELEGRAM_BOT_URL);
        ctaContainer.appendChild(cta);
        if (btnShowMore && ctaContainer.parentNode) {
          ctaContainer.parentNode.insertBefore(ctaContainer, btnShowMore);
        }
      }
    });

  // обработчик "Посмотреть ещё"
  btnShowMore.onclick = () => {
    // [НОВОЕ] Замеряем вертикальную позицию кнопки ДО скрытия —
    // сюда поставим первую новую карточку ПОСЛЕ вставки
    const anchorTopBefore = btnShowMore.getBoundingClientRect().top;

    btnShowMore.classList.add('hidden');
    const catalogLoader = document.getElementById('catalogLoader');
    if (catalogLoader) catalogLoader.classList.remove('hidden');

    fetchGiftsBatch(shuffledCatalog, catalogOffset, LOAD_BATCH).then((batch) => {
      
      const allCards = [];
      // [НОВОЕ] Граница: последняя "старая" карточка до вставки
      const boundaryBefore = grid.lastElementChild || null;

      batch.forEach((gift, index) => {
        // Генерируем уникальный ID для первой карточки в батче
        const currentTempId = index === 0 ? `new-card-${Date.now()}` : null;

        // Создаем карточку, передавая ей временный ID через опции (только если currentTempId не null)
        const card = createGiftCard(
          gift,
          currentTempId ? { ...GIFT_CARD_DEPS, tempId: currentTempId } : GIFT_CARD_DEPS,
        );
        // [НОВОЕ] Жёстко помечаем первую карточку батча на DOM-узле
        if (card && currentTempId) {
          card.setAttribute('data-temp-id', currentTempId);
        }

        if (card) {
          allCards.push(card);
        }
      });

    
      // === ВСТАВКА НОВЫХ КАРТОЧЕК + ЯВНАЯ ПРОКРУТКА К ПЕРВОЙ НОВОЙ ===

// 1) Вставляем карточки
appendSortedCards(grid, allCards);
catalogOffset += batch.length;

// 2) Прячем лоадер после вставки
if (catalogLoader) catalogLoader.classList.add('hidden');

// 3) Аккуратная прокрутка: ставим первую новую карточку ровно на место кнопки
if (isCatalogFirstRenderDone) {
  setTimeout(() => {
    const firstNewEl = boundaryBefore
      ? boundaryBefore.nextElementSibling
      : grid.firstElementChild; // если ранее карточек не было

    if (firstNewEl) {
      const firstNewTop = firstNewEl.getBoundingClientRect().top;
      const delta = firstNewTop - anchorTopBefore;

      // (опц.) Компенсация фиксированной шапки, если есть:
      // const HEADER_OFFSET = 0; // например, 56
      // const adjustedDelta = delta - HEADER_OFFSET;

      if (Number.isFinite(delta) && delta !== 0) {
        window.scrollBy(0, delta); // мгновенно, без smooth
      }

      // (опц.) Снимем временную метку, если была
      if (firstNewEl.hasAttribute('data-temp-id')) {
        firstNewEl.removeAttribute('data-temp-id');
      }
    }
  }, 50); // ждём reflow, чтобы получить корректные top-координаты
}

// 4) Переключаем видимость кнопки/CTA
if (catalogOffset < shuffledCatalog.length) {
  btnShowMore.classList.remove('hidden');
} else {
  btnShowMore.classList.add('hidden');
  // в конце каталога скрываем CTA, чтобы не дублировать с футером
  if (ctaContainer) ctaContainer.innerHTML = '';
}


    });
  };
}

// === Сброс к промо (восстанавливает изначальный экран) ===
export function resetToPromo() {
  document.getElementById('catalogSection')?.classList.add('hidden');
  document.getElementById('searchResults')?.classList.add('hidden');
  document.getElementById('noResults')?.classList.add('hidden');

  document.querySelector('.random-gifts')?.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
