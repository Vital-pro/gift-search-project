// api/go.js
// Серверный редирект (302) на Vercel с быстрым зондом целевого товара (ulp).
// Если зонд даёт 404/ошибку/таймаут — отправляем пользователя на /out-of-stock.html.

const AFF_HOSTS = new Set([
  'bywiola.com',
  'uuwgc.com',
  'qwpeg.com',
  'xpuvo.com',
  'admitad.com',
  'actionpay.net',
  'cityads.com',
  'effiliation.com',
  'advcake.com',
]);

function b64urlDecode(input) {
  try {
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(b64, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

// Быстрый HEAD-зонд с таймаутом (в мс). Возвращает { ok: boolean, status?: number, host?: string }
async function probeUlp(targetUrl, timeoutMs = 700) {
  try {
    const u = new URL(targetUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false };
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(targetUrl, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(t);
    // Многие магазины вернут 200/30x — считаем OK. 4xx/5xx — считаем мёртвым.
    return { ok: resp.status < 400, status: resp.status, host: u.hostname };
  } catch {
    return { ok: false };
  }
}

module.exports = async (req, res) => {
  const { t, to } = req.query || {};
  const raw =
    typeof to === 'string' ? to : typeof t === 'string' ? b64urlDecode(t) : '';

  let url;
  try {
    url = new URL(raw);
  } catch {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Bad request: invalid URL');
    return;
  }

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

  // Пытаемся достать ulp (финальный URL товара). Если есть — зондируем.
  let shopHost = '';
  const ulp = url.searchParams.get('ulp');
  if (ulp) {
    try {
      const decodedUlp = decodeURIComponent(ulp);
      const probe = await probeUlp(decodedUlp, 700);
      shopHost = probe.host || '';

      if (!probe.ok) {
        // Ведём на дружелюбную заглушку
        const shopParam = shopHost
          ? `?shop=${encodeURIComponent(shopHost)}`
          : '';
        res.statusCode = 302;
        res.setHeader('Location', `/out-of-stock.html${shopParam}`);
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        res.end();
        return;
      }
    } catch {
      // Если не смогли распарсить ulp — просто пойдём по обычному редиректу
    }
  }

  // Штатный 302 на партнёрскую ссылку
  res.statusCode = 302;
  res.setHeader('Location', url.toString());
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.end();
};
