// gift-search-site/src/app/ui/searchView.js
// Управление состоянием экранов (promo, каталог, результаты) и очисткой полей,
// плюс контроль липкой панели через body.search-mode.

function closeAllAlternativeControls() {
  // Оригинал
  document.querySelectorAll('.controls-dropdown').forEach((d) => (d.open = false));
  // Копия в липкой панели
  const float = document.querySelector('.search-float');
  if (float) {
    float.querySelectorAll('.controls-dropdown').forEach((d) => (d.open = false));
  }
}

/**
 * Скрывает стартовые блоки и активирует зону результатов.
 * Также принудительно скрывает липкую панель на время режима поиска.
 * И закрывает альтернативные контролы (оригинал + липкая).
 */
export function enterSearchMode() {
  document.body.classList.add('search-mode'); // sticky скрывается принудительно

  document.getElementById('promoSection')?.classList.add('hidden');
  document.getElementById('catalogSection')?.classList.add('hidden');
  document.getElementById('randomGifts')?.closest('section')?.classList.add('hidden');

  document.getElementById('searchResults')?.classList.remove('hidden');
  document.getElementById('noResults')?.classList.add('hidden');

  document.querySelector('.hero')?.classList.add('compact');
  document.querySelector('.search-block')?.classList.add('compact');

  // Прячем сразу контейнер липкой панели, если он уже создан
  const floatHost = document.querySelector('.search-float');
  floatHost?.classList.remove('visible');

  // Закрываем альтернативные контролы
  closeAllAlternativeControls();
}

/**
 * Возвращает стартовый вид и вновь разрешает появление липкой панели.
 */
export function exitSearchMode() {
  document.body.classList.remove('search-mode'); // sticky снова может показываться

  document.getElementById('promoSection')?.classList.remove('hidden');
  document.getElementById('catalogSection')?.classList.remove('hidden');
  document.getElementById('randomGifts')?.closest('section')?.classList.remove('hidden');

  document.getElementById('searchResults')?.classList.add('hidden');
  document.getElementById('noResults')?.classList.add('hidden');

  document.querySelector('.hero')?.classList.remove('compact');
  document.querySelector('.search-block')?.classList.remove('compact');
}

/**
 * Полностью очищает поля поиска (оригинал и липкая копия).
 */
export function clearSearchInputs() {
  // Оригинальные элементы по id
  const idFields = ['#searchInput', '#recipientSelect', '#ageInput', '#budgetInput'];
  idFields.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      if (el.tagName === 'SELECT') el.selectedIndex = 0;
      else el.value = '';
    });
  });

  // Копии внутри .search-float (без id)
  const float = document.querySelector('.search-float');
  if (float) {
    // текстовый input
    const cSearch = float.querySelector('input[type="text"]');
    if (cSearch) cSearch.value = '';

    // альтернативные контролы: 1 select + 2 number
    const cRecipient = float.querySelector('select');
    if (cRecipient) cRecipient.selectedIndex = 0;

    const numbers = float.querySelectorAll('input[type="number"]');
    numbers.forEach((n) => (n.value = ''));
  }
}

/**
 * Сброс: выйти из режима поиска, очистить поля, прокрутить вверх.
 */
export function resetSearchView() {
  exitSearchMode();
  clearSearchInputs();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Очистить только текстовые поля поиска (везде: оригинал + липкая).
 */
export function clearTextInputsEverywhere() {
  document.querySelectorAll('#searchInput').forEach((el) => (el.value = ''));
  const float = document.querySelector('.search-float');
  const cSearch = float?.querySelector('input[type="text"]');
  if (cSearch) cSearch.value = '';
}

/**
 * Очистить только альтернативные контролы (везде: оригинал + липкая).
 */
export function clearAltControlsEverywhere() {
  // Оригинал
  const oRecipient = document.getElementById('recipientSelect');
  const oAge = document.getElementById('ageInput');
  const oBudget = document.getElementById('budgetInput');
  if (oRecipient) oRecipient.selectedIndex = 0;
  if (oAge) oAge.value = '';
  if (oBudget) oBudget.value = '';

  // Копия
  const float = document.querySelector('.search-float');
  if (float) {
    const cRecipient = float.querySelector('select');
    if (cRecipient) cRecipient.selectedIndex = 0;
    const numbers = float.querySelectorAll('input[type="number"]');
    numbers.forEach((n) => (n.value = ''));
  }
}

/**
 * Прокрутка к секции результатов с учётом высоты header (чтобы заголовок не «уезжал» под него).
 * @param {HTMLElement} section
 * @param {number} extraOffsetPx - дополнительный «воздух» над заголовком
 */
export function scrollToSectionWithOffset(section, extraOffsetPx = 12) {
  if (!section) return;
  const header = document.querySelector('header');
  const headerH = header?.offsetHeight || 56;
  const rect = section.getBoundingClientRect();
  const absoluteTop = window.pageYOffset + rect.top;
  const target = Math.max(0, absoluteTop - headerH - extraOffsetPx);
  window.scrollTo({ top: target, behavior: 'smooth' });
}
