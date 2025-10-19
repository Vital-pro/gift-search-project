// api/diag-telegram.js
// Диагностический эндпоинт: шлёт тестовое сообщение в Telegram и возвращает сырой ответ Telegram.
// Вызов:  GET /api/diag-telegram?text=hello
// Требует: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (в Vercel env)

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[
        c
      ])
  );
}

module.exports = async (req, res) => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          ok: false,
          error: 'Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID',
        })
      );
      return;
    }

    const text = req.query?.text
      ? String(req.query.text)
      : 'diag: hello from /api/diag-telegram';
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: escapeHtml(text),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const body = await resp.text();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        request: { chatId, text },
        response: { status: resp.status, body },
      })
    );
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: String(e) }));
  }
};
