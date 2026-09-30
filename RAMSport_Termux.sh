#!/data/data/com.termux/files/usr/bin/bash
# RAMSport - Termux Setup for Android
# Run: bash RAMSport_Termux.sh

clear
echo "============================================"
echo "   RAMSport"
echo "   Setup for Android Termux"
echo "============================================"
echo ""

# Move to repo root (this file's folder)
cd "$(dirname "$0")"

# Update packages
echo "[1/5] Updating packages..."
pkg update -y

# Install Node.js
echo "[2/5] Installing Node.js..."
pkg install -y nodejs

cd RAMspace_Base_UI

# Install dependencies on first run
if [ ! -d "node_modules" ]; then
  echo "[3/5] Installing dependencies (first run only)..."
  npm install
fi

# Production build on first run
if [ ! -d ".next" ]; then
  echo "[4/5] Building production bundle (first run only)..."
  npm run build
fi

# Get IP address
IP=$(hostname -I | awk '{print $1}')

echo "[5/5] Starting server..."
echo ""
echo "============================================"
echo "   RAMSport starting at:"
echo "   http://localhost:3000"
echo "   http://${IP}:3000  (from other devices)"
echo ""
echo "   Press CTRL+C to stop"
echo "============================================"
echo ""

# Production server on port 3000 - standalone, minimal load
PORT=3000 node .next/standalone/server.js
