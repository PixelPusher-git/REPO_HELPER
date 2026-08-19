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

// --- Text formatting utils ---
function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function getRefCategory(cat) {
  if (cat === 'monster') return 'monster';
  if (cat === 'weapon') return 'weapon';
  return 'other';
}

// --- Name registry for text references ---
let nameRegistry = new Map();
let nameRegistryList = [];
let nameRegex = null;

function buildNameRegistry() {
  nameRegistry.clear();
  nameRegistryList = [];
  nameRegex = null;

  (tabs.monsters.data || []).forEach(m => {
    nameRegistry.set(m.name.toLowerCase(), { category:'monster', item:m });
  });
  (tabs.weapons.data || []).forEach(w => {
    const key = w.name.toLowerCase();
    if (!nameRegistry.has(key)) nameRegistry.set(key, { category:'weapon', item:w });
  });
  ['improvements','drones','other'].forEach(tk => {
    (tabs[tk].data || []).forEach(item => {
      const key = item.name.toLowerCase();
      if (!nameRegistry.has(key)) nameRegistry.set(key, { category:'other', item });
    });
  });

  nameRegistryList = Array.from(nameRegistry.entries()).sort((a,b) => b[0].length - a[0].length);
  if (nameRegistryList.length) {
    const pat = nameRegistryList.map(([n]) => escapeRegex(n)).join('|');
    nameRegex = new RegExp(`(?<!\\w)(${pat})(?!\\w)`, 'gi');
  }
}

function formatText(text) {
  if (!text || text === '—') return text || '';
  let r = escapeHtml(text);
  r = r.replace(/\n/g, '<br>');

  const nums = [];
  r = r.replace(/\b(\d+(?:\.\d+)?)%?(?!\w)/g, m => {
    const i = nums.length;
    nums.push(`<span class="num">${m}</span>`);
    return `\x00N${i}\x00`;
  });

  const refs = [];
  if (nameRegex) {
    nameRegex.lastIndex = 0;
    r = r.replace(nameRegex, m => {
      const info = nameRegistry.get(m.toLowerCase());
      if (!info) return m;
      const i = refs.length;
      refs.push(`<span class="ref-${getRefCategory(info.category)}" data-name="${escapeHtml(info.item.name)}">${m}</span>`);
      return `\x00R${i}\x00`;
    });
  }

  refs.forEach((h,i) => { r = r.replace(`\x00R${i}\x00`, h); });
  nums.forEach((h,i) => { r = r.replace(`\x00N${i}\x00`, h); });
  return r;
}

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
        <div class="ds ds-behavior"><div class="ds-l">📌 Поведение</div><div class="ds-v">${formatText(m.behavior)}</div></div>
        <div class="ds ds-avoid"><div class="ds-l">🛡️ Как избегать</div><div class="ds-v">${formatText(m.avoid)}</div></div>
        <div class="ds ds-destroy"><div class="ds-l">⚔️ Как уничтожить</div><div class="ds-v">${formatText(m.destroy)}</div></div>
        <div class="ds ds-interact"><div class="ds-l">🤝 Как взаимодействовать</div><div class="ds-v ${m.interact==='—'?'muted':''}">${formatText(m.interact)}</div></div>
        <div class="ds ds-tricks"><div class="ds-l">💡 Хитрости и альтернативы</div><div class="ds-v ${m.tricks==='—'?'muted':''}">${formatText(m.tricks)}</div></div>
        <div class="ds ds-immunity"><div class="ds-l">🚫 Иммунитет</div><div class="ds-v ${m.immunity==='—'?'muted':''}">${formatText(m.immunity)}</div></div>
      </div>
    </div>
  </div>`;
}

function renderWeaponsCard(w, i) {
  const typeLabel = weaponTypeLabels[w.type] || w.type;
  const imgHtml = w.image_url ? `<img src="${w.image_url}" alt="${w.name}" class="mc-img" onerror="this.style.display='none'">` : '';
  return `<div class="mc mc-flat" data-idx="${i}">
    <div class="mc-h">
      <div class="mc-left">
        <div class="mc-info">
          <div class="mc-name">${w.name}</div>
          <div class="mc-tags">
            <span class="tag tag-t">${typeLabel}</span>
            <span class="tag tag-hp">💥 ${w.damage}</span>
          </div>
        </div>
        <div class="mc-ico"><span class="mc-emoji">${w.icon}</span>${imgHtml}</div>
      </div>
      <div class="mc-desc">${formatText(w.features)}</div>
    </div>
    <div class="mc-body mc-body-open">
      <div class="mc-body-i">
        <div class="ds ds-behavior"><div class="ds-l">📌 Описание</div><div class="ds-v mc-desc-dim">${formatText(w.description)}</div></div>
      </div>
    </div>
  </div>`;
}

function renderImprovementsCard(u, i) {
  const catLabel = improvementLabels[u.category] || u.category;
  const imgHtml = u.image_url ? `<img src="${u.image_url}" alt="${u.name}" class="mc-img" onerror="this.style.display='none'">` : '';
  return `<div class="mc mc-flat" data-idx="${i}">
    <div class="mc-h">
      <div class="mc-left">
        <div class="mc-info">
          <div class="mc-name">${u.name}</div>
          <div class="mc-tags">
            <span class="tag tag-t">${catLabel}</span>
            <span class="tag tag-hp">✨ ${u.bonus}</span>
          </div>
        </div>
        <div class="mc-ico"><span class="mc-emoji">${u.icon}</span>${imgHtml}</div>
      </div>
      <div class="mc-desc">${formatText(u.description)}</div>
    </div>
  </div>`;
}

function renderDronesCard(d, i) {
  const imgHtml = d.image_url ? `<img src="${d.image_url}" alt="${d.name}" class="mc-img" onerror="this.style.display='none'">` : '';
  return `<div class="mc mc-flat" data-idx="${i}">
    <div class="mc-h">
      <div class="mc-left">
        <div class="mc-info">
          <div class="mc-name">${d.name}</div>
          <div class="mc-tags">
            <span class="tag tag-t">🤖 Дрон</span>
          </div>
        </div>
        <div class="mc-ico"><span class="mc-emoji">${d.icon}</span>${imgHtml}</div>
      </div>
      <div class="mc-desc">${formatText(d.abilities)}</div>
    </div>
    <div class="mc-body mc-body-open">
      <div class="mc-body-i">
        <div class="ds ds-behavior"><div class="ds-l">📌 Описание</div><div class="ds-v mc-desc-dim">${formatText(d.description)}</div></div>
      </div>
    </div>
  </div>`;
}

function renderOtherCard(o, i) {
  const imgHtml = o.image_url ? `<img src="${o.image_url}" alt="${o.name}" class="mc-img" onerror="this.style.display='none'">` : '';
  return `<div class="mc mc-flat" data-idx="${i}">
    <div class="mc-h">
      <div class="mc-left">
        <div class="mc-info">
          <div class="mc-name">${o.name}</div>
          <div class="mc-tags">
            <span class="tag tag-t">${o.type}</span>
          </div>
        </div>
        <div class="mc-ico"><span class="mc-emoji">${o.icon}</span>${imgHtml}</div>
      </div>
      <div class="mc-desc">${formatText(o.description)}</div>
    </div>
  </div>`;
}

// -----------------------------
// --- Основной рендер ---
// -----------------------------
function render() {
  buildNameRegistry();
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
    const ref = e.target.closest('[data-name]');
    if (ref && ref.dataset.name) { openCardPopup(ref.dataset.name); return; }
    const img = e.target.closest('.mc-img');
    if (img && img.src) { openImg(img.src); return; }
    const card = e.target.closest('.mc');
    if (card && !card.classList.contains('mc-flat')) card.classList.toggle('open');
  });

  document.getElementById('imgOverlayClose').addEventListener('click', closeImg);

  imgOverlay.addEventListener('click', closeImg);

  // --- Card popup ---
  const cardPopup = document.getElementById('cardPopup');
  const cardPopupInner = document.getElementById('cardPopupInner');

  function openCardPopup(name) {
    const info = nameRegistry.get(name.toLowerCase());
    if (!info) return;
    let html = '';
    const item = info.item;
    switch (info.category) {
      case 'monster':    html = renderMonstersCard(item, -1); break;
      case 'weapon':     html = renderWeaponsCard(item, -1); break;
      case 'improvement':html = renderImprovementsCard(item, -1); break;
      case 'drone':      html = renderDronesCard(item, -1); break;
      default:           html = renderOtherCard(item, -1); break;
    }
    cardPopupInner.innerHTML = html;
    cardPopup.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeCardPopup() {
    cardPopup.classList.remove('show');
    cardPopupInner.innerHTML = '';
    document.body.style.overflow = '';
  }

  document.getElementById('cardPopupClose').addEventListener('click', closeCardPopup);
  cardPopup.addEventListener('click', e => { if (e.target === cardPopup) closeCardPopup(); });

  cardPopupInner.addEventListener('click', e => {
    const ref = e.target.closest('[data-name]');
    if (ref && ref.dataset.name) { openCardPopup(ref.dataset.name); return; }
    const img = e.target.closest('.mc-img');
    if (img && img.src) { openImg(img.src); return; }
    const card = e.target.closest('.mc');
    if (card && !card.classList.contains('mc-flat')) card.classList.toggle('open');
  });
});
