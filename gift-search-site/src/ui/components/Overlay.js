// gift-search-site/src/ui/components/Overlay.js
// Компонент-виджет "вау-оверлея".
// - Переиспользует существующий #transitionOverlay, если он уже в DOM (index.html).
// - Либо создаёт его "лениво", если элемента нет (на будущее).
// - Экспортирует showTransitionOverlay(msg, autoHideMs) и hideTransitionOverlay().

const OVERLAY_ID = 'transitionOverlay';

function createOverlayDom() {
  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'overlay hide';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.setAttribute('aria-label', 'Переходим в магазин');

  overlay.innerHTML = `
    <div class="overlay-content">
      <div class="spinner" aria-hidden="true"></div>
      <p class="overlay-text">🎁 Подбираем лучший подарок для вас...</p>
    </div>
  `;

  document.body.appendChild(overlay);
  return overlay;
}

function getOverlayEl() {
  return document.getElementById(OVERLAY_ID) || createOverlayDom();
}

// Публичное API
export function showTransitionOverlay(
  msg = '🎁 Подбираем лучший подарок для вас...',
  autoHideMs = 1800,
) {
  const overlay = getOverlayEl();
  const textNode = overlay.querySelector('.overlay-text');
  if (textNode) textNode.textContent = msg;

  overlay.classList.remove('hide');
  overlay.classList.add('show');

  if (autoHideMs > 0) {
    window.setTimeout(() => {
      overlay.classList.remove('show');
      // синхронизируемся с CSS transition .6s
      window.setTimeout(() => overlay.classList.add('hide'), 600);
    }, autoHideMs);
  }
}

export function hideTransitionOverlay() {
  const overlay = getOverlayEl();
  overlay.classList.remove('show');
  overlay.classList.add('hide');
}
