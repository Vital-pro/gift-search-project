// gift-search-site/src/app/utils/format.js
// Единый набор функций форматирования данных и UI-строк.

export function formatPrice(value) {
  if (value == null || isNaN(value)) return '';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value);
}

export function translateCategory(category) {
  const translations = {
    beauty: 'Красота',
    boardgames: 'Настольные игры',
    health: 'Здоровье',
    kitchen_activity: 'Хобби',
    tech: 'Техника',
    hobby: 'Хобби',
    tools: 'Инструменты',
    toys: 'Игрушки',
    education: 'Образование',
    creative: 'Творчество',
    creativity: 'Творчество',
    jewelry: 'Украшения',
    perfume: 'Парфюм',
    sport: 'Спорт',
    grooming: 'Уход',
    office: 'Офис',
    food: 'Еда',
    home: 'Дом',
    photo: 'Фото',
    entertainment: 'Развлечения',
    transport: 'Транспорт',
    books: 'Книги',
    clothes: 'Одежда',
    outdoor: 'Outdoor',
    party: 'Праздник',
    celebration: 'Праздник',
    universal: 'Универсальное',
  };
  return translations[category] || category || 'Разное';
}

// [ДОБАВЛЕНО] Словарь родительного падежа для заголовка «Подарки для …»
const GENITIVE_MAP = {
  'мама': 'мамы',
  'папа': 'папы',
  'жена': 'жены',
  'муж': 'мужа',
  'дочь': 'дочери',
  'сын': 'сына',
  'сестра': 'сестры',
  'брат': 'брата',
  'подруга': 'подруги',
  'друг': 'друга',
  'девушка': 'девушки',
  'парень': 'парня',
  'коллега': 'коллеги',
  'начальник': 'начальника',
  'ребенок': 'ребёнка',
  'ребёнок': 'ребёнка',
  'бабушка': 'бабушки',
  'дедушка': 'дедушки',
  'мальчик': 'мальчика',
  'девочка': 'девочки',
  'внук': 'внука',
  'внучка': 'внучки',
  'племянник': 'племянника',
  'племянница': 'племянницы',
};

// [ДОБАВЛЕНО] Форматирование получателя в родительном падеже для заголовка
export function formatRecipientGenitive(recipient) {
  if (!recipient) return '';
  const r = String(recipient).toLowerCase();
  // если нашли точное соответствие — вернём его
  if (GENITIVE_MAP[r]) return GENITIVE_MAP[r];
  // иначе сделаем простое эвристическое окончание (очень щадяще)
  // например «мама»→«мамы» уже есть выше; здесь лишь fallback для редких слов
  if (r.endsWith('а')) return r.slice(0, -1) + 'ы';
  if (r.endsWith('я')) return r.slice(0, -1) + 'и';
  if (r.endsWith('й')) return r.slice(0, -1) + 'я';
  return r; // оставить как есть, если не знаем правило
}


