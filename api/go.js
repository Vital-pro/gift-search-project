// api/go.js
// Серверный редирект (302) + осторожная проверка ULP + Telegram-уведомления
// не чаще 2 раз за 24 часа на каждый уникальный ULP (через Upstash Redis).
//
// Что считаем "мёртвым": ТОЛЬКО явный 404/410 от магазина (HEAD/GET). Всё остальное — пропускаем (fail-open).

const crypto = require('crypto');

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

// Проверка ULP: dead = true только при 404/410. Иначе — жив (fail-open).
async function probeUlp(targetUrl) {
  try {
    const u = new URL(targetUrl);
    const host = u.hostname;

    // HEAD
    try {
      const r = await timedFetch(
        targetUrl,
        { method: 'HEAD', redirect: 'follow' },
        600
      );
      if (r.status === 404 || r.status === 410)
        return { dead: true, host, status: r.status };
      if (r.status !== 405 && r.status !== 403)
        return { dead: false, host, status: r.status };
    } catch {
      /* попробуем GET */
    }

    // GET
    const r2 = await timedFetch(
      targetUrl,
      {
        method: 'GET',
        redirect: 'follow',
        headers: {
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
    return { dead: false, host, status: r2.status };
  } catch {
    return { dead: false };
  }
}

// ====== Лимитер через Upstash Redis (<=2 уведомления за 24ч) ======

function sha1(input) {
  return crypto.createHash('sha1').update(input).digest('hex');
}

// Upstash REST: используем GET и RESP-число вида ":1\r\n"
async function incrWithTtl24h(key) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  // INCR (GET)
  const r1 = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  const t1 = await r1.text();                 // например, ":1\r\n"
  const m = t1.match(/:(\d+)/);               // берём число после двоеточия
  const count = m ? parseInt(m[1], 10) : Number.NaN;
  if (Number.isNaN(count)) return null;

  // EXPIRE 24h (GET) — только при первом срабатывании
  if (count === 1) {
    await fetch(`${url}/expire/${encodeURIComponent(key)}/86400`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  }
  return count;
}

// ====== Telegram-уведомление ======

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[
        c
      ])
  );
}

// ====== Telegram-уведомление (с логами ошибок) ======
// ===== ВСПОМОГАТЕЛЬНО: запись в Upstash для отладки (новое) =====
async function upstashSet(key, value, ttlSec = null) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;
  // SET
  await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  // EXPIRE (если нужен TTL)
  if (ttlSec) {
    await fetch(`${url}/expire/${encodeURIComponent(key)}/${ttlSec}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
  }
  return true;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
  ));
}

// ====== Telegram-уведомление (возвращаем подробный результат) ======
// ===== ВСПОМОГАТЕЛЬНО: запись в Upstash для отладки (tglog:...) =====
async function upstashSet(key, value, ttlSec = null) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;
  await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (ttlSec) {
    await fetch(`${url}/expire/${encodeURIComponent(key)}/${ttlSec}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
  }
  return true;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
  ));
}

// ====== Telegram-уведомление (с подробным результатом) ======
// ===== Сервисная запись в Upstash для отладки (tglog:...) =====
async function upstashSet(key, value, ttlSec = null) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;

  // SET (GET)
  await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });

  // EXPIRE (GET)
  if (ttlSec) {
    await fetch(`${url}/expire/${encodeURIComponent(key)}/${ttlSec}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  }
  return true;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
  ));
}

async function sendTelegram(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { ok:false, status:null, body:'missing env' };

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: escapeHtml(message),
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  });
  const body = await resp.text();
  return { ok: resp.ok, status: resp.status, body };
}

async function notifyIfNeededTelegram(ulp, shopHost) {
  const hash = sha1(ulp);
  const key = `dead:${hash}`;
  const count = await incrWithTtl24h(key);
  if (!count) return;     // нет Redis — тихо выходим
  if (count > 2) return;  // лимит за 24ч

  const env = process.env.APP_ENV || 'production';
  const time = new Date().toISOString();
  const hostLine = shopHost ? `\n<b>Магазин:</b> ${escapeHtml(shopHost)}` : '';
  const msg =
    `<b>[${escapeHtml(env)}] Товар закончился</b>${hostLine}\n` +
    `<b>ULP:</b> ${escapeHtml(ulp)}\n` +
    `<b>Срабатывание #</b>${count} за 24ч\n` +
    `<b>Время:</b> ${time}`;

  // 1) Пытаемся отправить в Telegram
  const tg = await sendTelegram(msg);

  // 2) В любом случае — логируем ответ в Upstash, чтобы видеть причину
  const logKey = `tglog:${hash}:${count}`;
  const logVal = JSON.stringify({ time, status: tg.status, ok: !!tg.ok, body: tg.body });
  await upstashSet(logKey, logVal, 86400);
  await upstashSet(`tglog:last:${hash}`, logVal, 86400);
}


// ====== Основной обработчик ======

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

  // Базовая валидация партнёрского домена
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

  // Аккуратная проверка ULP
  const ulpParam = url.searchParams.get('ulp');
  if (ulpParam) {
    const decodedUlp = safeDecodeURIComponent(ulpParam);
    const probe = await probeUlp(decodedUlp);

    if (probe.dead) {
      // Телеграм-уведомление (лимит <= 2 за 24ч)
      try {
        await notifyIfNeededTelegram(decodedUlp, probe.host);
      } catch {}

      // Дружелюбная заглушка
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
  }

  // Штатный 302 на партнёрскую ссылку
  res.statusCode = 302;
  res.setHeader('Location', url.toString());
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.end();
};
