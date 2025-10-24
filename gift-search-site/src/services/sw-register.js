// gift-search-site/src/services/sw-register.js
// [новое] Регистрация Service Worker вынесена из index.html в модуль.
// Никакой логики не меняем: регистрируем на событие 'load' со scope:'/'.

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[PWA] Service Worker зарегистрирован', reg.scope);
        // Опц.: принудительное обновление
        // navigator.serviceWorker.controller?.postMessage({ type: 'SKIP_WAITING' });
      })
      .catch((err) => console.warn('[PWA] Не удалось зарегистрировать SW', err));
  });
}
