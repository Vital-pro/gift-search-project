// gift-search-site/src/utils/card-sorter.js

/**
 * Сортирует массив карточек: сначала активные, потом "проверяемые"
 * @param {Node[]} cards - массив DOM-элементов карточек
 * @returns {Node[]} отсортированный массив
 */
export function sortCardsByAvailability(cards) {
  if (!Array.isArray(cards)) return [];

  const activeCards = [];
  const checkingCards = [];

  cards.forEach((card) => {
    if (card && card.nodeType === Node.ELEMENT_NODE) {
      if (
        card.classList.contains('gift-card--checking') ||
        card.getAttribute('data-availability') === 'checking'
      ) {
        checkingCards.push(card);
      } else {
        activeCards.push(card);
      }
    }
  });

  return [...activeCards, ...checkingCards];
}

/**
 * Сортирует и добавляет карточки в grid в правильном порядке
 * @param {HTMLElement} grid - контейнер для карточек
 * @param {Node[]} cards - массив DOM-элементов карточек
 */
export function appendSortedCards(grid, cards) {
  if (!grid || !Array.isArray(cards)) return;

  const sortedCards = sortCardsByAvailability(cards);

  // Очищаем grid и добавляем отсортированные карточки
  sortedCards.forEach((card) => {
    if (card) {
      grid.appendChild(card);
    }
  });
}
