#!/data/data/com.termux/files/usr/bin/bash
set -e
cd "$(dirname "$0")"

echo "Installing the Node.js runtime if needed..."
pkg install -y nodejs
exec bash "./START_RAMSPORT.sh"
