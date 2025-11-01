// gift-search-site/src/utils/link-checker.js
import { BLOCKED_STORES } from '../app/config.js';

/**
 * Проверяет, заблокирован ли аффилейт-домен в ссылке
 */
export function isLinkBlocked(link) {
  if (!link || typeof link !== 'string') return true;

  try {
    const url = new URL(link);
    const hostname = url.hostname.toLowerCase();

    return BLOCKED_STORES.some((blocked) => {
      const blockedLower = blocked.toLowerCase();
      return hostname === blockedLower || hostname.endsWith('.' + blockedLower);
    });
  } catch (error) {
    console.warn('Invalid URL:', link, error);
    return true;
  }
}

/**
 * Фильтрует массив ссылок, оставляя только разрешённые
 * ВОЗВРАЩАЕТ МАССИВ РАБОЧИХ ССЫЛОК (для резервных)
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
 * ТЕПЕРЬ ВОЗВРАЩАЕТ ОБЪЕКТ С ИНФОРМАЦИЕЙ О СТАТУСЕ
 */
export function getGiftLinkStatus(gift) {
  if (!gift) return { hasValidLinks: false, validLinks: [], allBlocked: true };

  const links = gift.link || gift.llink;
  if (!links) return { hasValidLinks: false, validLinks: [], allBlocked: true };

  const validLinks = filterBlockedLinks(links);
  const hasValidLinks = validLinks.length > 0;
  const allBlocked = validLinks.length === 0;

  return {
    hasValidLinks,
    validLinks,
    allBlocked,
    firstValidLink: validLinks[0] || null,
  };
}

/**
 * Для обратной совместимости - использует новую функцию
 */
export function hasValidLinks(gift) {
  return getGiftLinkStatus(gift).hasValidLinks;
}
