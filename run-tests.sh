#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/RAMspace_Base_UI"
command -v node >/dev/null 2>&1 || { echo "[ERROR] node not found. Install Node.js first."; exit 1; }

echo "Installing dependencies..."
npm install
echo "Building production bundle..."
npm run build
echo "Running API and UI tests..."
npm test
echo "[RESULT] ALL CHECKS PASSED."
