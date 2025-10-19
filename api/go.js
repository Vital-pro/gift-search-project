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

// === ПРОБНИК: HEAD → (если нужно) GET + эвристики ===
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
    } catch { /* таймаут/сеть — игнорируем */ }

    // 2) GET — если HEAD не показал dead
    let getResp;
    try {
      getResp = await fetchWithTimeout(ulpStr, { method: 'GET' }, 4500);
    } catch {
      // сетевые ошибки не считаем dead, чтобы не мешать пользователю
      return { dead: false, reason: 'probe-error', status: 0, host };
    }

    if ([404, 410].includes(getResp.status)) {
      return { dead: true, reason: 'http-dead', status: getResp.status, host };
    }

    const ct = getResp.headers.get('content-type') || '';
    if (/text\/html|application\/xhtml\+xml/i.test(ct)) {
      const html = await getResp.text(); // проще и стабильнее
      if (looksOutOfStockHTML(html)) {
        return { dead: true, reason: 'html-oos', status: getResp.status, host };
      }
    }

    // живой товар (или не-HTML) — пропускаем
    return { dead: false, reason: 'ok', status: getResp.status, host };
  } catch {
    return { dead: false, reason: 'probe-error', status: 0, host: null };
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
    headers: { Authorization: `Bearer ${token}` },
  });
  const t1 = await r1.text(); // например, ":1\r\n"
  const m = t1.match(/:(\d+)/); // берём число после двоеточия
  const count = m ? parseInt(m[1], 10) : Number.NaN;
  if (Number.isNaN(count)) return null;

  // EXPIRE 24h (GET) — только при первом срабатывании
  if (count === 1) {
    await fetch(`${url}/expire/${encodeURIComponent(key)}/86400`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  }
  return count;
}


// === Хелперы для детекта "нет в наличии" (суженная, без ложных срабатываний) ===

// Только СИЛЬНЫЕ русские признаки, которые обычно показываются пользователю
const STRONG_OOS_PATTERNS = [
  /товар\s*распродан/i,
  /нет\s+в\s+наличии/i,
  /временно\s+отсутствует/i,
  /закончился|закончились/i,
  /нет\s+в\s+продаже/i,
  /ожидаем\s+поставку|ожидается\s+поставка/i,
  /сообщить\s+о\s+поступлен/i,     // «Сообщить о поступлении»
  /уведомить\s+о\s+поступлен/i
];

// schema.org в JSON-LD или атрибутах
function looksOutOfStockJSONLD(html) {
  const head = html.slice(0, 300_000);
  const blocks = head.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (!blocks) return false;
  for (const b of blocks) {
    if (/https?:\/\/schema\.org\/(OutOfStock|PreOrder)/i.test(b)) return true;
    if (/"availability"\s*:\s*"(OutOfStock|PreOrder)"/i.test(b)) return true;
  }
  return false;
}

// Удаляем <script> и <style>, чтобы слова из JS/CSS не мешали
function stripScriptsAndStyles(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
}

function looksOutOfStockHTML(html) {
  const sampleRaw = html.slice(0, 300_000);
  const sample = stripScriptsAndStyles(sampleRaw);
  if (STRONG_OOS_PATTERNS.some(re => re.test(sample))) return true;
  if (looksOutOfStockJSONLD(sampleRaw)) return true; // JSON-LD ищем в «сырых» данных head
  return false;
}

// === Безопасный fetch с таймаутом (HEAD/GET) ===
async function fetchWithTimeout(url, opts = {}, ms = 4000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    const resp = await fetch(url, {
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; GiftBot-Probe/1.0)',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: ac.signal,
      ...opts
    });
    return resp;
  } finally {
    clearTimeout(timer);
  }
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
  await fetch(
    `${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  // EXPIRE (если нужен TTL)
  if (ttlSec) {
    await fetch(`${url}/expire/${encodeURIComponent(key)}/${ttlSec}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  }
  return true;
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[
        c
      ])
  );
}

// ====== Telegram-уведомление (возвращаем подробный результат) ======
// ===== ВСПОМОГАТЕЛЬНО: запись в Upstash для отладки (tglog:...) =====
async function upstashSet(key, value, ttlSec = null) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;
  await fetch(
    `${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (ttlSec) {
    await fetch(`${url}/expire/${encodeURIComponent(key)}/${ttlSec}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  }
  return true;
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[
        c
      ])
  );
}

// ====== Telegram-уведомление (с подробным результатом) ======
// ===== Сервисная запись в Upstash для отладки (tglog:...) =====
async function upstashSet(key, value, ttlSec = null) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;

  // SET (GET)
  await fetch(
    `${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  // EXPIRE (GET)
  if (ttlSec) {
    await fetch(`${url}/expire/${encodeURIComponent(key)}/${ttlSec}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  }
  return true;
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[
        c
      ])
  );
}

async function sendTelegram(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId)
    return { ok: false, status: null, body: 'missing env' };

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
  status = null
) {
  const hash = sha1(ulp);
  const key = `dead:${hash}`;
  const count = await incrWithTtl24h(key);
  if (!count) return;
  if (count > 2) return;

  const env = process.env.APP_ENV || 'production';
  const time = new Date().toISOString();

  const hostLine = shopHost ? `\n<b>Магазин:</b> ${escapeHtml(shopHost)}` : '';
  const statusLine = status ? `\n<b>HTTP:</b> ${status}` : '';
  const reasonLine = `\n<b>Причина:</b> ${escapeHtml(reason)}`;

  const msg =
    `<b>[${escapeHtml(
      env
    )}] Товар закончился</b>${hostLine}${statusLine}${reasonLine}\n` +
    `<b>ULP:</b> ${escapeHtml(ulp)}\n` +
    `<b>Срабатывание #</b>${count} за 24ч\n` +
    `<b>Время:</b> ${time}`;

  // Отправляем в Телеграм
  const tg = await sendTelegram(msg).catch((e) => ({
    ok: false,
    status: null,
    body: String(e),
  }));

  // ЛОГ В ЛЮБОМ СЛУЧАЕ (даже если Telegram вернул ошибку)
  const logKey = `tglog:${hash}:${count}`;
  const logVal = JSON.stringify({
    time,
    status: tg.status,
    ok: !!tg.ok,
    body: tg.body,
  });
  await upstashSet(logKey, logVal, 86400).catch(() => {});
  await upstashSet(`tglog:last:${hash}`, logVal, 86400).catch(() => {});
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
        await notifyIfNeededTelegram(ulp, probe.host, probe.reason, probe.status);
      } catch {}

      // Дружелюбная заглушка.
      // Возвращаем «красивый» путь и ВЫРУБАЕМ кэш, чтобы повторные переходы тоже
      // всегда шли на нашу заглушку (а не на закешированный ответ/404 магазина).
      const shopParam = probe.host
        ? `?shop=${encodeURIComponent(probe.host)}`
        : '';
      res.statusCode = 302;
      res.setHeader('Location', `/out-of-stock.html${shopParam}`);

      // Анти-кэш на всех уровнях (браузер, CDN)
      res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, max-age=0'
      );
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      // Без реферера для партнёров + не индексировать
      res.setHeader('Referrer-Policy', 'no-referrer');
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
