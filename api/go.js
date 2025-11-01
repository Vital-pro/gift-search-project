// ОСНОВНОЙ ОБРАБОТЧИК (исправлен порядок объявления ulpParam)
module.exports = async (req, res) => {
  console.log('🎯 API/go ВЫЗВАН!');
  console.log('Query params:', req.query);

  // === ДОБАВЛЯЕМ ПОДРОБНОЕ ЛОГИРОВАНИЕ ===
  console.log('=== НАЧАЛО ОБРАБОТКИ API/GO ===');
  console.log('🕒 Время вызова:', new Date().toISOString());
  console.log('🔍 Query параметры:', JSON.stringify(req.query, null, 2));
  console.log('🌐 User Agent:', req.headers['user-agent']);
  console.log('📧 Referer:', req.headers['referer']);

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

  // === ДОБАВЛЯЕМ ЛОГИ ДЛЯ ULP ПРОВЕРКИ ===
  console.log('🔍 Проверяем ULP параметр...');

  // ВАЖНО: объявляем ПЕРЕД ИСПОЛЬЗОВАНИЕМ/ЛОГОМ
  const ulpParam = url.searchParams.get('ulp');
  console.log('📦 ULP из URL:', ulpParam);

  if (ulpParam) {
    const decodedUlp = safeDecodeURIComponent(ulpParam);
    console.log('ULP found:', decodedUlp);

    // === ДОБАВЛЯЕМ ЛОГИ ПЕРЕД ПРОВЕРКОЙ ===
    console.log('🎯 Начинаем проверку ULP...');
    console.log('🔗 ULP для проверки:', decodedUlp);

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

    // === ДОБАВЛЯЕМ ПОДРОБНЫЕ ЛОГИ РЕЗУЛЬТАТА ПРОВЕРКИ ===
    console.log('📊 РЕЗУЛЬТАТ ПРОВЕРКИ ULP:');
    console.log('  - dead:', probe.dead);
    console.log('  - reason:', probe.reason);
    console.log('  - status:', probe.status);
    console.log('  - host:', probe.host);
    console.log('  - timestamp:', new Date().toISOString());

    if (probe.dead) {
      console.log('Dead ULP detected');

      // === ДОБАВЛЯЕМ ЛОГ ПЕРЕД РЕДИРЕКТОМ ===
      console.log('🎯 ВЫПОЛНЯЕМ РЕДИРЕКТ НА OUT-OF-STOCK!');
      console.log('📍 Цель редиректа:', `/out-of-stock.html?shop=${probe.host || 'unknown'}`);

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

  // === ДОБАВЛЯЕМ ЛОГ ПЕРЕД ШТАТНЫМ РЕДИРЕКТОМ ===
  console.log('✅ ШТАТНЫЙ РЕДИРЕКТ НА ПАРТНЕРСКУЮ ССЫЛКУ');
  console.log('📍 Цель:', url.toString());
  console.log('=== ЗАВЕРШЕНИЕ ОБРАБОТКИ API/GO ===');

  res.statusCode = 302;
  res.setHeader('Location', url.toString());
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.end();
};
