// gift-search-site/src/ui/components/GiftCard.js
import { categoryPlaceholderImages } from '../../../data/gifts/categoryPlaceholderImages.js';
import { getGiftLinkStatus } from '../../utils/link-checker.js';

export function createGiftCard(gift, options) {

  // НОВАЯ ПРОВЕРКА: получаем статус ссылок товара
  const linkStatus = getGiftLinkStatus(gift);

  // ВСЕ ссылки заблокированы - создаем карточку "проверяем доступность"
  if (linkStatus.allBlocked) {
    console.log(`🚫 Товар "${gift.name}" (ID: ${gift.id}) - проверяем доступность`);
    return createCheckingAvailabilityCard(gift, options);
  }

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
  card.style.animationDelay = `${Math.random() * 0.3}s`;

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

  // Определяем URL изображения-заглушки для текущей категории
  const placeholderImageUrl =
    categoryPlaceholderImages[gift.category] || categoryPlaceholderImages.universal;

  // === ИЗМЕНЕНИЕ: Сортируем теги так, чтобы точное совпадение было первым ===
  const prepareRecipientTags = (tags) => {
    if (!Array.isArray(tags)) return [];
    const currentRecipient = window.currentSearchRecipient || '';
    let sortedTags = [...tags];
    if (currentRecipient) {
      const exactIndex = sortedTags.findIndex(
        (tag) => String(tag).toLowerCase() === currentRecipient.toLowerCase(),
      );
      if (exactIndex > -1) {
        const [exactTag] = sortedTags.splice(exactIndex, 1);
        sortedTags.unshift(exactTag);
      }
    }
    return sortedTags.slice(0, 4);
  };
  const displayTags = prepareRecipientTags(gift.recipientTags);

  // === Каркас карточки ===
  card.innerHTML = `
    <div class="gift-card-image" aria-hidden="true">
      <img src="${placeholderImageUrl}" alt="${gift.name || 'Изображение подарка'}" loading="lazy" decoding="async" referrerPolicy="no-referrer" fetchPriority="low" style="width:100%; height:auto; object-fit: cover;">
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

  // === Lazy image setup ===
  (function setupLazyImage() {
    try {
      const container = card.querySelector('.gift-card-image');
      if (!container) return;

      if (!gift.image || typeof gift.image !== 'string' || gift.image.trim() === '') {
        return;
      }

      const imgEl = container.querySelector('img');
      if (imgEl) {
        imgEl.src = gift.image;
        if (gift.imageWidth && gift.imageHeight) {
          imgEl.width = gift.imageWidth;
          imgEl.height = gift.imageHeight;
        }
      } else {
        container.innerHTML = '';
        const newImg = document.createElement('img');
        newImg.alt = gift.name || 'Изображение подарка';
        newImg.loading = 'lazy';
        newImg.decoding = 'async';
        newImg.referrerPolicy = 'no-referrer';
        newImg.fetchPriority = 'low';
        if (gift.imageWidth && gift.imageHeight) {
          newImg.width = gift.imageWidth;
          newImg.height = gift.imageHeight;
        }
        newImg.src = gift.image;
        container.appendChild(newImg);
      }
    } catch (e) {
      console.warn('[GiftCard] setupLazyImage error:', e);
    }
  })();

  const actions = card.querySelector('.gift-card-actions');

  // НОВАЯ ЛОГИКА: используем ПЕРВУЮ разрешённую ссылку из массива
  const partnerUrl = linkStatus.firstValidLink
    ? resolveGiftUrl
      ? resolveGiftUrl({ ...gift, link: linkStatus.firstValidLink })
      : linkStatus.firstValidLink
    : null;

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
    const interstitialUrl = (API_BASE || '') + `/api/go?t=${b64url ? b64url(url) : ''}`;
    actions.innerHTML = `
      <a class="gift-buy-btn"
         href="${interstitialUrl}"
         target="_blank"
         rel="noopener nofollow sponsored noreferrer"
         aria-label="Перейти к подарку на площадке">К подарку</a>
    `;
    const linkEl = actions.querySelector('.gift-buy-btn');
    linkEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const isPrimary = e.button === 0;
      const hasMods = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
      if (isPrimary && !hasMods) {
        e.preventDefault();
        showTransitionOverlay &&
          showTransitionOverlay('🎁 Переходим к подарку или выбору подарков...', 2000);
        openWithPreloader &&
          openWithPreloader(
            linkEl.href,
            '🎁 Переходим к подарку или выбору подарков...',
            'Можно посмотреть разные идеи!',
          );
      }
    });
    card.style.cursor = 'pointer';
    card.setAttribute('role', 'link');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Открыть товар: ${gift.name}`);
    card.addEventListener('click', (e) => {
      if (e.target && e.target.closest && e.target.closest('.gift-buy-btn')) return;
      showTransitionOverlay &&
        showTransitionOverlay('🎁 Переходим к подарку или выбору подарков...', 2000);
      openWithPreloader &&
        openWithPreloader(
          interstitialUrl,
          '🎁 Переходим к подарку или выбору подарков...',
          'Можно посмотреть разные идеи!',
        );
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showTransitionOverlay &&
          showTransitionOverlay('🎁 Переходим к подарку или выбору подарков...', 2000);
        openWithPreloader &&
          openWithPreloader(
            interstitialUrl,
            '🎁 Переходим к подарку или выбору подарков...',
            'Можно посмотреть разные идеи!',
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

// НОВАЯ ФУНКЦИЯ: создает карточку "проверяем доступность"
function createCheckingAvailabilityCard(gift, options) {
  const { translateCategory, formatPrice } = options || {};

  const card = document.createElement('div');
  card.className = 'gift-card gift-card--checking';
  card.style.animationDelay = `${Math.random() * 0.3}s`;

  // Добавляем data-атрибут для фильтрации
  card.setAttribute('data-availability', 'checking');

  // Определяем URL изображения-заглушки
  const placeholderImageUrl =
    categoryPlaceholderImages[gift.category] || categoryPlaceholderImages.universal;

  // Подготавливаем теги
  const prepareRecipientTags = (tags) => {
    if (!Array.isArray(tags)) return [];
    const currentRecipient = window.currentSearchRecipient || '';
    let sortedTags = [...tags];
    if (currentRecipient) {
      const exactIndex = sortedTags.findIndex(
        (tag) => String(tag).toLowerCase() === currentRecipient.toLowerCase(),
      );
      if (exactIndex > -1) {
        const [exactTag] = sortedTags.splice(exactIndex, 1);
        sortedTags.unshift(exactTag);
      }
    }
    return sortedTags.slice(0, 4);
  };
  const displayTags = prepareRecipientTags(gift.recipientTags);

  // Каркас карточки с кнопкой "Проверяем доступность"
  card.innerHTML = `
    <div class="gift-card-image" aria-hidden="true">
      <img src="${placeholderImageUrl}" alt="${gift.name || 'Изображение подарка'}" loading="lazy" decoding="async" referrerPolicy="no-referrer" fetchPriority="low" style="width:100%; height:auto; object-fit: cover; opacity: 0.7;">
    </div>
    <div class="gift-card-body">
      <h3 class="gift-card-title" style="opacity: 0.8;">${gift.name}</h3>
      <p class="gift-card-description" style="opacity: 0.7;">${gift.description || ''}</p>
      <div class="gift-card-price" style="opacity: 0.8;">${formatPrice ? formatPrice(gift.price) : gift.price}</div>
      <div class="gift-card-tags">
        ${displayTags.map((t) => `<span class="gift-tag" style="opacity: 0.7;">${t}</span>`).join('')}
      </div>
      <div class="gift-card-footer">
        <span class="age-range" style="opacity: 0.7;">${gift.ageRange?.[0] ?? 0}-${gift.ageRange?.[1] ?? 120} лет</span>
        <span class="category-badge" style="opacity: 0.7;">${translateCategory ? translateCategory(gift.category) : gift.category}</span>
      </div>
      <div class="gift-card-actions" style="margin-top:12px;">
        <button class="gift-buy-btn gift-buy-btn--checking" disabled aria-disabled="true">
          Проверяем доступность
        </button>
      </div>
    </div>
  `;

  // Добавляем обработчики для ховер-эффекта
  const button = card.querySelector('.gift-buy-btn--checking');

  card.addEventListener('mouseenter', () => {
    button.style.transform = 'scale(1.05)';
    button.style.fontWeight = '600';
    button.style.transition = 'all 0.3s ease';
  });

  card.addEventListener('mouseleave', () => {
    button.style.transform = 'scale(1)';
    button.style.fontWeight = '400';
    button.style.transition = 'all 0.3s ease';
  });

  return card;
}
