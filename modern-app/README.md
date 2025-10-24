# Modern App (модульная миграция)

- Шаг 1 (done): добавлен каркас src/ui, src/utils, app/main.js и public/.
- Шаг 2: вынести UI-функции (overlay, toasts, gift-card) в `src/ui/components/`.
- Шаг 3: вынести поиск/фильтрацию в `src/modules/search/` и `src/modules/gifts/`.
- Шаг 4: собрать `modern-app/pages/landing.html` на тех же стилях; переключить index.html.
- Шаг 5: включить PWA (SW), критический CSS, LCP-оптимизацию.
