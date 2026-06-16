#!/bin/bash
# Подвійний клік на цьому файлі оновлює дані атестації на сайті.
cd "$(dirname "$0")"

SHEET_ID="1_bxhv7d-ID9GqY5vYVgdknC1G8RJ4yike6ODDN_4KRY"
XLSX_URL="https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx"
XLSX_PATH="data/Атестація Літо 2026.xlsx"

echo "=== Оновлення сайту атестації ==="
echo

# 1. Завантажити актуальний Excel з Google Sheets
echo "Завантаження даних з Google Sheets..."
mkdir -p data
if ! curl -sL "$XLSX_URL" -o "$XLSX_PATH"; then
  echo
  echo "ПОМИЛКА: не вдалося завантажити файл (перевірте інтернет)."
  echo
  read -n 1 -s -r -p "Натисніть будь-яку клавішу для виходу..."
  exit 1
fi
echo "Файл завантажено."
echo

# 2. Встановити залежності та згенерувати data.js
echo "Генерація даних..."
python3 -m pip install --quiet openpyxl
if ! python3 tools/build_data.py "$XLSX_PATH"; then
  echo
  echo "ПОМИЛКА: не вдалося обробити Excel-файл (див. повідомлення вище)."
  echo
  read -n 1 -s -r -p "Натисніть будь-яку клавішу для виходу..."
  exit 1
fi
echo

# 3. Commit і push, якщо є зміни
git add data.js CHANGELOG.md

if git diff --cached --quiet; then
  echo "Змін немає — дані вже актуальні."
  echo
  read -n 1 -s -r -p "Натисніть будь-яку клавішу для виходу..."
  exit 0
fi

if ! git commit -m "Оновити дані атестації" -q; then
  echo
  echo "ПОМИЛКА: не вдалося створити commit."
  echo
  read -n 1 -s -r -p "Натисніть будь-яку клавішу для виходу..."
  exit 1
fi

if ! git push; then
  echo
  echo "ПОМИЛКА: не вдалося виконати git push."
  echo "Commit створено локально — відкрийте GitHub Desktop і натисніть Push origin."
  echo
  read -n 1 -s -r -p "Натисніть будь-яку клавішу для виходу..."
  exit 1
fi

echo
echo "Готово. Netlify оновить сайт за 1–2 хвилини."
echo
read -n 1 -s -r -p "Натисніть будь-яку клавішу для виходу..."
