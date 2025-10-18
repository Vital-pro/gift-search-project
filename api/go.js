// api/go.js
// БАЗОВЫЙ серверный редирект (302) на Vercel.
// Читает ?t=<base64url(affiliateUrl)> или ?to=<plainUrl>, проверяет домен трекера и редиректит.
// Для новичка: это запускается на сервере Vercel по адресу https://<твойдомен>/api/go

// Разрешённые домены трекеров (белый список)
const AFF_HOSTS = new Set([
  'bywiola.com',
  'uuwgc.com',
  'qwpeg.com',
  'xpuvo.com',
  'admitad.com',
  'actionpay.net',
  'cityads.com',
  'effiliation.com',
]);

function b64urlDecode(input) {
  try {
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(b64, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

module.exports = (req, res) => {
  // 1) Читаем параметр t (base64url) или to (прямой URL)
  const { t, to } = req.query || {};
  const raw =
    typeof to === 'string' ? to : typeof t === 'string' ? b64urlDecode(t) : '';

  // 2) Пытаемся распарсить URL
  let url;
  try {
    url = new URL(raw);
  } catch {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Bad request: invalid URL');
    return;
  }

  // 3) Проверяем схему и домен
  const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
  if (!isHttp) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Bad request: protocol must be http/https');
    return;
  }
  if (!AFF_HOSTS.has(url.hostname)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Bad request: domain not allowed');
    return;
  }

  // (опц.) можно достать ulp и показать домен магазина в логах — пока пропустим

  // 4) Отдаём 302 на партнёрский URL
  res.statusCode = 302;
  res.setHeader('Location', url.toString());

  // Важные заголовки:
  res.setHeader('Referrer-Policy', 'no-referrer'); // магазин не видит адрес твоей страницы
  res.setHeader('Cache-Control', 'no-store'); // не кэшируем редирект
  res.setHeader('X-Robots-Tag', 'noindex, nofollow'); // не индексировать ботовыми системами

  res.end();
};
