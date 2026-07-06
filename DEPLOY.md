# Викладення на GitHub Pages

Проєкт — це **статичний сайт** (HTML + CSS + JS, без збірки). Усі шляхи відносні,
тож він працює і в підпапці на кшталт `https://ІМʼЯ.github.io/РЕПО/`.

## Що вже готово
- `favicon.svg` + мета-теги (theme-color, Open Graph, apple-mobile) у `index.html`.
- Кеш-версія ресурсів піднята до `?v=18` (щоб гравці отримали свіжі `iq.js`/`levels.js`).
- `.gitignore` виключає редакторне/кеш-сміття (`.idea/`, `.vscode/`, `.claude/`, `__pycache__/`).
- `.nojekyll` — GitHub Pages віддає файли як є, без обробки Jekyll.
- Старий бекап `B _ Clean modern.html` видалено.

## Крок за кроком

Виконуйте в папці проєкту (там, де `index.html`). Потрібні встановлений **git** і акаунт **GitHub**.

1. Ініціалізувати репозиторій і зробити перший коміт:
   ```bash
   git init
   git add .
   git commit -m "PuzzleBlast: initial site"
   ```
2. Створити **порожній** репозиторій на GitHub (без README), скопіювати його URL, тоді:
   ```bash
   git branch -M main
   git remote add origin https://github.com/ІМʼЯ/РЕПО.git
   git push -u origin main
   ```
3. На GitHub: **Settings → Pages**. У розділі *Build and deployment* виберіть
   **Source: Deploy from a branch**, гілка **main**, папка **/ (root)**, натисніть **Save**.
4. Зачекайте ~1 хв. Сайт зʼявиться за адресою:
   ```
   https://ІМʼЯ.github.io/РЕПО/
   ```

## Оновлення сайту надалі
- Внесли зміни → `git add . && git commit -m "..." && git push`. Pages оновиться автоматично.
- **Змінили `js/*` чи `app.css`?** Підніміть номер версії в `index.html`
  (`?v=18` → `?v=19` в усіх тегах `<script>` і в `<link>` на `app.css`), щоб браузери
  не показували стару закешовану версію.

## Примітки
- **`tools/generate_levels.py`** залишиться в репозиторії і буде публічно доступним
  (`.../РЕПО/tools/generate_levels.py`). Це безпечно — там немає секретів. Якщо хочете
  повністю прибрати його з сайту, публікуйте з окремої папки `docs/` (Pages → Source →
  папка `/docs`) або з гілки `gh-pages`, куди tools/ не потрапляє.
- **Зовнішні залежності:** Google Fonts і Tailwind (CDN) вантажаться з інтернету — сайт
  потребує з'єднання. Tailwind через CDN друкує попередження в консоль, але працює.
- **Прогрес гравця** (рівні IQ Blast, найкращий рахунок) зберігається в `localStorage`
  браузера — окремо для кожного домену/пристрою.
- **Свій домен** (необовʼязково): додайте файл `CNAME` з доменом і налаштуйте DNS —
  див. GitHub Pages → Custom domain.
