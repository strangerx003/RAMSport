# RAMSport — How to Run

RAMSport is a single Next.js server for the web interface and API.

## Windows

1. Install Node.js LTS from <https://nodejs.org/>.
2. Double-click `START_RAMSPORT.bat` in this repository.
3. Leave the launcher window open. It builds the app, starts the server, and opens `http://localhost:3000/login` when ready.
4. Press `Ctrl+C` in the launcher window when you want to stop it.

After the first launch, the launcher reuses the successful production build for faster startup. Set `RAMSPORT_REBUILD=1` before launching if you need to force a rebuild after editing source files.

## Linux or macOS

```bash
bash START_RAMSPORT.sh
```

The script installs missing packages, builds the app, starts it, and opens the local URL where the platform supports a browser opener.

## Android Termux

```bash
pkg update -y
pkg install -y nodejs git
git clone https://github.com/strangerx003/RAMSport.git
cd RAMSport
bash RAMSport_Termux.sh
```

## Run checks

```bash
cd RAMspace_Base_UI
npm test
```
