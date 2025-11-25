// api/go.js
// Серверный редирект (302) + осторожная проверка ULP + Telegram-уведомления

const crypto = require('crypto');

const AFF_HOSTS = new Set([
  'xpuvo.com', // Tefal
  'rthsu.com', // Moulinex
  'ujhjj.com', // Партнёрская сеть FloraExpress
  'www.floraxpress.ru', // Прямой магазин (добавить UTM)
  'kpwfp.com', // BoxDari / впечатления
  'bywiola.com', // Бубль Гум
  'yyczo.com', // mir-kubikov.ru
  'qwpeg.com', // Flor2U
  'dhwnh.com', // Aliexpress
  'gndrz.com', // Letual
  'kjuzv.com', // chitai-gorod.ru
  // 'kjuzv.com', //? dominopizza.ru и chitai-gorod.ru одинково?
  'ytebb.com', // Askona
  'ogsib.com', // СоюзЦветТорг
  'uuwgc.com', // МаксидоМ
  'naiawork.com', // pizzasushiwok.ru
]);

const PROBLEMATIC_REDIRECT_PATTERNS = ['offerwall.admitad.com'];

// ФИКС: Правильное декодирование base64 URL
function b64urlDecode(input) {
  try {
    // Добавляем padding если нужно
    let b64 = input.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) {
      b64 += '=';
    }
    return Buffer.from(b64, 'base64').toString('utf8');
  } catch (error) {
    console.log('Base64 decode error:', error.message);
    return '';
  }
}

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

// УНИФИЦИРОВАННАЯ функция fetch с таймаутом
async function fetchWithTimeout(url, opts = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; GiftBot-Probe/1.0)',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...opts.headers,
      },
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

// ПРОБНИК ULP
async function probeUlp(ulpStr) {
  try {
    const u = new URL(ulpStr);
    const host = u.hostname;

    // 1) HEAD — быстрый статус
    try {
      const head = await fetchWithTimeout(ulpStr, { method: 'HEAD' }, 2500);
      if ([404, 410].includes(head.status)) {
        return { dead: true, reason: 'http-dead', status: head.status, host };
      }
    } catch {
      // таймаут/ошибка сети — продолжаем к GET
    }

    // 2) GET — если HEAD не показал dead
    let getResp;
    try {
      getResp = await fetchWithTimeout(ulpStr, { method: 'GET' }, 4500);
    } catch {
      return { dead: false, reason: 'probe-error', status: 0, host };
    }

    if ([404, 410].includes(getResp.status)) {
      return { dead: true, reason: 'http-dead', status: getResp.status, host };
    }

    return { dead: false, reason: 'ok', status: getResp.status, host };
  } catch {
    return { dead: false, reason: 'probe-error', status: 0, host: null };
  }
}

// ПРОВЕРКА ПРОБЛЕМНЫХ РЕДИРЕКТОВ
async function checkProblematicRedirect(affiliateUrl, originalUlp) {
  try {
    const response = await fetchWithTimeout(
      affiliateUrl,
      {
        method: 'HEAD',
        redirect: 'follow',
      },
      5000,
    );

    const finalUrl = response.url;

    for (const pattern of PROBLEMATIC_REDIRECT_PATTERNS) {
      if (finalUrl.includes(pattern)) {
        return {
          isProblematic: true,
          pattern: pattern,
          finalUrl: finalUrl,
          originalUlp: originalUlp,
          affiliateHost: new URL(affiliateUrl).hostname,
        };
      }
    }

    return { isProblematic: false };
  } catch (error) {
    return { isProblematic: false };
  }
}

// Upstash Redis функции
function sha1(input) {
  return crypto.createHash('sha1').update(input).digest('hex');
}

async function incrWithTtl24h(key) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const r1 = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const t1 = await r1.text();
  const m = t1.match(/:(\d+)/);
  const count = m ? parseInt(m[1], 10) : Number.NaN;
  if (Number.isNaN(count)) return null;

  if (count === 1) {
    await fetch(`${url}/expire/${encodeURIComponent(key)}/86400`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  }
  return count;
}

// ЕДИНСТВЕННАЯ функция upstashSet
async function upstashSet(key, value, ttlSec = null) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;

  await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (ttlSec) {
    await fetch(`${url}/expire/${encodeURIComponent(key)}/${ttlSec}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  }
  return true;
}

// ЕДИНСТВЕННАЯ функция escapeHtml
function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

// Telegram функция
async function sendTelegram(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { ok: false, status: null, body: 'missing env' };

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: escapeHtml(message),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  const body = await resp.text();
  return { ok: resp.ok, status: resp.status, body };
}

async function notifyIfNeededTelegram(
  ulp,
  shopHost,
  reason = 'unknown',
  status = null,
  problematicRedirect = null,
) {
  const hash = sha1(ulp);
  const key = `dead:${hash}`;
  const count = await incrWithTtl24h(key);
  if (!count) return;
  if (count > 2) return;

  const env = process.env.APP_ENV || 'production';
  const time = new Date().toISOString();

  let message = '';

  if (problematicRedirect) {
    message =
      `🔄 <b>[${escapeHtml(env)}] Проблемный редирект Admitad</b>\n` +
      `┌ <b>Аффилейт:</b> ${escapeHtml(problematicRedirect.affiliateHost)}\n` +
      `├ <b>Магазин:</b> ${escapeHtml(shopHost || 'не указан')}\n` +
      `├ <b>Паттерн:</b> ${escapeHtml(problematicRedirect.pattern)}\n` +
      `├ <b>Тип:</b> Offerwall (CORS ошибки)\n` +
      `└ <b>Срабатывание #${count} за 24ч</b>\n\n` +
      `<b>Время:</b> ${time}\n` +
      `<b>ULP:</b> ${escapeHtml(ulp)}`;
  } else {
    const hostLine = shopHost ? `\n<b>Магазин:</b> ${escapeHtml(shopHost)}` : '';
    const statusLine = status ? `\n<b>HTTP:</b> ${status}` : '';
    const reasonLine = `\n<b>Причина:</b> ${escapeHtml(reason)}`;

    message =
      `<b>[${escapeHtml(env)}] Товар закончился</b>${hostLine}${statusLine}${reasonLine}\n` +
      `<b>ULP:</b> ${escapeHtml(ulp)}\n` +
      `<b>Срабатывание #${count} за 24ч</b>\n` +
      `<b>Время:</b> ${time}`;
  }

  const tg = await sendTelegram(message).catch((e) => ({
    ok: false,
    status: null,
    body: String(e),
  }));

  const logKey = `tglog:${hash}:${count}`;
  const logVal = JSON.stringify({
    time,
    status: tg.status,
    ok: !!tg.ok,
    body: tg.body,
    type: problematicRedirect ? 'problematic_redirect' : 'dead_link',
  });
  await upstashSet(logKey, logVal, 86400).catch(() => {});
  await upstashSet(`tglog:last:${hash}`, logVal, 86400).catch(() => {});
}

// ОСНОВНОЙ ОБРАБОТЧИК
module.exports = async (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  console.log('🎯 API/go ВЫЗВАН!');
  console.log('Query params:', req.query);

  const { t, to } = req.query || {};
  console.log('Parameter t:', t);
  console.log('Parameter to:', to);

  // ФИКС: Правильное извлечение raw URL
  let raw = '';
  if (typeof to === 'string') {
    raw = to;
  } else if (typeof t === 'string') {
    raw = b64urlDecode(t);
  }

  console.log('Decoded raw URL:', raw);

  if (!raw) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Bad request: missing URL parameter');
    return;
  }

  let url;
  try {
    url = new URL(raw);
  } catch (error) {
    console.log('URL parsing error:', error.message);
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Bad request: invalid URL');
    return;
  }

  // Базовая валидация
  const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
  if (!isHttp) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Bad request: protocol must be http/https');
    return;
  }

  if (!AFF_HOSTS.has(url.hostname)) {
    console.log('Domain not allowed:', url.hostname);
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Bad request: domain not allowed');
    return;
  }

  console.log('Valid affiliate URL:', url.toString());

  // Проверка ULP
  const ulpParam = url.searchParams.get('ulp');
  if (ulpParam) {
    const decodedUlp = safeDecodeURIComponent(ulpParam);
    console.log('ULP found:', decodedUlp);

    // 1. Проверка проблемных редиректов
    const redirectCheck = await checkProblematicRedirect(url.toString(), decodedUlp);
    if (redirectCheck.isProblematic) {
      console.log('Problematic redirect detected');
      try {
        await notifyIfNeededTelegram(
          decodedUlp,
          redirectCheck.originalUlp ? new URL(redirectCheck.originalUlp).hostname : null,
          'problematic_redirect',
          null,
          redirectCheck,
        );
      } catch (error) {
        console.log('Telegram notification error:', error);
      }

      const shopParam = redirectCheck.affiliateHost
        ? `?shop=${encodeURIComponent(redirectCheck.affiliateHost)}`
        : '';
      res.statusCode = 302;
      res.setHeader('Location', `/out-of-stock.html${shopParam}`);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.end();
      return;
    }

    // 2. Обычная проверка ULP
    const probe = await probeUlp(decodedUlp);
    console.log('ULP probe result:', probe);

    if (probe.dead) {
      console.log('Dead ULP detected');
      try {
        await notifyIfNeededTelegram(decodedUlp, probe.host, probe.reason, probe.status);
      } catch (error) {
        console.log('Telegram notification error:', error);
      }

      const shopParam = probe.host ? `?shop=${encodeURIComponent(probe.host)}` : '';
      res.statusCode = 302;
      res.setHeader('Location', `/out-of-stock.html${shopParam}`);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.end();
      return;
    }
  }

  // Штатный редирект
  console.log('Proceeding with normal redirect to:', url.toString());
  res.statusCode = 302;
  res.setHeader('Location', url.toString());
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.end();
};
