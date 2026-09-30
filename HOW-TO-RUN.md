# RAMSport R01 - How to Run

Single server (Next.js frontend + API on one port). No Python needed.

> Quick links: **Live** — https://ramsport.vercel.app · **Docs** — [README.md](README.md)

## Windows (No Docker) — Easiest
1. Install Node.js LTS: https://nodejs.org/ (first time only)
2. Double-click **`RAMSport_Win.bat`**
3. Browser opens automatically at http://localhost:3000

### Or use the interactive launcher
Double-click **`RAMspace_Base_UI\start.bat`** and pick:
- `[1]` Production (build once + standalone server) — recommended
- `[2]` Development (hot reload via `next dev`)
- `[3]` Run checks (build + API/UI tests)

## Windows (Docker)
1. Install Docker Desktop: https://www.docker.com/products/docker-desktop/
2. Restart PC
3. Start Docker Desktop, wait for "Docker Desktop is running"
4. Double-click **`RAMSport_Docker.bat`**
5. Browser opens at http://localhost:3000

## Android (Termux)
1. Install Termux from F-Droid: https://f-droid.org/en/packages/com.termux/
2. Open Termux, run:
```bash
pkg update -y
pkg install -y nodejs git
git clone https://github.com/strangerx003/RAMSport.git
cd RAMSport
bash RAMSport_Termux.sh
```
3. Open browser at http://localhost:3000

## Manual Run
```bash
cd RAMspace_Base_UI
npm install
npm run build
npm run start
# then open http://localhost:3000
```

## Run Tests
```bash
# Windows
RUN_TESTS.bat

# Linux / macOS / Termux
bash run-tests.sh
```
