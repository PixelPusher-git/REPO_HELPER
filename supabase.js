// supabase.js
const SUPABASE_URL = window.__env.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.__env.SUPABASE_ANON_KEY;

window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log("Supabase initialized:", !!window.supabase);

// main integration
async function fetchMonstersFromSupabase() {
  // Пример: используйте supabase-js или fetch к REST endpoint
  // Ниже — пример с fetch к Supabase REST (если вы не используете supabase-js)
  const url = `${window.APP_ENV.SUPABASE_URL}/rest/v1/monsters?select=*`;
  const res = await fetch(url, {
    headers: {
      apikey: window.APP_ENV.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${window.APP_ENV.SUPABASE_ANON_KEY}`
    }
  });
  if (!res.ok) {
    throw new Error(`Supabase fetch failed: ${res.status}`);
  }
  const data = await res.json();
  return data;
}

/** Основная функция загрузки монстров с кэшем */
async function loadMonsters({ render = true } = {}) {
  const envVersion = window.APP_ENV && window.APP_ENV.DATA_VERSION;
  const ttlMs = window.APP_ENV && window.APP_ENV.CACHE_TTL_MS;

  // 1) Попробовать получить кэш и рендерить его немедленно
  const cached = getCachedMonsters();
  if (cached && cached.monsters) {
    if (render) renderMonsters(cached.monsters);
  }

  // 2) Решаем, нужно ли обновлять
  const needFetch = !cached || !isCacheValid(cached.meta, envVersion, ttlMs);

  if (!needFetch) {
    // Кэш валиден — можно завершить
    return cached ? cached.monsters : [];
  }

  // 3) Асинхронно получить свежие данные и обновить кэш + UI
  try {
    const fresh = await fetchMonstersFromSupabase();

    // Простейшая валидация
    if (!Array.isArray(fresh)) throw new Error("Invalid data from Supabase");

    const meta = {
      version: envVersion || null,
      fetchedAt: nowMs()
    };

    setCachedMonsters(fresh, meta);

    // Если мы ранее рендерили устаревший кэш, обновляем UI
    if (render) renderMonsters(fresh);

    return fresh;
  } catch (err) {
    console.error("Failed to fetch monsters:", err);
    // Если fetch упал, но есть кэш — оставляем его; иначе пробрасываем ошибку
    if (cached && cached.monsters) return cached.monsters;
    throw err;
  }
}
