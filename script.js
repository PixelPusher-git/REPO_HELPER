// script.js

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

let monsters = []; // данные из БД
let currentFilter = 'all';
let searchTerm = '';

const threatLabels = { low:'Низкая', medium:'Средняя', high:'Высокая', veryhigh:'Опасная', extreme:'Смертельная' };

// --- Загрузка данных из Supabase ---
async function fetchMonsters() {
  try {
    // выбираем нужные колонки; подставь имена колонок, которые у тебя в таблице
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
        extra
      `)
      .order('id', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      listEl.innerHTML = `<div class="no-res">Ошибка загрузки данных</div>`;
      return;
    }

    // Трансформируем строки в формат, который использует верстка
    monsters = (data || []).map(row => {
      // нормализуем уровень угрозы в ключи фильтра
      const rawDiff = (row.difficulty || '').toString().toLowerCase();
      const threat = threatMap[rawDiff] || 'low';

      return {
        id: row.id,
        slug: row.slug,
        name: row.name || row.slug,
        threat,
        hp: row.hp || '—',
        icon: '👾', // можно заменить на поле в БД или на emoji в extra
        img: row.image_url || '',
        behavior: row.behavior || '—',
        avoid: row.avoid || '—',
        destroy: row.kill || '—',
        interact: row.interact || '—',
        tricks: row.tips || '—',
        immunity: row.immunity || '—',
        raw: row // сохраняем оригинал на будущее
      };
    });

    render();
  } catch (err) {
    console.error(err);
    listEl.innerHTML = `<div class="no-res">Ошибка при запросе</div>`;
  }
}

// --- Рендер ---
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
    const tLabel = threatLabels[t] || m.raw.difficulty || '—';
    // безопасная вставка: мы предполагаем, что данные контролируемые; для production нужно экранировать
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

// --- Инициализация ---
document.addEventListener('DOMContentLoaded', () => {
  fetchMonsters();
});
