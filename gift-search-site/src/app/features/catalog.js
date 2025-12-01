// gift-search-site/src/app/features/catalog.js
// [НОВЫЙ МОДУЛЬ] Логика каталога: подгрузка, пагинация, сброс к промо.

import { GIFTS } from '../../../data/index.js';
import {
  GIFTS_FOR_KIDS_1,
  GIFTS_FLOWERS_22,
  GIFTS_BOXDARI_33,
  GIFTS_ASKONA_44,
  GIFTS_TECHNIC_55,
  GIFTS_FOOD_77,
  GIFTS_READ_THE_CITY_66,
} from '../../../data/index.js';

import { createGiftCard } from '../../ui/components/GiftCard.js';
import { appendSortedCards } from '../../utils/card-sorter.js'; // <-- ДОБАВЬ ЭТУ СТРОКУ
// import { fetchGiftsBatch } from './promo.js';
import { INITIAL_BATCH, LOAD_BATCH, TELEGRAM_BOT_URL } from '../config.js';
import { createTelegramCTA } from '../../ui/components/TelegramCTA.js';
import { waitForVisible } from '../utils/lazy.js'; // [ДОБАВЛЕНО] отложим первичную загрузку

// === КОНФИГ ВЕСОВ КАТЕГОРИЙ ДЛЯ КАТАЛОГА ===
// Здесь можно регулировать приоритеты (примерно в процентах).
// Весы относительные, сумма не обязана быть ровно 1.
const CATALOG_CATEGORY_CONFIG = [
  { name: 'flowers',        items: GIFTS_FLOWERS_22,     weight: 0.01 }, // ~1%
  { name: 'kids',           items: GIFTS_FOR_KIDS_1,     weight: 0.25 }, // ~25%
  { name: 'technic',        items: GIFTS_TECHNIC_55,     weight: 0.35 }, // ~35%
  { name: 'read_the_city',  items: GIFTS_READ_THE_CITY_66, weight: 0.20 }, // ~20%
  { name: 'boxdari',        items: GIFTS_BOXDARI_33,     weight: 0.10 }, // ~10%
  { name: 'askona',         items: GIFTS_ASKONA_44,      weight: 0.06 }, // ~6%
  { name: 'food',           items: GIFTS_FOOD_77,        weight: 0.03 }, // ~3%
];

// Простое перемешивание массива (Fisher–Yates),
// чтобы внутри каждой категории карточки тоже шли в случайном порядке.
function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// todo Удалить, если заработает новая Строим единый каталог с учётом весов категорий.
// На длинном списке распределение будет близко к указанным весам.
// function buildWeightedCatalog() {
//   // Готовим категории: фильтруем пустые и без веса
//   const categories = CATALOG_CATEGORY_CONFIG
//     .filter((c) => Array.isArray(c.items) && c.items.length > 0 && c.weight > 0)
//     .map((c) => ({
//       name: c.name,
//       weight: c.weight,
//       pool: shuffleArray(c.items), // внутренняя случайность
//     }));

//   const result = [];
//   if (categories.length === 0) return result;

//   // Пока хотя бы в одной категории остались карточки — тянем их по весам
//   while (true) {
//     const available = categories.filter((c) => c.pool.length > 0 && c.weight > 0);
//     if (available.length === 0) break;

//     const totalWeight = available.reduce((sum, c) => sum + c.weight, 0);
//     let r = Math.random() * totalWeight;
//     let picked = available[0];

//     for (let i = 0; i < available.length; i += 1) {
//       const c = available[i];
//       if (r < c.weight) {
//         picked = c;
//         break;
//       }
//       r -= c.weight;
//     }

//     const gift = picked.pool.pop();
//     if (gift) result.push(gift);
//   }

//   return result;
// }


// ! START
// Строим единый каталог с более ровным распределением по весам.
// Идея: на каждой позиции i считаем, сколько элементов "идеально"
// уже должно быть у каждой категории, и берём ту, у которой
// наибольший "дефицит" (ideal - used).
function buildWeightedCatalog() {
  // Готовим категории: фильтруем пустые и без веса
  const rawCategories = CATALOG_CATEGORY_CONFIG
    .filter((c) => Array.isArray(c.items) && c.items.length > 0 && c.weight > 0)
    .map((c) => ({
      name: c.name,
      weight: c.weight,
      pool: shuffleArray(c.items), // внутренняя случайность
      used: 0,                     // сколько уже взяли из этой категории
    }));

  if (rawCategories.length === 0) {
    return [];
  }

  // Общее число карточек во всех категориях
  const totalItems = rawCategories.reduce((sum, c) => sum + c.pool.length, 0);

  // Нормализуем веса, чтобы сумма была 1
  const totalWeight = rawCategories.reduce((sum, c) => sum + c.weight, 0);
  const categories = rawCategories.map((c) => ({
    ...c,
    weightNorm: c.weight / totalWeight,
  }));

  const result = [];

  // Проходим по всем позициям в итоговом каталоге
  for (let i = 1; i <= totalItems; i += 1) {
    let bestCat = null;
    let bestDeficit = -Infinity;

    for (const c of categories) {
      if (c.pool.length === 0) continue;

      // "идеальное" количество элементов этой категории на позиции i
      const idealCount = c.weightNorm * i;
      // насколько мы отстаём от идеала
      const deficit = idealCount - c.used;

      if (deficit > bestDeficit) {
        bestDeficit = deficit;
        bestCat = c;
      }
    }

    if (!bestCat) break;

    const gift = bestCat.pool.pop();
    if (gift) {
      bestCat.used += 1;
      result.push(gift);
    }
  }

  return result;
}

// ! END


// todo START TESTING
// Вспомогательная диагностика: считаем, сколько элементов какой группы
// получилось в итоговом каталоге и показываем первые элементы.
function debugLogCatalog(shuffledCatalog) {
  try {
    const groups = [
      { name: 'flowers',       arr: GIFTS_FLOWERS_22 },
      { name: 'kids',          arr: GIFTS_FOR_KIDS_1 },
      { name: 'technic',       arr: GIFTS_TECHNIC_55 },
      { name: 'read_the_city', arr: GIFTS_READ_THE_CITY_66 },
      { name: 'boxdari',       arr: GIFTS_BOXDARI_33 },
      { name: 'askona',        arr: GIFTS_ASKONA_44 },
      { name: 'food',          arr: GIFTS_FOOD_77 },
    ];

    const counters = {};
    groups.forEach((g) => {
      counters[g.name] = 0;
    });
    counters.other = 0;

    // Считаем, сколько карточек относится к каждой группе
    shuffledCatalog.forEach((gift) => {
      const group = groups.find((g) => g.arr.includes(gift));
      const key = group ? group.name : 'other';
      counters[key] = (counters[key] || 0) + 1;
    });

    console.log('[CATALOG DEBUG] total:', shuffledCatalog.length, 'per-group:', counters);

    // Покажем первые 30 карточек с пометкой группы и id (если есть)
    const preview = shuffledCatalog.slice(0, 30).map((gift, index) => {
      const group = groups.find((g) => g.arr.includes(gift));
      return {
        index,
        group: group ? group.name : 'other',
        id: gift.id ?? gift.slug ?? gift.title ?? '(no id)',
      };
    });

    console.table(preview);
  } catch (err) {
    console.warn('[CATALOG DEBUG] failed:', err);
  }
}

// todo FINISH TESTING

// === УТИЛИТЫ ДЛЯ СТАБИЛИЗАЦИИ СКРОЛЛА ПРИ ДОЗАГРУЗКЕ ===
// Суть: замеряем вертикальную позицию якоря до/после мутации DOM и компенсируем сдвиг прокруткой (без smooth).
function preserveAnchorScroll(anchorEl, mutateDOM) {
  try {
    if (!anchorEl || typeof mutateDOM !== 'function') {
      mutateDOM && mutateDOM();
      return;
    }
    const beforeTop = anchorEl.getBoundingClientRect().top; // позиция якоря до мутации
    mutateDOM(); // выполняем все изменения DOM разом
    const afterTop = anchorEl.getBoundingClientRect().top; // позиция якоря после мутации
    const delta = afterTop - beforeTop;
    if (delta !== 0 && Number.isFinite(delta)) {
      window.scrollBy(0, delta); // моментально компенсируем сдвиг
    }
  } catch (e) {
    console.warn('[preserveAnchorScroll] fallback без компенсации:', e);
    mutateDOM && mutateDOM();
  }
}

// Выбор лучшего якоря для стабилизации:
// 1) CTA-контейнер (стоит сразу под сеткой и перед кнопкой),
// 2) Кнопка "Посмотреть ещё" (если видима),
// 3) Последняя карточка в гриде (резерв).
function getAnchorEl(grid, btnShowMore, ctaContainer) {
  if (ctaContainer && !ctaContainer.classList.contains('hidden')) return ctaContainer;
  if (btnShowMore && !btnShowMore.classList.contains('hidden')) return btnShowMore;
  if (grid && grid.lastElementChild) return grid.lastElementChild;
  return null;
}

// // === Глобальное состояние каталога ===
// let catalogOffset = 0;
// let shuffledCatalog = [];

// // [НОВОЕ] Флаг: пока false — на первичной отрисовке НИКАКОГО автоскролла.
// let isCatalogFirstRenderDone = false;

// === Глобальное состояние каталога ===

// размер "умного" окна, в котором распределяем категории по весам
const CATALOG_WINDOW_SIZE = 30;

let catalogOffset = 0;      // сколько карточек уже отрендерили всего
let categoryPools = [];     // остаток подарков по категориям (после выбора)
let currentWindow = [];     // текущее "умное" окно (до 30 карточек)
let windowOffset = 0;       // сколько карточек из currentWindow уже выдали (15 + 15)

// флаг первой отрисовки каталога (для поведения скролла при дозагрузке)
let isCatalogFirstRenderDone = false;

// Подготавливаем пулы по категориям: копируем массивы и считаем нормализованные веса
function initCategoryPools() {
  const rawCategories = CATALOG_CATEGORY_CONFIG
    .filter((c) => Array.isArray(c.items) && c.items.length > 0 && c.weight > 0);

  if (!rawCategories.length) {
    categoryPools = [];
    return;
  }

  const totalWeight = rawCategories.reduce((sum, c) => sum + c.weight, 0);

  categoryPools = rawCategories.map((c) => ({
    name: c.name,
    weight: c.weight,
    weightNorm: c.weight / totalWeight, // доля категории (0..1)
    pool: shuffleArray(c.items),        // копия массива подарков, перемешанная
  }));
}

// Строим "умное" окно из windowSize карточек из остатка categoryPools
// Логика: на каждой позиции i смотрим, какой категории "идеально" должно быть уже больше,
// и берём подарок из категории с максимальным "дефицитом".
function buildWeightedWindow(windowSize) {
  if (!Array.isArray(categoryPools) || !categoryPools.length) {
    return [];
  }

  const totalItemsLeft = categoryPools.reduce((sum, c) => sum + c.pool.length, 0);
  const targetSize = Math.min(windowSize, totalItemsLeft);
  if (targetSize <= 0) return [];

  // локальное состояние для текущего окна (сколько взяли из категории в этом окне)
  const windowCats = categoryPools.map((c) => ({
    ref: c,                          // ссылка на глобальный пул
    name: c.name,
    weightNorm: c.weightNorm ?? 0,
    used: 0,                         // сколько уже взяли в этом окне
  }));

  const result = [];

  for (let i = 1; i <= targetSize; i += 1) {
    let bestCat = null;
    let bestDeficit = -Infinity;

    for (const c of windowCats) {
      if (!c.ref.pool.length) continue;

      const idealCount = c.weightNorm * i; // "идеальное" кол-во элементов категории на позиции i
      const deficit = idealCount - c.used; // насколько отстаём от идеала

      if (deficit > bestDeficit) {
        bestDeficit = deficit;
        bestCat = c;
      }
    }

    if (!bestCat) break;

    const gift = bestCat.ref.pool.pop(); // забираем подарок из глобального пула
    if (gift) {
      bestCat.used += 1;
      result.push(gift);
    }
  }

  return result;
}

// Проверяем, остались ли ещё карточки (в текущем окне или в пулах категорий)
function hasMoreCatalogItems() {
  const remainingInPools = categoryPools.reduce((sum, c) => sum + c.pool.length, 0);
  const remainingInWindow = currentWindow.length - windowOffset;
  return remainingInPools + Math.max(remainingInWindow, 0) > 0;
}

// Отдаём следующую порцию карточек (15), формируя окно 30 при необходимости.
// Логика:
// - если окно закончилось — собираем новое "умное" окно на 30 карточек;
// - выдаём первые 15 (или меньше, если подарки кончились);
// - на следующей выдаче берём вторые 15 из этого же окна.
function getNextCatalogItems(batchSize) {
  if (!Array.isArray(categoryPools) || !categoryPools.length) {
    return [];
  }

  // если текущее окно закончилось — формируем новое
  if (!currentWindow.length || windowOffset >= currentWindow.length) {
    currentWindow = buildWeightedWindow(CATALOG_WINDOW_SIZE);
    windowOffset = 0;

    // диагностический лог по новому окну (если функция есть)
    if (typeof debugLogCatalog === 'function') {
      debugLogCatalog(currentWindow);
    }
  }

  if (!currentWindow.length) {
    return [];
  }

  const slice = currentWindow.slice(windowOffset, windowOffset + batchSize);
  windowOffset += slice.length;
  catalogOffset += slice.length;

  return slice;
}



export function initCatalogList(GIFT_CARD_DEPS) {
  const grid = document.getElementById('catalogGifts');
  const btnShowMore = document.getElementById('catalogShowMoreBtn');
  const loader = document.getElementById('catalogInitialLoader');
  const ctaContainer = document.getElementById('catalogCTAContainer');

  if (!grid || !btnShowMore || !loader) return;

  // начальное состояние
  catalogOffset = 0;
  windowOffset = 0;
  currentWindow = [];
  categoryPools = [];

  // подготавливаем пулы по категориям и веса (делаем один раз)
  initCategoryPools();

  // показываем спиннер
  loader.classList.remove('hidden');

  // Первую порцию грузим только когда секция каталога реально попала в зону видимости
  const catalogSection = document.getElementById('catalogSection');
  waitForVisible(catalogSection, { threshold: 0.25, rootMargin: '0px 0px -50px 0px' }).then(() => {
    // как только секция видима — берём первую "умную" выдачу (15 карточек из окна-30)
    const batch = getNextCatalogItems(INITIAL_BATCH);

    loader.classList.add('hidden');
    grid.innerHTML = ''; // очищаем сетку перед первой вставкой

    if (!batch.length) {
      // если по какой-то причине подарков нет — просто скрываем кнопку и CTA
      btnShowMore.classList.add('hidden');
      if (ctaContainer) ctaContainer.innerHTML = '';
      return;
    }

    const allCards = [];
    batch.forEach((gift, index) => {
      const currentTempId = index === 0 ? `new-card-${Date.now()}` : null;

      const card = createGiftCard(
        gift,
        currentTempId ? { ...GIFT_CARD_DEPS, tempId: currentTempId } : GIFT_CARD_DEPS,
      );

      if (card && currentTempId) {
        card.setAttribute('data-temp-id', currentTempId);
      }

      if (card) {
        allCards.push(card);
      }
    });

    appendSortedCards(grid, allCards);
    // первая отрисовка каталога завершена — дальше будем аккуратно скроллить только по клику
    isCatalogFirstRenderDone = true;

    // показываем кнопку, если ещё есть карточки (в окне или в пулах)
    if (hasMoreCatalogItems()) {
      btnShowMore.classList.remove('hidden');
    } else {
      if (ctaContainer) ctaContainer.innerHTML = '';
    }

    // CTA-блок должен идти ПЕРЕД кнопкой «Посмотреть ещё»
    if (ctaContainer) {
      ctaContainer.innerHTML = '';
      const cta = createTelegramCTA(TELEGRAM_BOT_URL);
      ctaContainer.appendChild(cta);
      if (btnShowMore && ctaContainer.parentNode) {
        ctaContainer.parentNode.insertBefore(ctaContainer, btnShowMore);
      }
    }
  });

  // обработчик "Посмотреть ещё"
  // btnShowMore.onclick = () => {
  //   // [НОВОЕ] Замеряем вертикальную позицию кнопки ДО скрытия —
  //   // сюда поставим первую новую карточку ПОСЛЕ вставки
  //   const anchorTopBefore = btnShowMore.getBoundingClientRect().top;

  //   btnShowMore.classList.add('hidden');
  //   const catalogLoader = document.getElementById('catalogLoader');
  //   if (catalogLoader) catalogLoader.classList.remove('hidden');

  //   fetchGiftsBatch(shuffledCatalog, catalogOffset, LOAD_BATCH).then((batch) => {
  //     const allCards = [];
  //     // [НОВОЕ] Граница: последняя "старая" карточка до вставки
  //     const boundaryBefore = grid.lastElementChild || null;

  //     batch.forEach((gift, index) => {
  //       // Генерируем уникальный ID для первой карточки в батче
  //       const currentTempId = index === 0 ? `new-card-${Date.now()}` : null;

  //       // Создаем карточку, передавая ей временный ID через опции (только если currentTempId не null)
  //       const card = createGiftCard(
  //         gift,
  //         currentTempId ? { ...GIFT_CARD_DEPS, tempId: currentTempId } : GIFT_CARD_DEPS,
  //       );
  //       // [НОВОЕ] Жёстко помечаем первую карточку батча на DOM-узле
  //       if (card && currentTempId) {
  //         card.setAttribute('data-temp-id', currentTempId);
  //       }

  //       if (card) {
  //         allCards.push(card);
  //       }
  //     });

  //     // === ВСТАВКА НОВЫХ КАРТОЧЕК + ЯВНАЯ ПРОКРУТКА К ПЕРВОЙ НОВОЙ ===

  //     // 1) Вставляем карточки
  //     appendSortedCards(grid, allCards);
  //     catalogOffset += batch.length;

  //     // 2) Прячем лоадер после вставки
  //     if (catalogLoader) catalogLoader.classList.add('hidden');

  //     // 3) Аккуратная прокрутка: ставим первую новую карточку ровно на место кнопки
  //     if (isCatalogFirstRenderDone) {
  //       setTimeout(() => {
  //         const firstNewEl = boundaryBefore
  //           ? boundaryBefore.nextElementSibling
  //           : grid.firstElementChild; // если ранее карточек не было

  //         if (firstNewEl) {
  //           const firstNewTop = firstNewEl.getBoundingClientRect().top;
  //           const delta = firstNewTop - anchorTopBefore;

  //           // (опц.) Компенсация фиксированной шапки, если есть:
  //           // const HEADER_OFFSET = 0; // например, 56
  //           // const adjustedDelta = delta - HEADER_OFFSET;

  //           if (Number.isFinite(delta) && delta !== 0) {
  //             window.scrollBy(0, delta); // мгновенно, без smooth
  //           }

  //           // (опц.) Снимем временную метку, если была
  //           if (firstNewEl.hasAttribute('data-temp-id')) {
  //             firstNewEl.removeAttribute('data-temp-id');
  //           }
  //         }
  //       }, 50); // ждём reflow, чтобы получить корректные top-координаты
  //     }

  //     // 4) Переключаем видимость кнопки/CTA
  //     if (catalogOffset < shuffledCatalog.length) {
  //       btnShowMore.classList.remove('hidden');
  //     } else {
  //       btnShowMore.classList.add('hidden');
  //       // в конце каталога скрываем CTA, чтобы не дублировать с футером
  //       if (ctaContainer) ctaContainer.innerHTML = '';
  //     }
  //   });
  // };

  // обработчик "Посмотреть ещё"
  btnShowMore.onclick = () => {
    // Замеряем вертикальную позицию кнопки ДО скрытия —
    // сюда поставим первую новую карточку ПОСЛЕ вставки
    const anchorTopBefore = btnShowMore.getBoundingClientRect().top;

    btnShowMore.classList.add('hidden');
    const catalogLoader = document.getElementById('catalogLoader');
    if (catalogLoader) catalogLoader.classList.remove('hidden');

    // Берём следующую порцию (15) из текущего/нового "умного" окна
    const batch = getNextCatalogItems(LOAD_BATCH);

    if (!batch.length) {
      if (catalogLoader) catalogLoader.classList.add('hidden');
      btnShowMore.classList.add('hidden');
      if (ctaContainer) ctaContainer.innerHTML = '';
      return;
    }

    const allCards = [];
    const boundaryBefore = grid.lastElementChild || null;

    batch.forEach((gift, index) => {
      const currentTempId = index === 0 ? `new-card-${Date.now()}` : null;

      const card = createGiftCard(
        gift,
        currentTempId ? { ...GIFT_CARD_DEPS, tempId: currentTempId } : GIFT_CARD_DEPS,
      );

      if (card && currentTempId) {
        card.setAttribute('data-temp-id', currentTempId);
      }

      if (card) {
        allCards.push(card);
      }
    });

    // Вставляем новые карточки
    appendSortedCards(grid, allCards);

    // Прячем лоадер после вставки
    if (catalogLoader) catalogLoader.classList.add('hidden');

    // Аккуратно прокручиваем так, чтобы первая новая карточка встала на место кнопки
    if (isCatalogFirstRenderDone) {
      setTimeout(() => {
        const firstNewEl = boundaryBefore
          ? boundaryBefore.nextElementSibling
          : grid.firstElementChild;

        if (firstNewEl) {
          const firstNewTop = firstNewEl.getBoundingClientRect().top;
          const delta = firstNewTop - anchorTopBefore;

          if (Number.isFinite(delta) && delta !== 0) {
            window.scrollBy(0, delta);
          }

          if (firstNewEl.hasAttribute('data-temp-id')) {
            firstNewEl.removeAttribute('data-temp-id');
          }
        }
      }, 50);
    }

    // Переключаем видимость кнопки/CTA в зависимости от наличия подарков
    if (hasMoreCatalogItems()) {
      btnShowMore.classList.remove('hidden');
    } else {
      btnShowMore.classList.add('hidden');
      if (ctaContainer) ctaContainer.innerHTML = '';
    }
  };
}

// === Сброс к промо (восстанавливает изначальный экран) ===
export function resetToPromo() {
  document.getElementById('catalogSection')?.classList.add('hidden');
  document.getElementById('searchResults')?.classList.add('hidden');
  document.getElementById('noResults')?.classList.add('hidden');

  document.querySelector('.random-gifts')?.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
