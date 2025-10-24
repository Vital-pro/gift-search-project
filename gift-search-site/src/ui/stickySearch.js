// gift-search-site/src/ui/stickySearch.js
export function initStickySearch() {
  const original = document.querySelector('.search-block'); // исходная панель внутри hero
  const hero = document.querySelector('.hero');
  if (!original || !hero) return;

  // 1) Создаём контейнер плавающей панели (в body)
  const floatHost = document.createElement('div');
  floatHost.className = 'search-float';
  const clone = original.cloneNode(true);
  // удаляем id, чтобы не было дублей
  clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  floatHost.appendChild(clone);
  document.body.appendChild(floatHost);

  // 2) Ссылки на элементы оригинала и копии
  const oSearchInput = original.querySelector('#searchInput');
  const cSearchInput = clone.querySelector('input[type="text"]');
  const oSearchBtn = original.querySelector('#searchBtn');
  const cSearchBtn = clone.querySelector('button.search-btn');
  const oAltBtn = original.querySelector('#altSearchBtn');
  const cAltBtn = clone.querySelector('.alt-search-btn');
  const detailsOrig = original.querySelector('.controls-dropdown');

  // 3) Клики и Enter работают и в копии
  if (cSearchBtn) cSearchBtn.addEventListener('click', () => window.performSearch?.());
  if (cSearchInput)
    cSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') window.performSearch?.();
    });
  if (cAltBtn) cAltBtn.addEventListener('click', () => window.performAlternativeSearch?.());

  // 4) Двусторонняя синхронизация значения input
  if (oSearchInput && cSearchInput) {
    oSearchInput.addEventListener('input', () => {
      cSearchInput.value = oSearchInput.value;
    });
    cSearchInput.addEventListener('input', () => {
      oSearchInput.value = cSearchInput.value;
    });
    cSearchInput.value = oSearchInput.value || '';
  }

  // 5) Порог видимости копии
  const headerHeight = 60;
  const stickyPoint = () => hero.offsetHeight - headerHeight - 70;

  // 6) Рендер состояния
  let visible = false;
  function renderState(show) {
    if (show === visible) return;
    visible = show;
    if (visible) {
      floatHost.classList.add('visible');
      original.classList.add('search-original-hidden');
      document.body.classList.add('has-floating-search');
      if (detailsOrig) detailsOrig.open = false;
    } else {
      floatHost.classList.remove('visible');
      original.classList.remove('search-original-hidden');
      document.body.classList.remove('has-floating-search');
    }
  }

  // 7) Логика скролла/resize
  let ticking = false;
  function update() {
    const scrolled = window.pageYOffset || document.documentElement.scrollTop;
    const show = scrolled > stickyPoint();
    renderState(show);
    ticking = false;
  }
  function requestTick() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(update);
    }
  }

  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', requestTick);
  update();
}
