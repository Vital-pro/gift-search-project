// gift-search-site/src/domain/filterGifts.js
// Фильтрация по возрасту/бюджету/получателю — чистая функция.
import { inferRecipientGroup, matchesRecipientGroup } from './recipient-groups.js';

export function filterGifts(gifts, params) {
  const age = params.age != null ? parseInt(params.age, 10) : null;
  const budget = params.budget != null ? parseInt(params.budget, 10) : null;
  const recipient = params.recipient || null;
  const group = inferRecipientGroup(recipient, age);

  return gifts.filter((gift) => {
    if (age !== null && age !== undefined) {
      if (!Array.isArray(gift.ageRange) || age < gift.ageRange[0] || age > gift.ageRange[1])
        return false;
    }
    if (budget !== null && budget !== undefined) {
      if (typeof gift.price === 'number' && gift.price > budget) return false;
    }
    if (recipient) {
      if (!matchesRecipientGroup(gift, group)) return false;
    }
    return true;
  });
}
