#!/bin/bash
# Подвійний клік на цьому файлі оновлює дані атестації на сайті.
cd "$(dirname "$0")"

echo "=== Оновлення сайту атестації ==="
echo

# 0. Перевірити, чи налаштовано Firebase Storage
XLSX_IN_DATA=$(ls data/*.xlsx 2>/dev/null | head -1)

if [ -f firebase-config.sh ]; then
  source firebase-config.sh
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
elif [ -n "$XLSX_IN_DATA" ]; then
  echo "Firebase не налаштовано — використовується файл: $XLSX_IN_DATA"
  echo "(Щоб перейти на Firebase Storage, налаштуйте firebase-config.sh)"
  echo
  python3 -m pip install --quiet -r tools/requirements.txt
else
  echo "ПОМИЛКА: не знайдено Excel-файл."
  echo "Покладіть файл 'Атестація Літо 2026.xlsx' у папку data/"
  echo "або налаштуйте firebase-config.sh (інструкція в README.md)."
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
