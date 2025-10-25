// gift-search-site/src/app/features/lazy-sections.js
// [ВОССТАНОВЛЕНО] Ленивая отрисовка секций как было в main.js

export function initLazySections() {
  const sections = document.querySelectorAll('.lazy-section');
  if (!sections.length) return;

  const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  sections.forEach((section) => observer.observe(section));
}
