# R.E.P.O. Helper — Контекст проекта

## Описание
Мобильный справочник по игре R.E.P.O. со вкладками: Монстры, Улучшения, Оружие, Дроны, Прочее, Советы.

## Supabase
- URL: https://noixytxiokaagwvtfbfd.supabase.co
- MCP: Remote (OAuth) — настроен в opencode.json
- Таблицы: `monsters`, `improvements`, `weapons`, `drones`, `other`

## Данные в БД
Данные загружены с вики https://repo-2025horror.fandom.com/wiki/Purchased_Items
- Названия предметов — на английском
- Описания — на русском
- Колонка `image_url` есть во всех таблицах (58 картинок с вики)
- `DATA_VERSION` в `env.js` = `"2.0.0"` (сброс кэша)

| Таблица | Записей | Описание |
|---|---|---|
| `monsters` | 29 | Монстры игры |
| `improvements` | 12 | Улучшения (Strength, Range, Stamina и т.д.) |
| `weapons` | 26 | Оружие (melee/range/explosive/staff) |
| `drones` | 5 | Дроны (подзарядка, неуязвимость, катание, перья, невесомость) |
| `other` | 15 | Прочее (аптечки, C.A.R.T., трекеры, транспорт и т.д.) |

## Готово
1. Таблицы `improvements`, `weapons`, `drones`, `other` созданы и заполнены реальными данными
2. script.js мигрирован — загрузка из Supabase через `loadGameData()`
3. Кэширование для всех таблиц по аналогии с monsters
4. `image_url` добавлены и заполнены во всех таблицах (58 картинок)
5. render-функции обновлены — показывают `<img>` с fallback на эмодзи
6. Вкладка "Советы" (tips) — заглушка "в разработке"

## Следующий шаг
- Реализовать вкладку "Советы" (tips) — добавить таблицу `tips` в Supabase и заполнить данными