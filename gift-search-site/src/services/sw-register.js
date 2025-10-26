// gift-search-site/src/services/sw-register.js
// Регистрация Service Worker + мягкий авто-обновлятор и cache-busting по версии.

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // <-- ВСТАВЬ СЮДА> Обновляйте это значение при каждом изменении public/sw.js
  const SW_REG_VERSION = '2025-10-27-01'; // YYYY-MM-DD-XX

  window.addEventListener('load', () => {
    const swUrl = `/sw.js?v=${encodeURIComponent(SW_REG_VERSION)}`;

    navigator.serviceWorker
      .register(swUrl, { scope: '/' })
      .then((reg) => {
        console.log('[PWA] Service Worker зарегистрирован', reg.scope);

        // Мягкое авто-обновление: применяем новую версию без жёсткого reload
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                sw.postMessage({ type: 'SKIP_WAITING' });
                console.log('[PWA] Найдена новая версия SW, применяем без перезагрузки…');
              } else {
                console.log('[PWA] SW установлен впервые.');
              }
            }
          });
        });

        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('[PWA] Применена новая версия Service Worker.');
        });
      })
      .catch((err) => console.warn('[PWA] Не удалось зарегистрировать SW', err));
  });
}
