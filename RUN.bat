@echo off
setlocal
title RAMSport
cd /d "%~dp0"

where node.exe >nul 2>nul
if errorlevel 1 (
  echo [RAMSport] Node.js was not found.
  echo [RAMSport] Install Node.js LTS from https://nodejs.org/ and double-click RUN.bat again.
  pause
  exit /b 1
)

if not exist "node_modules\next\dist\bin\next" (
  echo [RAMSport] First run - installing dependencies...
  call npm.cmd ci
  if errorlevel 1 (
    echo [RAMSport] Dependency installation failed. Check the network connection and try again.
    pause
    exit /b 1
  )
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if not errorlevel 1 (
  echo [RAMSport] RAMSport is already running. Opening http://localhost:3000/ ...
  start "" "http://localhost:3000/"
  exit /b 0
)

echo [RAMSport] Starting RAMSport at http://localhost:3000/ ...
start "RAMSport Server" /min cmd.exe /c "npm.cmd run dev -- -p 3000"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$url='http://localhost:3000/'; for($i=0;$i -lt 120;$i++){ try { if((Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 $url).StatusCode -ge 200) { Start-Process $url; exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }; exit 1"
if errorlevel 1 (
  echo [RAMSport] The server did not start. Open the RAMSport Server window to see the error.
  pause
  exit /b 1
)

exit /b 0
