#!/bin/bash
# Netlify build: regenerate data.js from data/*.xlsx, then assemble publish/.
set -euo pipefail
cd "$(dirname "$0")/.."

python3 -m pip install --quiet -r tools/requirements.txt

XLSX=$(find data -maxdepth 1 -iname '*.xlsx' ! -name '~\$*' | sort | head -n1)
if [ -z "$XLSX" ]; then
  echo "No .xlsx file found in data/ — keeping existing data.js"
else
  echo "Building data.js from: $XLSX"
  python3 tools/build_data.py "$XLSX"
fi

rm -rf publish
mkdir -p publish
cp index.html styles.css app.js data.js publish/
echo "Build complete -> publish/"
