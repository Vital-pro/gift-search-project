// gift-search-site/src/utils/link-checker.js
import { BLOCKED_STORES } from '../app/config.js';

/**
 * Проверяет, заблокирован ли аффилейт-домен в ссылке
 * @param {string} link - URL для проверки
 * @returns {boolean} true если аффилейт заблокирован
 */
export function isLinkBlocked(link) {
  if (!link || typeof link !== 'string') return true;

  try {
    const url = new URL(link);
    const hostname = url.hostname.toLowerCase();

    // Проверяем аффилейт-домен (например: bywiola.com, kpwfp.com)
    return BLOCKED_STORES.some((blocked) => {
      const blockedLower = blocked.toLowerCase();
      return hostname === blockedLower || hostname.endsWith('.' + blockedLower);
    });
  } catch (error) {
    console.warn('Invalid URL:', link, error);
    return true; // Невалидные ссылки блокируем
  }
}

/**
 * Фильтрует массив ссылок, оставляя только разрешённые
 * @param {string|string[]} links - ссылка или массив ссылок
 * @returns {string[]} массив рабочих ссылок
 */
export function filterBlockedLinks(links) {
  if (!links) return [];

  if (typeof links === 'string') {
    return isLinkBlocked(links) ? [] : [links];
  }

  if (Array.isArray(links)) {
    return links.filter((link) => !isLinkBlocked(link));
  }

  return [];
}

/**
 * Проверяет, есть ли у товара хотя бы одна рабочая ссылка
 * @param {Object} gift - объект подарка
 * @returns {boolean} true если есть валидные ссылки
 */
export function hasValidLinks(gift) {
  if (!gift) return false;

  const links = gift.link || gift.llink;
  if (!links) return false;

  return filterBlockedLinks(links).length > 0;
}
