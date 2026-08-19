// --- Настройки ---
const TABLE = 'monsters';

const threatMap = {
  'низкая': 'low',
  'средняя': 'medium',
  'высокая': 'high',
  'опасная': 'veryhigh',
  'смертельная': 'extreme'
};

const threatLabels = { low:'Низкая', medium:'Средняя', high:'Высокая', veryhigh:'Опасная', extreme:'Смертельная' };

const improvementLabels = { strength:'Сила', endurance:'Выносливость', health:'Здоровье', modernization:'Модернизации' };
const weaponTypeLabels = { melee:'Ближний бой', range:'Дальний бой', explosive:'Взрывное', staff:'Посохи' };

// --- UI elements ---
const listEl = document.getElementById('list');
const searchEl = document.getElementById('search');
const countEl = document.getElementById('count');
const bttEl = document.getElementById('btt');

// --- Tab state ---
let activeTab = 'monsters';

const tabs = {
  monsters:     { data: [], filter: 'all', search: '' },
  improvements: { data: [], filter: 'all', search: '' },
  weapons:      { data: [], filter: 'all', search: '' },
  drones:       { data: [], filter: 'all', search: '' },
  other:        { data: [], filter: 'all', search: '' },
  tips:         { data: [], filter: 'all', search: '' },
};

// --- Фильтры для каждого таба ---
const tabsFilters = {
  monsters: [
    { key:'all', label:'Все' },
    { key:'low', label:'Низкая', dot:'low' },
    { key:'medium', label:'Средняя', dot:'medium' },
    { key:'high', label:'Высокая', dot:'high' },
    { key:'veryhigh', label:'Опасная', dot:'veryhigh' },
    { key:'extreme', label:'Смертельная', dot:'extreme' },
  ],
  improvements: [
    { key:'all', label:'Все' },
    { key:'strength', label:'Сила' },
    { key:'endurance', label:'Выносливость' },
    { key:'health', label:'Здоровье' },
    { key:'modernization', label:'Модернизации' },
  ],
  weapons: [
    { key:'all', label:'Все' },
    { key:'melee', label:'Ближний бой' },
    { key:'range', label:'Дальний бой' },
    { key:'explosive', label:'Взрывное' },
    { key:'staff', label:'Посохи' },
  ],
  drones: [
    { key:'all', label:'Все' },
  ],
  other: [
    { key:'all', label:'Все' },
  ],
  tips: [
    { key:'all', label:'Все' },
  ],
};

// --- Таблицы для загрузки ---
const TABLES = {
  improvements: 'improvements',
  weapons: 'weapons',
  drones: 'drones',
  other: 'other',
};

// -----------------------------
// --- Простая обёртка кэша ---
// -----------------------------
function cacheKey(name) { return `repo_${name}_cache_v1`; }
function metaKey(name) { return `repo_${name}_meta_v1`; }

function nowMs() { return Date.now(); }
function safeParse(json) { try { return JSON.parse(json); } catch (e) { return null; } }

function getCachedData(name) {
  try {
    const raw = localStorage.getItem(cacheKey(name));
    const metaRaw = localStorage.getItem(metaKey(name));
    if (!raw) return null;
    const data = safeParse(raw);
    const meta = safeParse(metaRaw) || null;
    if (!Array.isArray(data)) return null;
    return { data, meta };
  } catch (e) {
    console.warn("Cache read failed:", e);
    return null;
  }
}

function setCachedData(name, arr, meta = {}) {
  try {
    localStorage.setItem(cacheKey(name), JSON.stringify(arr));
    localStorage.setItem(metaKey(name), JSON.stringify(meta));
  } catch (e) {
    console.warn("Cache write failed:", e);
  }
}

function clearCache(name) {
  try {
    localStorage.removeItem(cacheKey(name));
    localStorage.removeItem(metaKey(name));
  } catch (e) {
    console.warn("Cache clear failed:", e);
  }
}

function isCacheValid(meta = {}, envVersion = null, ttlMs = null) {
  if (!meta) return false;
  if (envVersion && meta.version && meta.version !== envVersion) return false;
  if (ttlMs && meta.fetchedAt && (nowMs() - meta.fetchedAt) > ttlMs) return false;
  return true;
}

// -----------------------------
// --- Загрузка из Supabase ---
// -----------------------------
async function fetchMonstersFromSupabase() {
  const { data, error } = await window.supabase
    .from(TABLE)
    .select(`
      id, slug, name, difficulty, hp, image_url,
      behavior, avoid, kill, interact, tips, immunity,
      extra, updated_at
    `)
    .order('id', { ascending: true });

  if (error) throw error;
  return data || [];
}

function normalizeRowsToMonsters(rows) {
  return (rows || []).map(row => {
    const rawDiff = (row.difficulty || '').toString().toLowerCase();
    const threat = threatMap[rawDiff] || 'low';
    return {
      id: row.id, slug: row.slug, name: row.name || row.slug,
      threat, hp: row.hp || '—', icon: '👾', img: row.image_url || '',
      behavior: row.behavior || '—', avoid: row.avoid || '—',
      destroy: row.kill || '—', interact: row.interact || '—',
      tricks: row.tips || '—', immunity: row.immunity || '—',
      raw: row
    };
  });
}

async function loadMonsters({ renderUI = true } = {}) {
  const envVersion = window.APP_ENV && window.APP_ENV.DATA_VERSION;
  const ttlMs = window.APP_ENV && window.APP_ENV.CACHE_TTL_MS;

  const cached = getCachedData('monsters');
  if (cached && Array.isArray(cached.data)) {
    tabs.monsters.data = cached.data;
    if (renderUI && activeTab === 'monsters') render();
  }

  let rows;
  try {
    rows = await fetchMonstersFromSupabase();
  } catch (err) {
    console.error("Failed to fetch monsters:", err);
    if (cached && cached.data) return cached.data;
    if (activeTab === 'monsters') listEl.innerHTML = `<div class="no-res">Ошибка загрузки данных</div>`;
    throw err;
  }

  const maxUpdatedAt = Math.max(...rows.map(r => new Date(r.updated_at).getTime()));

  const needFetch =
    !cached ||
    !isCacheValid(cached.meta, envVersion, ttlMs) ||
    (cached.meta.lastUpdated < maxUpdatedAt);

  if (!needFetch) return cached.data;

  const fresh = normalizeRowsToMonsters(rows);
  const meta = { version: envVersion || null, fetchedAt: nowMs(), lastUpdated: maxUpdatedAt };
  setCachedData('monsters', fresh, meta);

  tabs.monsters.data = fresh;
  if (renderUI && activeTab === 'monsters') render();

  return tabs.monsters.data;
}

// -----------------------------
// --- Загрузка данных из Supabase ---
// -----------------------------
async function fetchTableData(tableName) {
  const { data, error } = await window.supabase
    .from(tableName)
    .select('*')
    .order('id', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function loadGameData({ renderUI = true } = {}) {
  const envVersion = window.APP_ENV && window.APP_ENV.DATA_VERSION;
  const ttlMs = window.APP_ENV && window.APP_ENV.CACHE_TTL_MS;
  const tableNames = Object.values(TABLES);

  const results = await Promise.allSettled(
    tableNames.map(name => fetchTableData(name))
  );

  tableNames.forEach((name, i) => {
    const result = results[i];
    if (result.status === 'fulfilled') {
      const rows = result.value;
      const cached = getCachedData(name);

      const maxUpdatedAt = rows.length
        ? Math.max(...rows.map(r => new Date(r.updated_at).getTime()))
        : 0;

      const needUpdate =
        !cached ||
        !isCacheValid(cached.meta, envVersion, ttlMs) ||
        (cached.meta && cached.meta.lastUpdated < maxUpdatedAt);

      if (needUpdate) {
        const meta = { version: envVersion || null, fetchedAt: nowMs(), lastUpdated: maxUpdatedAt };
        setCachedData(name, rows, meta);
        tabs[name].data = rows;
      } else {
        tabs[name].data = cached.data;
      }
    } else {
      console.error(`Failed to load ${name}:`, result.reason);
      const cached = getCachedData(name);
      if (cached && cached.data) {
        tabs[name].data = cached.data;
      }
    }
  });

  if (renderUI) render();
}

// -----------------------------
// --- Рендер карточек ---
// -----------------------------
function renderMonstersCard(m, i) {
  const t = m.threat;
  const tLabel = threatLabels[t] || (m.raw && m.raw.difficulty) || '—';
  return `<div class="mc" data-idx="${i}">
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
        <div class="ds ds-behavior"><div class="ds-l">📌 Поведение</div><div class="ds-v">${m.behavior}</div></div>
        <div class="ds ds-avoid"><div class="ds-l">🛡️ Как избегать</div><div class="ds-v">${m.avoid}</div></div>
        <div class="ds ds-destroy"><div class="ds-l">⚔️ Как уничтожить</div><div class="ds-v">${m.destroy}</div></div>
        <div class="ds ds-interact"><div class="ds-l">🤝 Как взаимодействовать</div><div class="ds-v ${m.interact==='—'?'muted':''}">${m.interact}</div></div>
        <div class="ds ds-tricks"><div class="ds-l">💡 Хитрости и альтернативы</div><div class="ds-v ${m.tricks==='—'?'muted':''}">${m.tricks}</div></div>
        <div class="ds ds-immunity"><div class="ds-l">🚫 Иммунитет</div><div class="ds-v ${m.immunity==='—'?'muted':''}">${m.immunity}</div></div>
      </div>
    </div>
  </div>`;
}

function renderWeaponsCard(w, i) {
  const typeLabel = weaponTypeLabels[w.type] || w.type;
  const imgHtml = w.image_url ? `<img src="${w.image_url}" alt="${w.name}" class="mc-img" onerror="this.style.display='none'">` : '';
  return `<div class="mc mc-flat" data-idx="${i}">
    <div class="mc-h">
      <div class="mc-ico"><span class="mc-emoji">${w.icon}</span>${imgHtml}</div>
      <div class="mc-info">
        <div class="mc-name">${w.name}</div>
        <div class="mc-tags">
          <span class="tag tag-t">${typeLabel}</span>
          <span class="tag tag-hp">💥 ${w.damage}</span>
        </div>
      </div>
      <div class="mc-desc">📌 ${w.description}</div>
    </div>
    <div class="mc-body mc-body-open">
      <div class="mc-body-i">
        <div class="ds ds-tricks"><div class="ds-l">💡 Особенности</div><div class="ds-v">${w.features}</div></div>
      </div>
    </div>
  </div>`;
}

function renderImprovementsCard(u, i) {
  const catLabel = improvementLabels[u.category] || u.category;
  const imgHtml = u.image_url ? `<img src="${u.image_url}" alt="${u.name}" class="mc-img" onerror="this.style.display='none'">` : '';
  return `<div class="mc mc-flat" data-idx="${i}">
    <div class="mc-h">
      <div class="mc-ico"><span class="mc-emoji">${u.icon}</span>${imgHtml}</div>
      <div class="mc-info">
        <div class="mc-name">${u.name}</div>
        <div class="mc-tags">
          <span class="tag tag-t">${catLabel}</span>
          <span class="tag tag-hp">✨ ${u.bonus}</span>
        </div>
      </div>
      <div class="mc-desc">📌 ${u.description}</div>
    </div>
  </div>`;
}

function renderDronesCard(d, i) {
  const imgHtml = d.image_url ? `<img src="${d.image_url}" alt="${d.name}" class="mc-img" onerror="this.style.display='none'">` : '';
  return `<div class="mc mc-flat" data-idx="${i}">
    <div class="mc-h">
      <div class="mc-ico"><span class="mc-emoji">${d.icon}</span>${imgHtml}</div>
      <div class="mc-info">
        <div class="mc-name">${d.name}</div>
        <div class="mc-tags">
          <span class="tag tag-t">🤖 Дрон</span>
        </div>
      </div>
      <div class="mc-desc">📌 ${d.description}</div>
    </div>
    <div class="mc-body mc-body-open">
      <div class="mc-body-i">
        <div class="ds ds-tricks"><div class="ds-l">💡 Возможности</div><div class="ds-v">${d.abilities}</div></div>
      </div>
    </div>
  </div>`;
}

function renderOtherCard(o, i) {
  const imgHtml = o.image_url ? `<img src="${o.image_url}" alt="${o.name}" class="mc-img" onerror="this.style.display='none'">` : '';
  return `<div class="mc mc-flat" data-idx="${i}">
    <div class="mc-h">
      <div class="mc-ico"><span class="mc-emoji">${o.icon}</span>${imgHtml}</div>
      <div class="mc-info">
        <div class="mc-name">${o.name}</div>
        <div class="mc-tags">
          <span class="tag tag-t">${o.type}</span>
        </div>
      </div>
      <div class="mc-desc">📌 ${o.description}</div>
    </div>
  </div>`;
}

// -----------------------------
// --- Основной рендер ---
// -----------------------------
function render() {
  const tab = tabs[activeTab];
  const data = tab.data;
  const filter = tab.filter;
  const search = tab.search;

  if (activeTab === 'tips') {
    listEl.innerHTML = '<div class="no-res">Раздел в разработке... 💡</div>';
    countEl.textContent = '—';
    return;
  }

  const filtered = data.filter(item => {
    const fMatch = filter === 'all' || (item.threat || item.type || item.category) === filter;
    const sMatch = (item.name || '').toLowerCase().includes(search.toLowerCase());
    return fMatch && sMatch;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="no-res">Ничего не найдено 🔍</div>';
    countEl.textContent = '0';
    return;
  }

  countEl.textContent = filtered.length;

  let cardHtml = '';
  if (activeTab === 'monsters') {
    cardHtml = filtered.map((m, i) => renderMonstersCard(m, i)).join('');
  } else if (activeTab === 'improvements') {
    cardHtml = filtered.map((u, i) => renderImprovementsCard(u, i)).join('');
  } else if (activeTab === 'weapons') {
    cardHtml = filtered.map((w, i) => renderWeaponsCard(w, i)).join('');
  } else if (activeTab === 'drones') {
    cardHtml = filtered.map((d, i) => renderDronesCard(d, i)).join('');
  } else if (activeTab === 'other') {
    cardHtml = filtered.map((o, i) => renderOtherCard(o, i)).join('');
  }

  listEl.innerHTML = cardHtml;
}

// --- Рендер фильтров ---
function renderFilters() {
  const filters = tabsFilters[activeTab];
  const current = tabs[activeTab].filter;
  const filtersEl = document.getElementById('filters');

  filtersEl.innerHTML = filters.map(f => {
    const activeClass = f.key === current ? ' active' : '';
    const dotHtml = f.dot ? `<span class="dot dot-${f.dot}"></span>` : '';
    return `<button class="fbtn${activeClass}" data-f="${f.key}">${dotHtml}${f.label}</button>`;
  }).join('');
}

const tabPlaceholders = {
  monsters: 'Поиск монстра...',
  improvements: 'Поиск улучшения...',
  weapons: 'Поиск оружия...',
  drones: 'Поиск дрона...',
  other: 'Поиск...',
  tips: '',
};

// --- Переключение табов ---
function switchTab(tabKey) {
  if (activeTab === tabKey) return;
  activeTab = tabKey;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabKey);
  });

  searchEl.value = '';
  searchEl.placeholder = tabPlaceholders[tabKey] || 'Поиск...';
  tabs[tabKey].search = '';

  renderFilters();
  render();
}

// --- События ---
document.getElementById('tabs').addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  switchTab(btn.dataset.tab);
});

searchEl.addEventListener('input', e => {
  tabs[activeTab].search = e.target.value || '';
  render();
});

document.getElementById('filters').addEventListener('click', e => {
  const btn = e.target.closest('.fbtn');
  if (!btn) return;
  tabs[activeTab].filter = btn.dataset.f;
  renderFilters();
  render();
});

window.addEventListener('scroll', () => {
  bttEl.classList.toggle('show', window.scrollY > 400);
});

window.addEventListener('focus', () => {
  const ttlMs = window.APP_ENV && window.APP_ENV.CACHE_TTL_MS;
  const envVersion = window.APP_ENV && window.APP_ENV.DATA_VERSION;

  if (activeTab === 'monsters') {
    const cached = getCachedData('monsters');
    if (!cached || !isCacheValid(cached.meta, envVersion, ttlMs)) {
      loadMonsters({ renderUI: true }).catch(e => console.warn("Background refresh failed", e));
    }
  } else if (TABLES[activeTab]) {
    const cached = getCachedData(activeTab);
    if (!cached || !isCacheValid(cached.meta, envVersion, ttlMs)) {
      loadGameData({ renderUI: true }).catch(e => console.warn("Background refresh failed", e));
    }
  }
});

// --- Инициализация ---
document.addEventListener('DOMContentLoaded', () => {
  searchEl.placeholder = tabPlaceholders[activeTab] || 'Поиск...';
  renderFilters();
  render();

  loadGameData({ renderUI: true }).catch(e => {
    console.error("Game data load failed", e);
  });

  loadMonsters({ renderUI: true }).catch(e => {
    console.error("Initial load failed", e);
  });

  // --- Image overlay ---
  const imgOverlay = document.getElementById('imgOverlay');
  const imgOverlayImg = document.getElementById('imgOverlayImg');

  function openImg(src) {
    imgOverlayImg.src = src;
    imgOverlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeImg() {
    imgOverlay.classList.remove('show');
    imgOverlayImg.src = '';
    document.body.style.overflow = '';
  }

  listEl.addEventListener('click', e => {
    const img = e.target.closest('.mc-img');
    if (img && img.src) { openImg(img.src); return; }
    const card = e.target.closest('.mc');
    if (card && !card.classList.contains('mc-flat')) card.classList.toggle('open');
  });

  document.getElementById('imgOverlayClose').addEventListener('click', closeImg);

  imgOverlay.addEventListener('click', closeImg);
});
