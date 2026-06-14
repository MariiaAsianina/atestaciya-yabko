# Публікація сайту (статичний хостинг)

Цей проєкт — повністю статичний сайт: `index.html`, `styles.css`, `app.js`, `data.js`.
Дані атестації вбудовані прямо в `data.js` (base64), окремий сервер чи база даних не потрібні.
Усі шляхи між файлами відносні (`styles.css`, `data.js`, `app.js`), зовнішні бібліотеки
(XLSX, Chart.js) підвантажуються з CDN по `https://`. Все готово до публікації "як є".

## Структура файлів для публікації

```
/
├── index.html
├── styles.css
├── app.js
├── data.js                        (генерується з data/*.xlsx)
├── data/
│   └── Атестація Літо 2026.xlsx   (актуальний файл з даними атестації)
├── tools/
│   ├── build_data.py              (генерує data.js з Excel)
│   ├── netlify_build.sh           (build-команда для Netlify)
│   └── requirements.txt
├── netlify.toml                   (build command + publish dir для Netlify)
├── .gitignore
├── README.md
├── CHANGELOG.md
├── DEPLOY.md
└── .github/workflows/pages.yml   (автодеплой на GitHub Pages)
```

Для перегляду сайту достатньо 4 файлів (index.html, styles.css, app.js, data.js) —
решта файлів для зручності розробки/публікації й автоматичної генерації
даних і не впливають на роботу сайту напряму.

`publish/` — папка, яку генерує build-скрипт (`tools/netlify_build.sh`),
у git вона не зберігається (`.gitignore`).

---

## Варіант 1: GitHub Pages

### A. Автоматична публікація через GitHub Actions (рекомендовано)

У проєкті вже є готовий workflow `.github/workflows/pages.yml`, який автоматично
публікує сайт при кожному `git push` у гілку **`production`**.
Гілка `development` не публікується — там ведеться розробка.

1. Створіть репозиторій на GitHub і запуште всі гілки (`main`, `development`,
   `production`) — див. README.md → "Робота з Git" і "Гілки та релізи".
2. У репозиторії перейдіть у **Settings → Pages**.
3. У розділі **Source** оберіть **GitHub Actions** (не "Deploy from a branch").
4. Зробіть push у `production` — workflow запуститься автоматично
   (вкладка **Actions** покаже прогрес).
5. Через 1–2 хвилини сайт буде доступний за адресою:
   `https://<ваш-логін>.github.io/<репозиторій>/`

### B. Класичний спосіб (без Actions)

1. Створіть новий репозиторій на GitHub (наприклад, `jabko-atestacia`).
2. Завантажте туди файли `index.html`, `styles.css`, `app.js`, `data.js`
   (через веб-інтерфейс "Add file → Upload files" або через git):
   ```bash
   git init
   git add index.html styles.css app.js data.js
   git commit -m "Публікація сайту атестації"
   git branch -M main
   git remote add origin https://github.com/<ваш-логін>/<репозиторій>.git
   git push -u origin main
   ```
3. У репозиторії перейдіть у **Settings → Pages**.
4. У розділі **Source** оберіть гілку `main` і папку `/ (root)`, натисніть **Save**.
5. Через 1–2 хвилини сайт буде доступний за адресою:
   `https://<ваш-логін>.github.io/<репозиторій>/`

---

## Варіант 2: Netlify (рекомендовано — автоматичний build з GitHub)

Проєкт має готовий `netlify.toml`:
```toml
[build]
  command = "bash tools/netlify_build.sh"
  publish = "publish"
```
Build-команда сама встановлює `openpyxl`, генерує `data.js` з Excel-файлу
в `data/` і збирає `publish/` (index.html, styles.css, app.js, data.js).
Тобто **достатньо запушити зміни в GitHub — Netlify сам перегенерує дані й опублікує сайт**.

**Налаштування (один раз):**
1. Завантажте репозиторій на GitHub (якщо ще не зроблено) — див. README.md → "Робота з Git".
2. Зайдіть на [app.netlify.com](https://app.netlify.com) і увійдіть/зареєструйтесь.
3. **Add new site → Import an existing project** → підключіть GitHub-репозиторій.
4. Netlify сам прочитає `netlify.toml` (build command і publish dir підставляться автоматично).
   Якщо запитає вручну: Build command = `bash tools/netlify_build.sh`, Publish directory = `publish`.
5. Натисніть **Deploy site**. Netlify видасть посилання вигляду `https://<назва>.netlify.app`.

Після цього кожен `git push` (наприклад, у гілку `production`, якщо так
налаштовано "Production branch" у Netlify) автоматично запускає build і
оновлює сайт для всіх — див. розділ "Оновлення даних атестації" в README.md.

**Альтернатива — без git (drag & drop, разовий тест):**
1. Локально виконайте `bash tools/netlify_build.sh` — створиться папка `publish/`.
2. На [app.netlify.com/drop](https://app.netlify.com/drop) перетягніть папку `publish/`.
3. Цей спосіб не автооновлюється — для постійної роботи використовуйте підключення через GitHub (вище).

---

## Варіант 3: Vercel

1. Зайдіть на [vercel.com](https://vercel.com) і увійдіть/зареєструйтесь.
2. Натисніть **Add New → Project**.
3. Підключіть GitHub-репозиторій з файлами (як у Варіанті 1).
4. Framework Preset оберіть **Other**, Build command і Output directory залиште порожніми.
5. Натисніть **Deploy**. Vercel видасть посилання вигляду `https://<назва>.vercel.app`.

---

## Перевірка перед публікацією

- ✅ Сайт відкривається через `index.html`, підключає `styles.css`, `data.js`, `app.js`
  відносними шляхами — без `localhost` чи абсолютних шляхів.
- ✅ Сайт відкривається без логіну — дашборд (`#app-root`) видно одразу після
  завантаження даних, без форми входу чи будь-яких обмежень доступу.
- ✅ Дані атестації, фільтри, графіки (Chart.js) та експорт у CSV не змінювались.

---

## ⚠️ Перед публікацією: перевірте відсутність паролів та службових доступів

Сайт повністю відкритий — будь-хто з посиланням побачить усі дані атестації.
Перед тим, як зробити репозиторій публічним або опублікувати сайт, перевірте:

- у `app.js`, `index.html`, `data.js` немає захардкоджених паролів, токенів,
  ключів API чи інших службових доступів;
- у `README.md`, `CHANGELOG.md`, `DEPLOY.md`, `VERSION.md` немає згадок реальних
  логінів/паролів чи внутрішньої службової інформації;
- у `.git`-історії (попередні коміти) також немає випадково закомічених
  паролів — якщо є, такий комміт потрібно прибрати з історії перед публікацією.

Якщо дані атестації є конфіденційними і доступ має бути обмеженим, розгляньте
захист на рівні хостингу: Netlify/Vercel "Password Protection" (платні плани),
приватний репозиторій з GitHub Pages для приватних репо, або Cloudflare Access.
