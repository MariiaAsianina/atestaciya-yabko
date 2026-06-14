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
├── data.js
├── .gitignore
├── README.md
├── CHANGELOG.md
├── DEPLOY.md
└── .github/workflows/pages.yml   (автодеплой на GitHub Pages)
```

Для перегляду сайту достатньо 4 файлів (index.html, styles.css, app.js, data.js) —
решта файлів (README, CHANGELOG, workflow) для зручності розробки/публікації
і не впливають на роботу сайту.

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

## Варіант 2: Netlify

**Спосіб A — без git (drag & drop):**
1. Зайдіть на [app.netlify.com](https://app.netlify.com) і увійдіть/зареєструйтесь.
2. На головній сторінці є зона "Drag and drop your site output folder here" —
   перетягніть туди папку з файлами `index.html`, `styles.css`, `app.js`, `data.js`.
3. Netlify автоматично опублікує сайт і видасть посилання вигляду
   `https://<назва>.netlify.app`.

**Спосіб B — через GitHub:**
1. Завантажте файли в репозиторій на GitHub (як у Варіанті 1, кроки 1–2).
2. На Netlify натисніть **Add new site → Import an existing project**.
3. Підключіть GitHub-репозиторій.
4. Build command залиште порожнім, Publish directory — `.` (корінь).
5. Натисніть **Deploy**.

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
