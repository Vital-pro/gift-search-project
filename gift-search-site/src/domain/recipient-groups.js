// gift-search-site/src/domain/recipient-groups.js
// Все группы получателей и правила сопоставления тегов — без зависимостей от DOM.

const CHILD_MAX_AGE = 13;

const RECIPIENT_GROUPS = {
  maleChild: new Set(['брат', 'сын', 'мальчик', 'племянник', 'внук']),
  femaleChild: new Set(['сестра', 'дочь', 'девочка', 'внучка', 'племянница']),
  childAny: new Set(['ребенок', 'ребёнок', 'дети', 'ребенку', 'ребёнку', 'детям']),
  maleAdult: new Set(['муж', 'парень', 'папа', 'отец', 'дедушка', 'начальник', 'друг', 'коллега']),
  femaleAdult: new Set([
    'жена',
    'девушка',
    'мама',
    'мать',
    'бабушка',
    'подруга',
    'сестра',
    'коллега',
  ]),
  adultAny: new Set(['родственник', 'родня', 'семья', 'человек']),
};

const TAGS_MALE_CHILD = new Set(['сын', 'брат', 'мальчик', 'внук', 'племянник']);
const TAGS_FEMALE_CHILD = new Set(['дочь', 'сестра', 'девочка', 'внучка', 'племянница']);
const TAGS_GENERIC_CHILD = new Set(['ребёнок', 'ребенок', 'дети', 'семья', 'унисекс']);

const TAGS_MALE_ADULT = new Set([
  'муж',
  'папа',
  'отец',
  'дедушка',
  'парень',
  'брат',
  'коллега',
  'начальник',
]);
const TAGS_FEMALE_ADULT = new Set([
  'жена',
  'мама',
  'бабушка',
  'девушка',
  'сестра',
  'подруга',
  'коллега',
  'начальник',
]);
const TAGS_GENERIC_ADULT = new Set(['семья', 'унисекс', 'пара', 'дом', 'универсально']);

function intersects(setA, setB) {
  for (const v of setB) if (setA.has(v)) return true;
  return false;
}

export function inferRecipientGroup(recipient, age) {
  const r = (recipient || '').toLowerCase();
  const isChild = age != null && age <= CHILD_MAX_AGE;

  if (isChild) {
    if (RECIPIENT_GROUPS.maleChild.has(r)) return 'maleChild';
    if (RECIPIENT_GROUPS.femaleChild.has(r)) return 'femaleChild';
    if (RECIPIENT_GROUPS.childAny.has(r)) return 'childAny';
    return 'childAny';
  } else {
    if (RECIPIENT_GROUPS.maleAdult.has(r)) return 'maleAdult';
    if (RECIPIENT_GROUPS.femaleAdult.has(r)) return 'femaleAdult';
    return 'adultAny';
  }
}

export function matchesRecipientGroup(gift, group) {
  const tags = (gift.recipientTags || []).map((t) => t.toLowerCase());
  const tagSet = new Set(tags);

  if (group === 'maleChild') {
    const allow = intersects(tagSet, TAGS_MALE_CHILD) || intersects(tagSet, TAGS_GENERIC_CHILD);
    const onlyFemale =
      intersects(tagSet, TAGS_FEMALE_CHILD) &&
      !intersects(tagSet, TAGS_MALE_CHILD) &&
      !intersects(tagSet, TAGS_GENERIC_CHILD);
    return allow && !onlyFemale;
  }
  if (group === 'femaleChild') {
    const allow = intersects(tagSet, TAGS_FEMALE_CHILD) || intersects(tagSet, TAGS_GENERIC_CHILD);
    const onlyMale =
      intersects(tagSet, TAGS_MALE_CHILD) &&
      !intersects(tagSet, TAGS_FEMALE_CHILD) &&
      !intersects(tagSet, TAGS_GENERIC_CHILD);
    return allow && !onlyMale;
  }
  if (group === 'childAny') {
    return (
      intersects(tagSet, TAGS_GENERIC_CHILD) ||
      intersects(tagSet, TAGS_MALE_CHILD) ||
      intersects(tagSet, TAGS_FEMALE_CHILD)
    );
  }
  if (group === 'maleAdult') {
    const allow = intersects(tagSet, TAGS_MALE_ADULT) || intersects(tagSet, TAGS_GENERIC_ADULT);
    const onlyFemale =
      intersects(tagSet, TAGS_FEMALE_ADULT) &&
      !intersects(tagSet, TAGS_MALE_ADULT) &&
      !intersects(tagSet, TAGS_GENERIC_ADULT);
    return allow && !onlyFemale;
  }
  if (group === 'femaleAdult') {
    const allow = intersects(tagSet, TAGS_FEMALE_ADULT) || intersects(tagSet, TAGS_GENERIC_ADULT);
    const onlyMale =
      intersects(tagSet, TAGS_MALE_ADULT) &&
      !intersects(tagSet, TAGS_FEMALE_ADULT) &&
      !intersects(tagSet, TAGS_GENERIC_ADULT);
    return allow && !onlyMale;
  }
  return (gift.recipientTags || []).length > 0;
}
