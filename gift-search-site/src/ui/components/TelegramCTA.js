// gift-search-site/src/ui/components/TelegramCTA.js
// Чистый UI-компонент: принимает URL бота и возвращает DOM-узел.
// Без зависимости от глобальных переменных и DOM-структуры страницы.

export function createTelegramCTA(telegramBotUrl) {
  // [защита] если url не передали — рендерим "немую" кнопку, чтобы не падать
  const href =
    typeof telegramBotUrl === 'string' && telegramBotUrl.length
      ? `${telegramBotUrl}?start=catalog&utm_source=site&utm_medium=inline_cta&utm_campaign=giftbot`
      : '#';

  const ctaBlock = document.createElement('div');
  ctaBlock.className = 'telegram-cta-inline glass-effect';
  ctaBlock.innerHTML = `
    <div class="telegram-cta-content">
      <h3 class="telegram-cta-title">🤖 Подарочный помощник в твоём кармане</h3>
      <p class="telegram-cta-text">Наш чат-бот в Telegram подскажет идеи подарков за секунды — где бы ты ни был</p>
      <a href="${href}" class="telegram-cta-btn" ${href === '#' ? 'aria-disabled="true"' : ''}>
        <svg class="telegram-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121L8.32 13.617l-2.96-.924c-.64-.203-.658-.64.135-.953l11.566-4.458c.538-.196 1.006.128.832.941z"/>
        </svg>
        Перейти в Telegram-бота
      </a>
    </div>
    <div class="telegram-cta-decoration"><span class="decoration-icon">🎁</span></div>
  `;
  return ctaBlock;
}
