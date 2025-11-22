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
    gifts: 'Подарки',
    beauty: 'Красота',
    toys: 'Игрушки',
    boardgames: 'Настольные игры',
    health: 'Здоровье',
    hobby: 'Хобби',
    tools: 'Инструменты',
    sport: 'Спорт',
    office: 'Офис',
    food: 'Готовая еда, комбо, сеты',
    home: 'Дом',
    technic: 'Техника',
    entertainment: 'Развлечения',
    impressions: 'Впечатления',
    adventures: 'Приключения',
    mood: 'Настроение',
    transport: 'Транспорт',
    childdevelopment: 'Развивающие',
    creative: 'Творчество',
    education: 'Образование',
    books: 'Книги',
    outdoor: 'На открытом воздухе',
    celebration: 'Праздник',
    flowers: 'Цветы',
    universal: 'Универсальное',
  };
  return translations[category] || category || 'Разное';
}

// [ДОБАВЛЕНО] Словарь родительного падежа для заголовка «Подарки для …»
const GENITIVE_MAP = {
  'мама': 'мамы',
  'жена': 'жены',
  'дочь': 'дочери',
  'девочка': 'девочки',
  'внучка': 'внучки',
  'племянница': 'племянницы',
  'сестра': 'сестры',
  'подруга': 'подруги',
  'девушка': 'девушки',
  'женщина': 'женщины',
  'бабушка': 'бабушки',
  'папа': 'папы',
  'муж': 'мужа',
  'мальчик': 'мальчика',
  'сын': 'сына',
  'внук': 'внука',
  'брат': 'брата',
  'племянник': 'племянника',
  'друг': 'друга',
  'парень': 'парня',
  'мужчина': 'мужчины',
  'дедушка': 'дедушки',
  'коллега': 'коллеги',
  'начальник': 'начальника',
  'ребенок': 'ребёнка',
  'ребёнок': 'ребёнка',
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


