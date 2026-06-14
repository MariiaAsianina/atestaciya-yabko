#!/bin/bash
# Подвійний клік на цьому файлі оновлює дані атестації на сайті.
cd "$(dirname "$0")"

echo "=== Оновлення сайту атестації ==="
echo

# 1. Перевірити, що в data/ є рівно один .xlsx файл
XLSX_FILES=$(find data -maxdepth 1 -iname '*.xlsx' ! -name '~$*')
COUNT=$(echo "$XLSX_FILES" | grep -c . || true)

if [ "$COUNT" -ne 1 ]; then
  echo "ПОМИЛКА: у папці data/ має бути рівно один файл .xlsx, знайдено: $COUNT"
  echo "$XLSX_FILES"
  echo
  echo "Видаліть зайві/старі файли .xlsx з папки data/ і спробуйте ще раз."
  echo
  read -n 1 -s -r -p "Натисніть будь-яку клавішу для виходу..."
  exit 1
fi

echo "Знайдено файл: $XLSX_FILES"
echo

# 2. Запустити build для перевірки Excel-файлу
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
git add data/ data.js CHANGELOG.md

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
