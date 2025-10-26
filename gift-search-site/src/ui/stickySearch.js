// gift-search-site/src/ui/stickySearch.js
// [ОПТИМИЗАЦИЯ] sticky-search с micro-throttle скролла и debounce resize.
// Поведение не меняем, только уменьшаем частоту перерасчётов.

let __stickyInitialized = false; // [новое] защита от повторной инициализации

export function initStickySearch() {
  if (__stickyInitialized) return; // не создаём второй клон и слушатели
  __stickyInitialized = true;

  const original = document.querySelector('.search-block'); // исходная панель внутри hero
  const hero = document.querySelector('.hero');
  if (!original || !hero) return;

  // 1) Создаём контейнер плавающей панели (в body)
  const floatHost = document.createElement('div');
  floatHost.className = 'search-float';
  const clone = original.cloneNode(true);
  // удаляем id у копии, чтобы не было дублей
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

  // 3) Клики и Enter работают и в копии (дергаем прокинутые в window функции)
  if (cSearchBtn) cSearchBtn.addEventListener('click', () => window.performSearch?.());
  if (cSearchInput) {
    cSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'NumpadEnter') {
        e.preventDefault();
        window.performSearch?.();
      }
    });
  }
  if (cAltBtn) cAltBtn.addEventListener('click', () => window.performAlternativeSearch?.());

  const cAltControlsRoot = clone.querySelector('.controls-grid');
  if (cAltControlsRoot) {
    const altInputs = cAltControlsRoot.querySelectorAll('select, input[type="number"]');
    altInputs.forEach((el) => {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'NumpadEnter') {
          e.preventDefault();
          // вызывем глобальный прокси, который уже прокинут с deps в init.js
          window.performAlternativeSearch?.();
        }
      });
    });
  }

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
      if (detailsOrig) detailsOrig.open = false; // закрываем альтернативные контролы у оригинала
    } else {
      floatHost.classList.remove('visible');
      original.classList.remove('search-original-hidden');
      document.body.classList.remove('has-floating-search');
    }
  }

  // 7) Micro-throttle скролла и debounce resize
  let ticking = false;
  let lastRun = 0;
  const THROTTLE_MS = 80; // ~12.5 FPS, достаточно для UI без лагов
  let resizeTimer = null;

  // <-- ВСТАВЬ СЮДА: ПОЛНАЯ ЗАМЕНА ФУНКЦИИ update() -->
  function update() {
    // вызывается внутри rAF
    const scrolled = window.pageYOffset || document.documentElement.scrollTop;
    const wantShow = scrolled > stickyPoint();

    // Во время режима поиска (body.search-mode) липкую панель принудительно скрываем,
    // чтобы не перекрывать заголовок "Подарки для ..."
    const forcedHidden = document.body.classList.contains('search-mode');
    const show = wantShow && !forcedHidden;

    renderState(show);
    ticking = false;
    lastRun = performance.now();
  }
  // <-- /ВСТАВЬ СЮДА -->

  function onScroll() {
    // micro-throttle: не чаще THROTTLE_MS и по rAF
    const now = performance.now();
    if (ticking) return;
    if (now - lastRun < THROTTLE_MS) return; // пропустим частые события
    ticking = true;
    window.requestAnimationFrame(update);
  }

  function onResize() {
    // лёгкий debounce на resize (пересчёт stickyPoint выполняем разово)
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      // при ресайзе сразу обновляем состояние
      update();
    }, 120);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });

  // начальный рендер
  update();
}
