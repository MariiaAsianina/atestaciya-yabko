#!/bin/bash
# Подвійний клік на цьому файлі оновлює дані атестації на сайті.
cd "$(dirname "$0")"

echo "=== Оновлення сайту атестації ==="
echo

# 0. Завантажити налаштування доступу до Firebase Storage
if [ ! -f firebase-config.sh ]; then
  echo "ПОМИЛКА: не знайдено файл firebase-config.sh."
  echo "Скопіюйте firebase-config.sh.example у firebase-config.sh і заповніть"
  echo "своїми даними (інструкція в README.md)."
  echo
  read -n 1 -s -r -p "Натисніть будь-яку клавішу для виходу..."
  exit 1
fi
source firebase-config.sh

# 1. Встановити залежності та завантажити актуальний Excel з Firebase Storage
echo "Завантаження актуального файлу з Firebase Storage..."
python3 -m pip install --quiet -r tools/requirements.txt
if ! python3 tools/fetch_excel.py; then
  echo
  echo "ПОМИЛКА: не вдалося завантажити Excel-файл з Firebase Storage (див. повідомлення вище)."
  echo "Сайт НЕ оновлено, push не виконано."
  echo
  read -n 1 -s -r -p "Натисніть будь-яку клавішу для виходу..."
  exit 1
fi

echo

# 2. Запустити build для генерації даних
echo "Перевірка та генерація даних..."
if ! bash tools/netlify_build.sh; then
  echo
  echo "ПОМИЛКА: не вдалося згенерувати дані з Excel-файлу (див. повідомлення вище)."
  echo "Сайт НЕ оновлено, push не виконано."
  echo
  read -n 1 -s -r -p "Натисніть будь-яку клавішу для виходу..."
  exit 1
fi

echo

# 3. Commit і push, якщо є зміни
git add data.js CHANGELOG.md

if git diff --cached --quiet; then
  echo "Змін немає — дані вже актуальні, оновлення не потрібне."
  echo
  read -n 1 -s -r -p "Натисніть будь-яку клавішу для виходу..."
  exit 0
fi

if ! git commit -m "Оновити дані атестації" -q; then
  echo
  echo "ПОМИЛКА: не вдалося створити commit."
  echo "Сайт НЕ оновлено, push не виконано."
  echo
  read -n 1 -s -r -p "Натисніть будь-яку клавішу для виходу..."
  exit 1
fi

if ! git push; then
  echo
  echo "ПОМИЛКА: не вдалося виконати git push (перевірте інтернет/авторизацію GitHub)."
  echo "Commit створено локально, але на GitHub НЕ відправлено."
  echo
  read -n 1 -s -r -p "Натисніть будь-яку клавішу для виходу..."
  exit 1
fi

echo
echo "Готово. Netlify оновить сайт за 1–2 хвилини."
echo
read -n 1 -s -r -p "Натисніть будь-яку клавішу для виходу..."
