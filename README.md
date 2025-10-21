# Gift Search

## Структура
- `/gift-search-site` — сайт (index.html, styles.css, main.js)
- `/data` — данные (export const GIFTS = [...])

## Локально
Открой `gift-search-site/index.html` в браузере.

## Деплой на Vercel
- Project Root: репозиторий
- Output Directory: `gift-search-site`
- Framework: Other
- (опц.) vercel.json — заголовки для go.html

# site:

✅ npm run build — собирает проект в папку dist/.
    Успешная сборка → появляется папка dist/.
    Ошибки в коде → сборка падает с описанием (тогда не коммитим!).
✅ npm run preview — запускает локальный сервер с собранной версией (как на Vercel).
    Открой http://localhost:4173 — это точно то же, что будет на Vercel.
❌ Vercel CLI не нужен локально, если у тебя настроен автоматический деплой из GitHub (что у тебя и есть). 
Теперь твой workflow:
```bash
npm run build        # ← проверяешь сборку
npm run preview       # ← посмотреть работоспособность
git add .
git commit -m "..."
git push             # ← Vercel сам задеплоит
```
