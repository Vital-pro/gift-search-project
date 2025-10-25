// gift-search-site/src/app/config.js
// [ОБНОВЛЕНО] Централизованный конфиг проекта.
// ВАЖНО: вернули оригинальную логику API_BASE из main.js:
// - В проде используем относительный путь '' (тот же домен).
// - На localhost прокидываем на прод-домен, где реально работает /api/go.

export const TELEGRAM_BOT_URL = 'https://t.me/presentsuperBot'; // (оставлено здесь для удобства, если будем использовать)
export const INITIAL_BATCH = 15;
export const LOAD_BATCH = 9;

// Ровно как в оригинале:
export const PROD_ORIGIN = 'https://gift-search-project.vercel.app';
export const API_BASE = typeof location !== 'undefined' && location.hostname === 'localhost' ? PROD_ORIGIN : '';

// Количество карточек в промо-блоке (по твоему желанию 9 — ок)
export const PROMO_COUNT = 9;

// (опц., если понадобится централизовать селекторы)
export const SELECTORS = {
  promoGrid: '#randomGifts',
  promoLoader: '#promoLoader',
  catalogGrid: '#catalogGifts',
  catalogShowMoreBtn: '#catalogShowMoreBtn',
  catalogCTAContainer: '#catalogCTAContainer',
  catalogLoader: '#catalogLoader',
  catalogResetBtn: '#catalogResetBtn',
  catalogInitialLoader: '#catalogInitialLoader',
  searchResults: '#searchResults',
  resultsGrid: '#resultsGrid',
  loadMoreBtn: '#loadMoreBtn',
  noResults: '#noResults',
  catalogSection: '#catalogSection',
};
