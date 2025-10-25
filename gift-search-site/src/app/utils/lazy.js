// gift-search-site/src/app/utils/lazy.js
// Простая утилита: дождаться, когда элемент окажется в зоне видимости.
// Возвращает Promise, который резолвится ОДИН РАЗ при первом пересечении.

export function waitForVisible(targetEl, opts = {}) {
  return new Promise((resolve) => {
    if (!targetEl) return resolve(); // нет элемента — не блокируем рендер

    // Если элемент уже виден (например, высоким экраном), резолвим сразу
    const rect = targetEl.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top < vh && rect.bottom > 0) {
      resolve();
      return;
    }

    const options = {
      root: null,
      rootMargin: opts.rootMargin ?? '0px 0px 0px 0px',
      threshold: opts.threshold ?? 0.25, // 25% видимости
    };

    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          io.unobserve(entry.target);
          io.disconnect();
          resolve();
          break;
        }
      }
    }, options);

    io.observe(targetEl);
  });
}
