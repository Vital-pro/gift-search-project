// gift-search-site/src/app/features/promo.js
// Промо-блок стартовых карточек + "эмулятор задержки" для батч-загрузки.
// Поведение 1:1 с исходным main.js (ничего не меняем).

import { GIFTS } from '../../../data/index.js';
import { createGiftCard } from '../../ui/components/GiftCard.js';
import { appendSortedCards } from '../../utils/card-sorter.js'; // <-- ДОБАВЬ ЭТУ СТРОКУ
import { PROMO_COUNT } from '../config.js';

/**
 * Псевдо-запрос к БД (эмуляция задержки)
 * Используется и промо, и каталогом.
 */
export function fetchGiftsBatch(allItems, offset, limit) {
  const slice = allItems.slice(offset, offset + limit);
  return new Promise((resolve) => {
    console.log(`[fetch] offset=${offset}, limit=${limit}, willReturn=${slice.length}`);
    setTimeout(() => resolve(slice), 250);
  });
}

/**
 * Рендер промо-карточек в верхнем блоке.
 * @param {number[]} promoIds - явный список id промо (как в твоём main.js)
 * @param {object} GIFT_CARD_DEPS - зависимости для карточек (showTransitionOverlay, openWithPreloader и т.д.)
 */
export function renderPromoGifts(promoIds, GIFT_CARD_DEPS) {
  const grid = document.getElementById('randomGifts');
  const loader = document.getElementById('promoLoader');
  if (!grid) return;

  // очищаем и показываем спиннер
  grid.innerHTML = '';
  loader?.classList.remove('hidden');

  // если есть список id — берём их; иначе первые PROMO_COUNT
  let promoGifts = [];
  if (Array.isArray(promoIds) && promoIds.length) {
    const set = new Set(promoIds);
    promoGifts = GIFTS.filter((g) => set.has(g.id));
  } else {
    promoGifts = GIFTS.slice(0, PROMO_COUNT);
  }

  // ограничиваем ровно PROMO_COUNT, как раньше
  promoGifts = promoGifts.slice(0, PROMO_COUNT);

  // Собираем все карточки сначала
  const allCards = [];
  promoGifts.forEach((gift) => {
    const card = createGiftCard(gift, GIFT_CARD_DEPS);
    if (card) {
      allCards.push(card);
    }
  });

  // Добавляем отсортированные карточки в grid
  appendSortedCards(grid, allCards);

  // Скрываем спиннер ПОСЛЕ рендера (как было)
  if (loader) {
    loader.classList.add('hidden');
    loader.setAttribute('aria-hidden', 'true');
  }
}
