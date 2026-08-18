// --- Настройки ---
const TABLE = 'monsters'; // имя таблицы в Supabase

// Сопоставление русских уровней сложности к ключам фильтра
const threatMap = {
  'низкая': 'low',
  'средняя': 'medium',
  'высокая': 'high',
  'опасная': 'veryhigh',
  'смертельная': 'extreme'
};

// Локальные переменные UI
const listEl = document.getElementById('list');
const searchEl = document.getElementById('search');
const countEl = document.getElementById('count');
const bttEl = document.getElementById('btt');

let monsters = []; // данные из БД (и/или кэша)
let currentFilter = 'all';
let searchTerm = '';

const threatLabels = { low:'Низкая', medium:'Средняя', high:'Высокая', veryhigh:'Опасная', extreme:'Смертельная' };

// -----------------------------
// --- Простая обёртка кэша ---
// -----------------------------
const CACHE_KEY = "repo_monsters_cache_v1";
const META_KEY = "repo_monsters_meta_v1";

function nowMs() {
  return Date.now();
}

function safeParse(json) {
  try { return JSON.parse(json); } catch (e) { return null; }
}

/** Получить кэшированные данные: { monsters, meta } или null */
function getCachedMonsters() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const metaRaw = localStorage.getItem(META_KEY);
    if (!raw) return null;
    const data = safeParse(raw);
    const meta = safeParse(metaRaw) || null;
    if (!Array.isArray(data)) return null;
    return { monsters: data, meta };
  } catch (e) {
    // localStorage может быть недоступен — безопасно игнорируем
    console.warn("Cache read failed:", e);
    return null;
  }
}

/** Сохранить в кэш: monsters — массив, meta — объект { version, fetchedAt } */
function setCachedMonsters(monstersArr, meta = {}) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(monstersArr));
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch (e) {
    console.warn("Cache write failed:", e);
  }
}

/** Удалить кэш */
function clearMonstersCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(META_KEY);
  } catch (e) {
    console.warn("Cache clear failed:", e);
  }
}

/** Проверить валидность кэша:
 *  - если версии отличаются → false
 *  - если TTL истёк → false
 */
function isCacheValid(meta = {}, envVersion = null, ttlMs = null) {
  if (!meta) return false;
  if (envVersion && meta.version && meta.version !== envVersion) return false;
  if (ttlMs && meta.fetchedAt && (nowMs() - meta.fetchedAt) > ttlMs) return false;
  return true;
}

// -----------------------------
// --- Загрузка из Supabase ---
// -----------------------------
/** Низкоуровневый fetch из Supabase (использует window.supabase) */
async function fetchMonstersFromSupabase() {
  // Если вы используете supabase-js, window.supabase уже есть и можно использовать .from().select()
  // Здесь используем supabase-js API, как в вашем оригинальном коде.
  const { data, error } = await window.supabase
    .from(TABLE)
    .select(`
      id,
      slug,
      name,
      difficulty,
      hp,
      image_url,
      behavior,
      avoid,
      kill,
      interact,
      tips,
      immunity,
      extra,
      updated_at
    `)
    .order('id', { ascending: true });

  if (error) {
    throw error;
  }
  return data || [];
}

/** Трансформируем строки в формат, который использует верстка */
function normalizeRowsToMonsters(rows) {
  return (rows || []).map(row => {
    const rawDiff = (row.difficulty || '').toString().toLowerCase();
    const threat = threatMap[rawDiff] || 'low';

    return {
      id: row.id,
      slug: row.slug,
      name: row.name || row.slug,
      threat,
      hp: row.hp || '—',
      icon: '👾',
      img: row.image_url || '',
      behavior: row.behavior || '—',
      avoid: row.avoid || '—',
      destroy: row.kill || '—',
      interact: row.interact || '—',
      tricks: row.tips || '—',
      immunity: row.immunity || '—',
      raw: row
    };
  });
}

// ---------------------------------------------
// --- Основная функция загрузки с кэшированием ---
// ---------------------------------------------
/**
 * loadMonsters:
 *  - сначала пытается взять и отрендерить кэш (если есть),
 *  - затем решает, нужно ли обновлять (по версии DATA_VERSION и TTL),
 *  - если нужно — получает свежие данные, обновляет кэш и UI.
 *
 * Ожидает, что window.APP_ENV.DATA_VERSION и window.APP_ENV.CACHE_TTL_MS могут быть заданы в env.js.
 */
async function loadMonsters({ renderUI = true } = {}) {
  const envVersion = window.APP_ENV && window.APP_ENV.DATA_VERSION;
  const ttlMs = window.APP_ENV && window.APP_ENV.CACHE_TTL_MS;

  // 1) Попробовать получить кэш и рендерить его немедленно (stale-while-revalidate)
  const cached = getCachedMonsters();
  if (cached && Array.isArray(cached.monsters)) {
    monsters = cached.monsters;
    if (renderUI) render();
  }

  // 2) Получаем свежие данные из Supabase (но пока не сохраняем)
  let rows;
  try {
    rows = await fetchMonstersFromSupabase();
    console.log("ROWS FROM SUPABASE:", rows);
  } catch (err) {
    console.error("Failed to fetch monsters:", err);

    // Если fetch упал, но есть кэш — оставляем его
    if (cached && cached.monsters) {
      return cached.monsters;
    }

    // Если fetch упал и кэша нет — ошибка
    listEl.innerHTML = `<div class="no-res">Ошибка загрузки данных</div>`;
    throw err;
  }

  // 3) Вычисляем максимальный updated_at из свежих данных
  const maxUpdatedAt = Math.max(
    ...rows.map(r => new Date(r.updated_at).getTime())
  );
  console.log("maxUpdatedAt:", maxUpdatedAt);

  // 4) Решаем, нужно ли обновлять кэш
  const needFetch =
    !cached ||                                 // кэша нет
    !isCacheValid(cached.meta, envVersion, ttlMs) || // версия/TTL устарели
    (cached.meta.lastUpdated < maxUpdatedAt);  // данные в Supabase новее

    console.log("cached.meta.lastUpdated:", cached?.meta?.lastUpdated);
    console.log("needFetch:", needFetch);

  if (!needFetch) {
    // Кэш валиден — завершаем
    return cached.monsters;
  }

  // 5) Кэш устарел — обновляем
  const fresh = normalizeRowsToMonsters(rows);

  const meta = {
    version: envVersion || null,
    fetchedAt: nowMs(),
    lastUpdated: maxUpdatedAt
  };

  setCachedMonsters(fresh, meta);

  monsters = fresh;
  if (renderUI) render();

  return monsters;
}


// --- Рендер (оставил вашу логику, немного упрощённо) ---
function render() {
  const filtered = monsters.filter(m => {
    const fMatch = currentFilter === 'all' || m.threat === currentFilter;
    const sMatch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
    return fMatch && sMatch;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="no-res">Ничего не найдено 🔍</div>';
    countEl.textContent = '0';
    return;
  }

  countEl.textContent = filtered.length;

  listEl.innerHTML = filtered.map((m, i) => {
    const t = m.threat;
    const tLabel = threatLabels[t] || (m.raw && m.raw.difficulty) || '—';
    return `<div class="mc" data-idx="${i}" onclick="this.classList.toggle('open')">
      <div class="mc-h">
        <div class="mc-ico">
          <span class="mc-emoji">${m.icon}</span>
          <img src="${m.img}" alt="${m.name}" class="mc-img" onerror="this.style.display='none'">
        </div>
        <div class="mc-info">
          <div class="mc-name">${m.name}</div>
          <div class="mc-tags">
            <span class="tag tag-t"><span class="dot dot-${t}"></span>${tLabel}</span>
            <span class="tag tag-hp">❤️ ${m.hp}</span>
          </div>
        </div>
        <div class="mc-arrow">▼</div>
      </div>
      <div class="mc-body">
        <div class="mc-body-i">
          <div class="ds ds-behavior">
            <div class="ds-l">📌 Поведение</div>
            <div class="ds-v">${m.behavior}</div>
          </div>
          <div class="ds ds-avoid">
            <div class="ds-l">🛡️ Как избегать</div>
            <div class="ds-v">${m.avoid}</div>
          </div>
          <div class="ds ds-destroy">
            <div class="ds-l">⚔️ Как уничтожить</div>
            <div class="ds-v">${m.destroy}</div>
          </div>
          <div class="ds ds-interact">
            <div class="ds-l">🤝 Как взаимодействовать</div>
            <div class="ds-v ${m.interact==='—'?'muted':''}">${m.interact}</div>
          </div>
          <div class="ds ds-tricks">
            <div class="ds-l">💡 Хитрости и альтернативы</div>
            <div class="ds-v ${m.tricks==='—'?'muted':''}">${m.tricks}</div>
          </div>
          <div class="ds ds-immunity">
            <div class="ds-l">🚫 Иммунитет</div>
            <div class="ds-v ${m.immunity==='—'?'muted':''}">${m.immunity}</div>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// --- UI: поиск и фильтры ---
searchEl.addEventListener('input', e => {
  searchTerm = e.target.value || '';
  render();
});

document.getElementById('filters').addEventListener('click', e => {
  const btn = e.target.closest('.fbtn');
  if (!btn) return;
  document.querySelectorAll('.fbtn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentFilter = btn.dataset.f;
  render();
});

// Back to top visibility
window.addEventListener('scroll', () => {
  bttEl.classList.toggle('show', window.scrollY > 400);
});

// --- Дополнительно: обновление при фокусе (необязательно, но полезно) ---
window.addEventListener('focus', () => {
  // Проверяем TTL/версию и обновляем в фоне, не мешая UI
  const cached = getCachedMonsters();
  const ttlMs = window.APP_ENV && window.APP_ENV.CACHE_TTL_MS;
  if (!cached || !isCacheValid(cached.meta, window.APP_ENV && window.APP_ENV.DATA_VERSION, ttlMs)) {
    // не ждём результата
    loadMonsters({ renderUI: true }).catch(e => console.warn("Background refresh failed", e));
  }
});

// --- Инициализация ---
document.addEventListener('DOMContentLoaded', () => {
  // Загружаем: сначала кэш (если есть), затем при необходимости обновляем
  loadMonsters({ renderUI: true }).catch(e => {
    console.error("Initial load failed", e);
  });
});
