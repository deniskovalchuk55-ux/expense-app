# Expense·Control — Notion edition

Особистий трекер витрат і доходів. Дані живуть у Notion, сайт на Vercel.

## Структура

```
/api/notion.js     ← serverless proxy (Vercel function)
/index.html        ← апка
/vercel.json       ← конфіг Vercel
/package.json      ← метадані
```

---

## Перед деплоєм

У Notion мають бути 5 баз, підключених до твоєї Integration:

1. **Витрати**: `Назва` (Title), `Сума` (Number), `Валюта` (Select: USD/UAH/PLN), `Дата` (Date), `Категорія` (Relation → Категорії витрат), `Опис` (Text)
2. **Доходи**: `Назва` (Title), `Сума` (Number), `Валюта` (Select: USD/UAH/PLN), `Дата` (Date), `Категорія` (Relation → Категорії доходів), `Опис` (Text)
3. **Категорії витрат**: `Назва` (Title)
4. **Категорії доходів**: `Назва` (Title)
5. **Регулярні**: `Назва` (Title), `Тип` (Select: витрата/дохід), `Сума` (Number), `Валюта` (Select), `Категорія витрати` (Relation → Категорії витрат), `Категорія доходу` (Relation → Категорії доходів), `Частота` (Select: щодня/щотижня/щомісяця), `Активна` (Checkbox), `Старт з` (Date)

⚠️ Назви колонок мають співпадати **дослівно**, з тими ж великими/маленькими літерами.

⚠️ Опції Select — теж з малих літер: `витрата`, `дохід`, `щодня`, `щотижня`, `щомісяця`.

---

## Деплой за 6 кроків

### 1. Залий код на GitHub

```
git init
git add .
git commit -m "init"
gh repo create expense-control --public --source=. --push
```

Або вручну через github.com → New repository → перетягни файли.

### 2. Відкрий https://vercel.com/new

Імпортуй свій GitHub-репозиторій `expense-control`.

### 3. Перед натисканням Deploy — додай Environment Variables

В розділі **Environment Variables** додай (по одному):

| Name | Value |
|---|---|
| `NOTION_TOKEN` | твій integration secret (`ntn_...` або `secret_...`) |
| `DB_EXPENSES` | id бази Витрати |
| `DB_INCOMES` | id бази Доходи |
| `DB_CAT_EXPENSES` | id бази Категорії витрат |
| `DB_CAT_INCOMES` | id бази Категорії доходів |
| `DB_REGULARS` | id бази Регулярні |

ID бази — це 32-символьна частина з URL: `notion.so/myworkspace/abc123def456...?v=xyz` → беремо `abc123def456...`.

### 4. Натисни Deploy

Через 30 секунд маєш URL типу `expense-control.vercel.app`.

### 5. Перевір proxy

Відкрий у браузері (DevTools → Console):

```javascript
fetch('/api/notion', {
  method: 'POST',
  headers: {'Content-Type':'application/json'},
  body: JSON.stringify({ action: 'schema', database: 'DB_EXPENSES' })
}).then(r => r.json()).then(console.log)
```

Має повернути JSON з описом бази витрат. Якщо помилка — перевір env vars і Connections в Notion.

### 6. Постав на iPhone

Safari → відкрий URL → Поділитися → На екран Домівка.

---

## Як працює

- Сайт викликає `POST /api/notion` з тілом типу `{action, database, ...}`.
- Проксі бере `NOTION_TOKEN` з env, додає до запиту і ходить у Notion.
- Браузер ніколи не бачить токен. CORS вирішений тим що проксі на тому ж домені.
- Локальний кеш у `localStorage` дає миттєве завантаження. Сервер дотягує свіже у фоні.

## Якщо щось не працює

**Помилка "object_not_found"** — Integration не підключена до бази. Відкрий базу → `···` → Connections → додай свою Integration.

**Помилка "validation_error" з кодом колонки** — назва колонки в Notion не співпадає з тим що очікує апка. Дивись точні назви у списку вище.

**Опції Select не знаходяться** — апка шукає `витрата` а в Notion ти створив `Витрата`. Це для Notion **різні** опції. Виправ регістр в Notion.

**Курси валют не вантажаться** — це окремо, працює напряму з НБУ. Якщо червона крапка біля курсу — тапни → "Оновити авто" або введи вручну.

## Локальна розробка

Не обовʼязково, але якщо треба:

```
npm i -g vercel
vercel dev
```

Запустить локально на `localhost:3000` з проксі і env-змінними (треба `vercel link` зробити перед цим, щоб підтягнулись env vars з твого проекту).
