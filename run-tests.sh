#!/usr/bin/env bash
# RAMSport - API Test Suite (Termux / Linux)
# Run: bash run-tests.sh

cd "$(dirname "$0")/RAMspace_Base_UI" || exit 1

command -v node >/dev/null 2>&1 || { echo "[ERROR] node not found. Install nodejs first."; exit 1; }

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies - first run only..."
  npm install || exit 1
fi

if [ ! -f ".next/standalone/server.js" ]; then
  echo "Building production bundle..."
  npm run build || exit 1
fi

echo ""
echo "Running API tests against standalone server on port 3101..."
echo "--------------------------------------------"
npm run test:api
code=$?
echo "--------------------------------------------"

if [ $code -ne 0 ]; then
  echo ""
  echo "[RESULT] API TESTS FAILED - see FAIL lines above."
  exit 1
fi

echo ""
echo "Running UI tests against standalone server on port 3102..."
echo "--------------------------------------------"
npm run test:ui
code=$?
echo "--------------------------------------------"

if [ $code -ne 0 ]; then
  echo ""
  echo "[RESULT] UI TESTS FAILED - see FAIL lines above."
  exit 1
fi

echo ""
echo "[RESULT] ALL TESTS PASSED."
