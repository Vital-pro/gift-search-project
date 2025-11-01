// gift-search-site/src/ui/components/GiftCard.js
// ВАЖНО: структура классов сохранена 1:1 со старой версией из main.js,
// чтобы стили из styles.css применялись без изменений.
//
// Компонент ничего не "знает" о глобалах — все зависимости передаются через options.

export function createGiftCard(gift, options) {
  const {
    showTransitionOverlay,
    openWithPreloader,
    resolveGiftUrl,
    validatePartnerUrl,
    b64url,
    translateCategory,
    formatPrice,
    API_BASE,
  } = options || {};

  const card = document.createElement('div');
  card.className = 'gift-card';
  card.style.animationDelay = `${Math.random() * 0.4}s`;

  // === JSON-LD микроразметка (как было) ===
  const jsonLd = document.createElement('script');
  jsonLd.type = 'application/ld+json';
  jsonLd.textContent = JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: gift.name,
      description: gift.description || '',
      offers: {
        '@type': 'Offer',
        price: gift.price,
        priceCurrency: 'RUB',
        url: (resolveGiftUrl && resolveGiftUrl(gift)) || window.location.href,
        availability: 'https://schema.org/InStock',
        seller: { '@type': 'Organization', name: 'Gift Search Project' },
      },
      category: translateCategory ? translateCategory(gift.category) : gift.category,
      audience: {
        '@type': 'PeopleAudience',
        suggestedMinAge: gift.ageRange?.[0] || 0,
        suggestedMaxAge: gift.ageRange?.[1] || 100,
      },
    },
    null,
    2,
  );
  card.appendChild(jsonLd);

  // Иконки категорий — как было
  const categoryIcons = {
    beauty: '💄',
    health: '💊',
    tech: '💻',
    hobby: '🎨',
    tools: '🔧',
    toys: '🧸',
    education: '📚',
    creative: '🎨',
    jewelry: '💎',
    perfume: '🌸',
    sport: '⚽',
    grooming: '🧔',
    office: '💼',
    food: '🍰',
    home: '🏠',
    photo: '📸',
    entertainment: '🎬',
    transport: '🛴',
    books: '📖',
    clothes: '👕',
    outdoor: '🏔️',
    universal: '🎁',
  };
  const icon = categoryIcons[gift.category] || '🎁';

  // === ИЗМЕНЕНИЕ: Сортируем теги так, чтобы точное совпадение было первым ===
  const prepareRecipientTags = (tags) => {
    if (!Array.isArray(tags)) return [];

    const currentRecipient = window.currentSearchRecipient || '';
    let sortedTags = [...tags];

    // Если есть текущий поиск по получателю, ставим точное совпадение первым
    if (currentRecipient) {
      const exactIndex = sortedTags.findIndex(
        (tag) => String(tag).toLowerCase() === currentRecipient.toLowerCase(),
      );
      if (exactIndex > -1) {
        // Перемещаем точное совпадение в начало массива
        const [exactTag] = sortedTags.splice(exactIndex, 1);
        sortedTags.unshift(exactTag);
      }
    }

    return sortedTags.slice(0, 4); // показываем до 5 тегов
  };

  const displayTags = prepareRecipientTags(gift.recipientTags);

  // Каркас — строго прежние классы
  card.innerHTML = `
    <div class="gift-card-image" aria-hidden="true">
      <span style="font-size: 4rem; line-height: 1;">${icon}</span>
    </div>
    <div class="gift-card-body">
      <h3 class="gift-card-title">${gift.name}</h3>
      <p class="gift-card-description">${gift.description || ''}</p>
      <div class="gift-card-price">${formatPrice ? formatPrice(gift.price) : gift.price}</div>
      <div class="gift-card-tags">
        ${displayTags.map((t) => `<span class="gift-tag">${t}</span>`).join('')}
      </div>
      <div class="gift-card-footer">
        <span class="age-range">${gift.ageRange?.[0] ?? 0}-${gift.ageRange?.[1] ?? 120} лет</span>
        <span class="category-badge">${translateCategory ? translateCategory(gift.category) : gift.category}</span>
      </div>
      <div class="gift-card-actions" style="margin-top:12px;"></div>
    </div>
  `;

  // [ДОБАВЛЕНО] Ленивая загрузка изображения товара, если gift.image задан
  (function setupLazyImage() {
    try {
      const container = card.querySelector('.gift-card-image');
      if (!container) return;

      // если у подарка нет картинки — оставляем эмоджи как раньше
      if (!gift.image || typeof gift.image !== 'string') return;

      // очищаем эмоджи-плейсхолдер
      container.innerHTML = '';

      const img = document.createElement('img');
      img.alt = gift.name || 'Изображение подарка';
      img.loading = 'lazy'; // браузер сам отложит загрузку
      img.decoding = 'async'; // асинхронное декодирование, не блокирует основной поток
      img.referrerPolicy = 'no-referrer';
      img.fetchPriority = 'low'; // не мешаем приоритетам «героя»

      // Если известны размеры — зададим, чтобы снизить layout shift (опц.)
      if (gift.imageWidth && gift.imageHeight) {
        img.width = gift.imageWidth;
        img.height = gift.imageHeight;
      }

      // Устанавливаем src в самом конце, чтобы атрибуты успели примениться
      img.src = gift.image;

      container.appendChild(img);
    } catch (e) {
      // fail-safe: если что-то пошло не так — просто оставим эмоджи
      console.warn('[GiftCard] setupLazyImage error:', e);
    }
  })();

  const actions = card.querySelector('.gift-card-actions');
  const partnerUrl = resolveGiftUrl ? resolveGiftUrl(gift) : null;

  const setUnavailable = () => {
    if (!actions) return;
    actions.innerHTML = `<button class="gift-buy-btn" disabled aria-disabled="true" title="Товар временно недоступен">Ожидаем поставку</button>`;
    card.style.cursor = 'default';
    card.removeAttribute('role');
    card.removeAttribute('tabindex');
    card.removeAttribute('aria-label');
  };

  const setAvailable = (url) => {
    if (!actions) return;

    // межстраница /api/go (как было), учитываем API_BASE
    const interstitialUrl = (API_BASE || '') + `/api/go?t=${b64url ? b64url(url) : ''}`;

    actions.innerHTML = `
      <a class="gift-buy-btn"
         href="${interstitialUrl}"
         target="_blank"
         rel="noopener nofollow sponsored"
         aria-label="Перейти к товару на площадке">К товару</a>
    `;

    const linkEl = actions.querySelector('.gift-buy-btn');

    // Клик по кнопке — прелоадер + переход
    linkEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const isPrimary = e.button === 0;
      const hasMods = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
      if (isPrimary && !hasMods) {
        e.preventDefault();
        showTransitionOverlay &&
          showTransitionOverlay('🎁 Подбираем лучший подарок для вас...', 2000);
        openWithPreloader &&
          openWithPreloader(
            linkEl.href,
            '🎁 Подбираем лучший подарок для вас...',
            'Скоро откроем магазин',
          );
      }
    });

    // Клик по карточке — тот же сценарий
    card.style.cursor = 'pointer';
    card.setAttribute('role', 'link');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Открыть товар: ${gift.name}`);

    card.addEventListener('click', (e) => {
      if (e.target && e.target.closest && e.target.closest('.gift-buy-btn')) return;
      showTransitionOverlay &&
        showTransitionOverlay('🎁 Подбираем лучший подарок для вас...', 2000);
      openWithPreloader &&
        openWithPreloader(
          interstitialUrl,
          '🎁 Подбираем лучший подарок для вас...',
          'Скоро откроем магазин',
        );
    });

    // A11y: Enter/Space
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showTransitionOverlay &&
          showTransitionOverlay('🎁 Подбираем лучший подарок для вас...', 2000);
        openWithPreloader &&
          openWithPreloader(
            interstitialUrl,
            '🎁 Подбираем лучший подарок для вас...',
            'Скоро откроем магазин',
          );
      }
    });
  };

  if (!partnerUrl) {
    setUnavailable();
    return card;
  }
  const v = validatePartnerUrl ? validatePartnerUrl(partnerUrl) : { ok: true };
  if (!v.ok) {
    setUnavailable();
    return card;
  }
  setAvailable(partnerUrl);
  return card;
}
