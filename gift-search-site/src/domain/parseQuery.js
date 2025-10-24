// gift-search-site/src/domain/parseQuery.js
// Парсер строки запроса. Не зависит от DOM. Подтягивает recipientMap из vendor.
import { recipientMap } from '../../vendor/recipient-map.js';

export function parseQuery(input) {
  const result = { recipient: null, age: null, budget: null };
  if (!input || !input.trim()) return result;

  const normalized = input.toLowerCase().trim();
  const tokens = normalized.split(/\s+/);
  const numbers = [];
  const words = [];

  tokens.forEach((token) => {
    const num = parseInt(token, 10);
    if (!Number.isNaN(num) && num > 0) numbers.push(num);
    else words.push(token);
  });

  const recipientQuery = words.join(' ');
  for (const [key, synonymsList] of Object.entries(recipientMap)) {
    const allVariants = [key, ...synonymsList];
    if (allVariants.some((variant) => recipientQuery.includes(variant))) {
      result.recipient = key;
      break;
    }
  }

  if (numbers.length === 1) {
    if (numbers[0] >= 1000) result.budget = numbers[0];
    else if (numbers[0] <= 100) result.age = numbers[0];
    else result.budget = numbers[0];
  } else if (numbers.length >= 2) {
    const sorted = [...numbers].sort((a, b) => a - b);
    if (sorted[0] <= 100) {
      result.age = sorted[0];
      result.budget = sorted[sorted.length - 1];
    } else {
      result.budget = sorted[sorted.length - 1];
    }
  }

  return result;
}
