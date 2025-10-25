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

  // 2) Ссылки на элементы оригинала
  const oSearchInput = original.querySelector('#searchInput');
  const oSearchBtn = original.querySelector('#searchBtn');
  const oAltBtn = original.querySelector('#altSearchBtn');
  const oRecipient = original.querySelector('#recipientSelect');
  const oAge = original.querySelector('#ageInput');
  const oBudget = original.querySelector('#budgetInput');
  const detailsOrig = original.querySelector('.controls-dropdown');

  // 3) Ссылки на элементы копии (без id, выбираем по типам)
  const cSearchInput = clone.querySelector('input[type="text"]');
  const cSearchBtn = clone.querySelector('button.search-btn');
  const cAltBtn = clone.querySelector('.alt-search-btn');

  // Внутри копии найдём альтернативные контролы:
  //  - один <select> → recipient
  //  - два <input type="number"> → первый age, второй budget
  const cRecipient = clone.querySelector('select');
  const numberInputs = clone.querySelectorAll('input[type="number"]');
  const cAge = numberInputs?.[0] || null;
  const cBudget = numberInputs?.[1] || null;

  // 4) Клики и Enter работают и в копии
  if (cSearchBtn) cSearchBtn.addEventListener('click', () => window.performSearch?.());
  if (cSearchInput) {
    const triggerEnterSearch = (e) => {
      if (e.key === 'Enter' || e.key === 'NumpadEnter') {
        e.preventDefault();
        window.performSearch?.();
      }
    };
    cSearchInput.addEventListener('keydown', triggerEnterSearch);
    cSearchInput.addEventListener('keyup', triggerEnterSearch);
  }
  if (cAltBtn) cAltBtn.addEventListener('click', () => window.performAlternativeSearch?.());

  // [ДОБАВЛЕНО] Enter для альтернативных контролов в липкой панели
  const triggerAltEnter = (e) => {
    if (e.key === 'Enter' || e.key === 'NumpadEnter') {
      e.preventDefault();
      window.performAlternativeSearch?.();
    }
  };
  cRecipient?.addEventListener('keydown', triggerAltEnter);
  cRecipient?.addEventListener('keyup', triggerAltEnter);
  cAge?.addEventListener('keydown', triggerAltEnter);
  cAge?.addEventListener('keyup', triggerAltEnter);
  cBudget?.addEventListener('keydown', triggerAltEnter);
  cBudget?.addEventListener('keyup', triggerAltEnter);

  // 5) Двусторонняя синхронизация значения input ПОИСКА (как было)
  if (oSearchInput && cSearchInput) {
    // из оригинала → в копию
    oSearchInput.addEventListener('input', () => {
      cSearchInput.value = oSearchInput.value;
    });
    // из копии → в оригинал
    cSearchInput.addEventListener('input', () => {
      oSearchInput.value = cSearchInput.value;
    });
    // начальная инициализация
    cSearchInput.value = oSearchInput.value || '';
  }

  // [ДОБАВЛЕНО] 6) Двусторонняя синхронизация альтернативных контролов
  // Получатель (select)
  if (oRecipient && cRecipient) {
    // оригинал → копия
    oRecipient.addEventListener('change', () => {
      cRecipient.value = oRecipient.value;
    });
    // копия → оригинал
    cRecipient.addEventListener('change', () => {
      oRecipient.value = cRecipient.value;
    });
    // начальная инициализация
    cRecipient.value = oRecipient.value || '';
  }

  // Возраст (number)
  if (oAge && cAge) {
    const syncNumber = (from, to) => {
      to.value = from.value;
    };
    // оригинал → копия
    oAge.addEventListener('input', () => syncNumber(oAge, cAge));
    // копия → оригинал
    cAge.addEventListener('input', () => syncNumber(cAge, oAge));
    // начальная инициализация
    cAge.value = oAge.value || '';
  }

  // Бюджет (number)
  if (oBudget && cBudget) {
    const syncNumber = (from, to) => {
      to.value = from.value;
    };
    // оригинал → копия
    oBudget.addEventListener('input', () => syncNumber(oBudget, cBudget));
    // копия → оригинал
    cBudget.addEventListener('input', () => syncNumber(cBudget, oBudget));
    // начальная инициализация
    cBudget.value = oBudget.value || '';
  }

  // 7) Порог видимости копии
  const headerHeight = 60;
  const stickyPoint = () => hero.offsetHeight - headerHeight - 70;

  // 8) Рендер состояния + учёт режима поиска (search-mode)
  let visible = false;
  function renderState(show) {
    // Если включён режим поиска — принудительно скрываем липкую панель
    const forceHide = document.body.classList.contains('search-mode');

    const nextVisible = !forceHide && show;
    if (nextVisible === visible) return;
    visible = nextVisible;

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

  // 9) Логика скролла/resize
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
