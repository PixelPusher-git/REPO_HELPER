# R.E.P.O. Helper — Контекст проекта

## Описание
Мобильный справочник по игре R.E.P.O. со вкладками: Монстры, Улучшения, Оружие, Дроны, Прочее, Советы.

## Supabase
- URL: https://noixytxiokaagwvtfbfd.supabase.co
- MCP: Remote (OAuth) — настроен в opencode.json
- Таблицы: `monsters`, `improvements`, `weapons`, `drones`, `other` — все созданы и заполнены

## Готово
1. Таблицы `improvements`, `weapons`, `drones`, `other` созданы в Supabase
2. Данные вставлены из script.js
3. script.js мигрирован — локальные массивы заменены на загрузку из Supabase через `loadGameData()`
4. Кэширование добавлено для всех таблиц (improvements/weapons/drones/other) по аналогии с monsters

## Следующий шаг
- Реализовать вкладку "Советы" (tips)