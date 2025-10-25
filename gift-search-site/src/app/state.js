// gift-search-site/src/app/state.js
// [НОВЫЙ ФАЙЛ] Глобальное состояние — без прямой логики работы с DOM.

export const state = {
  offset: 0, // текущий сдвиг для пагинации каталога
  isLoading: false, // флаг загрузки
  allGiftsLoaded: false,
  currentFilter: null, // текущие параметры поиска (recipient, age, budget)
};
