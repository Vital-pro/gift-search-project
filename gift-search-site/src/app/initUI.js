// gift-search-site/src/app/initUI.js
// Инициализация вспомогательных UI: кнопка "Наверх", tooltip, ссылка в футере.

function initToTopButton() {
  const toTopBtn = document.getElementById('toTopBtn');
  if (!toTopBtn) return;

  const SCROLL_THRESHOLD = 300;
  let ticking = false;

  function updateToTopButton() {
    const scrolled = window.pageYOffset || document.documentElement.scrollTop;
    if (scrolled > SCROLL_THRESHOLD) toTopBtn.classList.remove('hidden');
    else toTopBtn.classList.add('hidden');
    ticking = false;
  }

  function requestTick() {
    if (!ticking) {
      window.requestAnimationFrame(updateToTopButton);
      ticking = true;
    }
  }

  window.addEventListener('scroll', requestTick, { passive: true });
  toTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  updateToTopButton(); // начальный рендер
}

function initTooltip() {
  const tooltip = document.getElementById('tooltip');
  if (!tooltip) return;

  const hide = () => tooltip.classList.add('hidden');

  // [ИСПРАВЛЕНО] Делегирование: работает для обеих кнопок (оригинал + липкая копия)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest?.('.help-btn');
    if (btn) {
      e.stopPropagation();
      if (tooltip.classList.contains('hidden')) {
        const rect = btn.getBoundingClientRect();
        tooltip.style.top = `${rect.bottom + 10}px`;
        tooltip.style.left = `${Math.max(12, rect.left - 200)}px`;
        tooltip.classList.remove('hidden');
      } else {
        hide();
      }
      return;
    }
    // клик мимо — закрываем
    hide();
  });
}

// [ДОБАВЛЕНО] Тоггл темы (light/dark) с запоминанием и реакцией на систему
function initThemeToggle() {
  const themeToggle = document.querySelector('.theme-toggle');
  const themeIcon = document.querySelector('.theme-icon');

  // если на странице нет кнопки — тихо выходим
  if (!themeToggle) return;

  const saved = localStorage.getItem('theme');
  const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  let theme = saved || (systemDark ? 'dark' : 'light');

  const apply = (t) => {
    document.documentElement.setAttribute('data-theme', t);
    if (themeIcon) themeIcon.textContent = t === 'dark' ? '☀️' : '🌙';
    themeToggle.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
  };

  // первоначальное применение
  apply(theme);

  // клик по кнопке — переключение и сохранение
  themeToggle.addEventListener('click', () => {
    theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', theme);
    apply(theme);
  });

  // если пользователь НЕ сохранял тему — реагируем на системную смену
  if (!saved && window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    // старые браузеры могут не поддерживать addEventListener у MQ
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', (e) => {
        theme = e.matches ? 'dark' : 'light';
        apply(theme);
      });
    } else if (typeof mq.addListener === 'function') {
      // fallback для старых
      mq.addListener((e) => {
        theme = e.matches ? 'dark' : 'light';
        apply(theme);
      });
    }
  }
}

function setTelegramLink() {
  const telegramLink = document.getElementById('telegramLink');
  if (!telegramLink) return;

  const utm = new URLSearchParams({
    start: 'web_catalog',
    utm_source: 'site',
    utm_medium: 'footer',
    utm_campaign: 'giftbot',
  }).toString();

  // если в href уже есть query — не дублируем '?'
  const base = telegramLink.getAttribute('href') || 'https://t.me/poodarokBot';
  const hasQuery = base.includes('?');
  telegramLink.href = hasQuery ? `${base}&${utm}` : `${base}?${utm}`;
}

export function initUI() {
  initThemeToggle(); // [ДОБАВЛЕНО] включаем переключатель темы
  initToTopButton();
  initTooltip();
  setTelegramLink();
}

