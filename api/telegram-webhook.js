// api/telegram-webhook.js
// Приёмник webhook Telegram на Vercel.
// Проблема: Telegram не может достучаться до functions.yandexcloud.net
// (Connection timed out). Vercel доступен, поэтому принимаем апдейты тут
// и пересылаем в YC-функцию бота, которая отвечает в Telegram сама.
// URL для setWebhook: https://gift-search-project.vercel.app/api/telegram-webhook

const YC_WEBHOOK_BACKEND =
  process.env.YC_WEBHOOK_BACKEND ||
  'https://functions.yandexcloud.net/d4ek5bfia3om8lg6c27t';

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }));
    return;
  }

  try {
    const bodyRaw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});

    const ycResp = await fetch(YC_WEBHOOK_BACKEND, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyRaw,
    });

    const text = await ycResp.text().catch(() => '');
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, backend_status: ycResp.status, backend: text.slice(0, 300) }));
  } catch (e) {
    res.statusCode = 200; // всегда 200, чтобы Telegram не ретраил, если бэкенд недоступен
    res.end(JSON.stringify({ ok: false, error: String(e) }));
  }
};