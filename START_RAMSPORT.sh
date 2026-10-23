#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
APP_DIR="$ROOT_DIR/RAMspace_Base_UI"
URL="http://localhost:3000/login"

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js 20 or later is required. Install Node.js, then run this script again."
  exit 1
fi

if [ ! -f "$APP_DIR/package.json" ]; then
  echo "[ERROR] RAMspace_Base_UI/package.json was not found."
  exit 1
fi

cd "$APP_DIR"
echo "[1/3] Checking dependencies..."
if [ ! -f "node_modules/next/package.json" ]; then
  npm install
fi

if [ ! -f ".next/BUILD_ID" ] || [ "${RAMSPORT_REBUILD:-}" = "1" ]; then
  echo "[2/3] Building RAMSport..."
  npm run build
else
  echo "[2/3] Using the existing production build."
fi

mkdir -p ".next/standalone/.next/static"
cp -R ".next/static/." ".next/standalone/.next/static/"
if [ -d "public" ]; then
  mkdir -p ".next/standalone/public"
  cp -R "public/." ".next/standalone/public/"
fi

open_browser() {
  if command -v termux-open-url >/dev/null 2>&1; then termux-open-url "$URL"; return; fi
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1; return; fi
  if command -v open >/dev/null 2>&1; then open "$URL"; fi
}

(
  for _ in $(seq 1 120); do
    if command -v curl >/dev/null 2>&1 && curl --silent --fail --max-time 2 "$URL" >/dev/null; then
      open_browser
      exit 0
    fi
    sleep 0.5
  done
) &

echo "[3/3] Starting RAMSport at $URL"
echo "Press Ctrl+C to stop the server."
cd ".next/standalone"
PORT=3000 HOSTNAME=0.0.0.0 exec node server.js
