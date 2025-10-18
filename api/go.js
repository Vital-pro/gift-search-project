// api/go.js
// Серверный редирект (302) на Vercel с осторожной проверкой ULP.
// ВАЖНО: считаем ссылку "мёртвой" ТОЛЬКО при явном 404/410.
// Любые 200/30x/403/405/timeout/ошибки -> пропускаем (fail-open).

const AFF_HOSTS = new Set([
  'bywiola.com',
  'uuwgc.com',
  'qwpeg.com',
  'xpuvo.com',
  'admitad.com',
  'actionpay.net',
  'cityads.com',
]);

function b64urlDecode(input) {
  try {
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(b64, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

// Безопасное двойное декодирование ULP (часто бывает дважды закодирован)
function safeDecodeURIComponent(s) {
  try {
    const once = decodeURIComponent(s);
    try {
      return decodeURIComponent(once);
    } catch {
      return once;
    }
  } catch {
    return s;
  }
}

// Быстрый запрос с таймаутом
async function timedFetch(url, opts = {}, timeoutMs = 600) {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...opts, signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(to);
  }
}

// Проверка ULP: возвращает { dead:boolean, host?:string, status?:number }
async function probeUlp(targetUrl) {
  try {
    const u = new URL(targetUrl);
    const host = u.hostname;
    // 1) Пробуем HEAD (быстро и дёшево)
    try {
      const r = await timedFetch(
        targetUrl,
        { method: 'HEAD', redirect: 'follow' },
        600
      );
      if (r.status === 404 || r.status === 410)
        return { dead: true, host, status: r.status };
      // Всё остальное (200/30x/403/405/500) -> НЕ считаем сразу мёртвым
      if (r.status !== 405 && r.status !== 403)
        return { dead: false, host, status: r.status };
      // для 403/405 делаем дополнительный короткий GET
    } catch {
      // упали на HEAD -> попробуем GET
    }

    // 2) Короткий GET (минимальный заголовок + follow)
    const r2 = await timedFetch(
      targetUrl,
      {
        method: 'GET',
        redirect: 'follow',
        headers: {
          // Нормальный UA, чтобы не нарваться на антибот
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      },
      700
    );
    if (r2.status === 404 || r2.status === 410)
      return { dead: true, host, status: r2.status };
    // Любой другой статус -> живой (даже 403/500 — не рискуем резать рабочие ссылки)
    return { dead: false, host, status: r2.status };
  } catch {
    // не смогли распарсить URL или иная ошибка — лучше пропустить
    return { dead: false };
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

  // Базовая валидация трекера
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

  // Пробуем извлечь ULP (финальный URL товара) и аккуратно проверить на явный 404/410
  const ulpParam = url.searchParams.get('ulp');
  if (ulpParam) {
    const decodedUlp = safeDecodeURIComponent(ulpParam);
    const probe = await probeUlp(decodedUlp);
    if (probe.dead) {
      // Покажем пользователю дружелюбную заглушку вместо "жёсткого" 404 магазина
      const shopParam = probe.host
        ? `?shop=${encodeURIComponent(probe.host)}`
        : '';
      res.statusCode = 302;
      res.setHeader('Location', `/out-of-stock.html${shopParam}`);
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      res.end();
      return;
    }
    // иначе — считаем ссылку живой и редиректим штатно
  }

  // Штатный 302 на партнёрскую ссылку
  res.statusCode = 302;
  res.setHeader('Location', url.toString());
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.end();
};
