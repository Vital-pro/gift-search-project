// gift-search-site/src/app/features/catalog.js
// [НОВЫЙ МОДУЛЬ] Логика каталога: подгрузка, пагинация, сброс к промо.

import { GIFTS } from '../../../data/index.js';
import { createGiftCard } from '../../ui/components/GiftCard.js';
import { appendSortedCards } from '../../utils/card-sorter.js'; // <-- ДОБАВЬ ЭТУ СТРОКУ
import { fetchGiftsBatch } from './promo.js';
import { INITIAL_BATCH, LOAD_BATCH, TELEGRAM_BOT_URL } from '../config.js';
import { createTelegramCTA } from '../../ui/components/TelegramCTA.js';
import { waitForVisible } from '../utils/lazy.js'; // [ДОБАВЛЕНО] отложим первичную загрузку


// === Глобальное состояние каталога ===
let catalogOffset = 0;
let shuffledCatalog = [];

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
      grid.innerHTML = '';
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
      catalogOffset += batch.length;

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
    btnShowMore.classList.add('hidden');
    const catalogLoader = document.getElementById('catalogLoader');
    if (catalogLoader) catalogLoader.classList.remove('hidden');

    fetchGiftsBatch(shuffledCatalog, catalogOffset, LOAD_BATCH).then((batch) => {
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
      catalogOffset += batch.length;
      if (catalogLoader) catalogLoader.classList.add('hidden');

      if (catalogOffset < shuffledCatalog.length) {
        btnShowMore.classList.remove('hidden');
      } else {
        btnShowMore.classList.add('hidden');
        // [НОВОЕ] в конце каталога скрываем CTA, чтобы не дублировать с футером
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
