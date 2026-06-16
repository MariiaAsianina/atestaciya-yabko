# Jabko — Атестація Літо 2026

Статичний веб-дашборд для аналізу результатів атестації співробітників:
дашборд із графіками, таблиці по командах/посадах, тести, КЯ, чати, вхідні
дзвінки, замовлення, КПІ, відгуки керівників та план проведення атестації.

## Структура проєкту

```
index.html   — головна сторінка (структура, підключення стилів і скриптів)
styles.css   — стилі інтерфейсу
app.js       — логіка: фільтри, таблиці, графіки (Chart.js), експорт CSV, імпорт .xlsx
data.js      — вбудовані дані атестації (стиснені base64) та план таймлайну,
               генерується автоматично з data/*.xlsx
data/        — (Excel-файл тут НЕ зберігається — він на Firebase Storage)
tools/       — скрипти генерації data.js та збірки для Netlify
netlify.toml — налаштування автоматичного build на Netlify
DEPLOY.md    — інструкція з публікації на GitHub Pages / Netlify / Vercel
CHANGELOG.md — історія змін проєкту
```

## Технології

- Чистий HTML/CSS/JavaScript (без збірки, без залежностей у вигляді npm-пакетів)
- [Chart.js 4.4.1](https://www.chartjs.org/) — графіки (підключається з CDN)
- [SheetJS (xlsx)](https://github.com/SheetJS/sheetjs) — імпорт/експорт Excel (підключається з CDN)

## Запуск локально

Сайт повністю статичний — для перегляду достатньо локального сервера
(відкриття `index.html` напряму через `file://` може блокувати деякі функції
браузера, тому рекомендується сервер).

### Варіант 1: Python
```bash
python3 -m http.server 8080
```
Потім відкрити у браузері: http://localhost:8080/index.html

### Варіант 2: Node.js (npx)
```bash
npx serve .
```

## Оновлення даних

Excel-файл зберігається **тільки на Firebase Storage** — не у папці `data/` і не
в git-репозиторії. Щоб оновити сайт, замініть файл у Firebase Storage, а тоді
запустіть оновлення одним із двох способів:

---

### Спосіб 1 — GitHub Actions (рекомендовано, без локального комп'ютера)

**Крок 1 — замінити Excel у Firebase Storage:**

1. Зайдіть на [console.firebase.google.com](https://console.firebase.google.com)
   → ваш проєкт → **Build → Storage → Files**.
2. Знайдіть файл `Атестація Літо 2026.xlsx`, натисніть ⋮ → **Delete**.
3. Натисніть **Upload file** і завантажте новий Excel. Ім'я файлу має
   залишатись незмінним: `Атестація Літо 2026.xlsx`.

**Крок 2 — запустити оновлення сайту:**

1. Відкрийте репозиторій на GitHub.
2. Перейдіть у вкладку **Actions** → **Оновити дані атестації**.
3. Натисніть **Run workflow** → **Run workflow** у спливаючому вікні.
4. GitHub скачає Excel з Firebase Storage, перегенерує `data.js` і запуше зміни.
   Netlify автоматично оновить сайт за 1–2 хвилини.

> Ніяких паролів вводити не потрібно — усі ключі збережені у GitHub Secrets.

---

### Спосіб 2 — `update_site.command` (з локального Mac)

**Крок 1 — замінити Excel у Firebase Storage** (так само, як у Способі 1, пп. 1–3).

**Крок 2 — двічі клацніть на `update_site.command`** у Finder. Відкриється
термінал, який:
- завантажить актуальний Excel з Firebase Storage;
- перегенерує `data.js`;
- зробить `git commit` і `git push`;
- якщо є помилка — покаже її і **нічого не відправить**.

Якщо все пройшло успішно, побачите: **"Готово. Netlify оновить сайт за 1–2 хвилини."**

> Якщо macOS заблокує файл при першому запуску — правою кнопкою на
> `update_site.command` → **Відкрити** → підтвердіть.

**Перед першим використанням (один раз):**

1. Налаштуйте Firebase Storage та отримайте JSON-ключ — інструкція нижче у
   розділі [Налаштування Firebase Storage](#налаштування-firebase-storage).
2. Скопіюйте шаблон:
   ```bash
   cp firebase-config.sh.example firebase-config.sh
   ```
3. Відкрийте `firebase-config.sh` і заповніть:
   - `FIREBASE_STORAGE_BUCKET` — наприклад `ваш-проєкт.appspot.com`
   - `FIREBASE_FILE_PATH` — зазвичай `Атестація Літо 2026.xlsx`
   - `FIREBASE_CREDENTIALS_FILE` — шлях до JSON-ключа (за замовчуванням
     `firebase-key.json` у корені проєкту)
4. Покладіть JSON-ключ у корінь проєкту як `firebase-key.json`.
   Нікому не передавайте — він у `.gitignore`.

---

### Налаштування Firebase Storage (один раз)

#### 1. Створити Firebase-проєкт

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
2. Введіть назву, вимкніть Google Analytics (за бажанням), натисніть **Create project**.

#### 2. Увімкнути Storage

1. Ліве меню → **Build → Storage** → **Get started**.
2. Оберіть регіон (наприклад, `europe-west3`) → **Done**.
3. Завантажте перший Excel: **Upload file** → `Атестація Літо 2026.xlsx`.

#### 3. Отримати JSON-ключ сервісного акаунту

1. ⚙️ → **Project settings** → вкладка **Service accounts**.
2. **Generate new private key** → **Generate key**.
3. Збережіть завантажений `.json` як `firebase-key.json` у корені проєкту
   (для `update_site.command`).

#### 4. Дізнатись назву bucket

Firebase Console → **Storage → Files** — вгорі адреса `gs://ваш-проєкт.appspot.com`.
Частина після `gs://` — це bucket.

#### 5. Додати секрети до GitHub (для GitHub Actions)

**Settings → Secrets and variables → Actions → New repository secret** — додайте три:

| Назва | Значення |
|---|---|
| `FIREBASE_STORAGE_BUCKET` | `ваш-проєкт.appspot.com` |
| `FIREBASE_FILE_PATH` | `Атестація Літо 2026.xlsx` |
| `FIREBASE_CREDENTIALS_JSON` | весь вміст файлу `firebase-key.json` (скопіюйте текст) |

---

### Кнопка «⬆ Попередній перегляд»

Дозволяє завантажити Excel **лише для перегляду у вашому браузері** — сайт
для інших не змінюється.

---

### Як перевірити сайт після оновлення

1. Зачекайте 1–2 хвилини.
2. Відкрийте https://atestaciya-yabko.netlify.app/ (Cmd+Shift+R для оновлення кешу).
3. Перевірте дату у верхній панелі ("Оновлено: ДД.ММ.РРРР ГГ:ХХ").
4. Прогрес збірки: [app.netlify.com](https://app.netlify.com) → **Deploys**.

## Публікація

Дивись [DEPLOY.md](DEPLOY.md) — покрокова інструкція для GitHub Pages, Netlify та Vercel.

## Гілки та релізи

Проєкт використовує дві основні гілки:

- **`development`** — тут виконуються всі поточні зміни.
- **`production`** — завжди містить стабільну версію сайту.
  Тільки з цієї гілки автоматично публікується GitHub Pages
  (workflow `.github/workflows/pages.yml`).

Кожна стабільна версія додатково позначається тегом релізу: `v1.0`, `v1.1`, `v1.2`, ...
Поточна версія вказана у [VERSION.md](VERSION.md) і відображається на сайті
в топбарі ("Версія vX.Y · оновлено ДД.ММ.РРРР"), а кнопка
**"📜 Історія змін"** відкриває останні записи з CHANGELOG.md.

### Перенесення змін з development у production

1. Переконайтесь, що `development` протестовано і працює:
   ```bash
   git checkout development
   git pull
   ```
2. Перейдіть у `production` і влийте зміни:
   ```bash
   git checkout production
   git pull
   git merge development
   ```
3. Оновіть [VERSION.md](VERSION.md) — номер версії та дату.
4. Закомітьте і запуште:
   ```bash
   git add -A
   git commit -m "Реліз vX.Y"
   git push
   ```
5. Створіть тег релізу і відправте його:
   ```bash
   git tag -a vX.Y -m "Опис релізу vX.Y"
   git push origin vX.Y
   ```
6. Push у `production` автоматично запустить публікацію на GitHub Pages.

### Відкат production до попереднього релізу

**Подивитись список релізів:**
```bash
git tag -l
```

**Відкотити production до конкретного релізу (наприклад, v1.1):**
```bash
git checkout production
git reset --hard v1.1
git push --force origin production
```

⚠️ `--force` перезаписує історію `production` на GitHub — використовуйте,
коли впевнені, що поточна версія production зламана і потрібно повернути
саме v1.1. Після цього GitHub Pages автоматично перепублікує сайт версії v1.1.

**Альтернатива без перезапису історії (безпечніше):** створити новий комміт,
який повертає файли до стану релізу:
```bash
git checkout production
git checkout v1.1 -- .
git add -A
git commit -m "Відкат до v1.1"
git push
```

## Автозапис CHANGELOG.md

У репозиторії налаштовано git-хук `.githooks/post-commit`, який після кожного
коміту автоматично дописує в `CHANGELOG.md` рядок із датою, автором та описом
коміту. Хук активується командою (виконується один раз на машині):
```bash
git config core.hooksPath .githooks
```
Записи виду `backup-YYYY-MM-DD-HH-MM` (службові резервні коміти) у CHANGELOG
не потрапляють.

## Робота з Git

### 1. Створити репозиторій на GitHub

1. Зайдіть на [github.com](https://github.com) → **New repository**.
2. Введіть назву (наприклад, `jabko-atestacia`), залиште "Public" або "Private".
3. **Не** додавайте README/.gitignore/license (у нас вони вже є) → **Create repository**.
4. GitHub покаже адресу репозиторію, наприклад:
   `https://github.com/<ваш-логін>/jabko-atestacia.git`

### 2. Підключити локальний проєкт

У папці проєкту (де вже зроблено `git init` і перший commit):

```bash
git remote add origin https://github.com/<ваш-логін>/jabko-atestacia.git
git branch -M main
git push -u origin main
```

### 3. Робити commit після кожної зміни

```bash
git add -A
git commit -m "Короткий опис зміни"
git push
```

- `git add -A` — додає всі змінені/нові файли.
- `git commit -m "..."` — фіксує зміни локально з повідомленням.
- `git push` — надсилає коміти на GitHub.

### 4. Переглянути історію змін

```bash
git log --oneline           # короткий список комітів
git log                      # детальна історія
git show <commit-hash>       # що змінилось у конкретному коміті
git diff                     # незакомічені зміни в робочій директорії
```

### 5. Повернутись до попередньої версії

**Подивитись файл зі старого коміту (без втрати поточних змін):**
```bash
git show <commit-hash>:index.html
```

**Повністю відкотити проєкт до конкретного коміту (обережно — перезапише файли):**
```bash
git checkout <commit-hash> -- .
git commit -m "Відкат до версії <commit-hash>"
```

**Скасувати останній commit, але зберегти зміни у файлах:**
```bash
git reset --soft HEAD~1
```

**Жорсткий відкат (видаляє незакомічені зміни — використовувати з обережністю):**
```bash
git reset --hard <commit-hash>
```

## Відновлення після помилки

Якщо щось зламалось і потрібно повернути робочу версію:

1. Подивіться список комітів і знайдіть останній робочий:
   ```bash
   git log --oneline
   ```
2. Скопіюйте файли з того коміту в поточну директорію:
   ```bash
   git checkout <commit-hash> -- index.html styles.css app.js data.js
   ```
3. Перевірте сайт локально (`python3 -m http.server 8080`).
4. Якщо все працює — закомітьте відновлення:
   ```bash
   git add -A
   git commit -m "Відновлення робочої версії з <commit-hash>"
   git push
   ```

Якщо проєкт вже опубліковано через GitHub Pages/Netlify — після `git push`
сайт оновиться автоматично протягом 1–2 хвилин.
