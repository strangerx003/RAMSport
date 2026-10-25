@echo off
setlocal
cd /d "%~dp0"

where node.exe >nul 2>nul
if errorlevel 1 (
  echo [RAMSport] Node.js is not installed or is not in PATH.
  echo Install Node.js LTS, then run this file again.
  pause
  exit /b 1
)

if not exist "node_modules\next\dist\bin\next" (
  echo [RAMSport] Installing locked dependencies...
  call npm.cmd ci
  if errorlevel 1 (
    echo [RAMSport] Dependency installation failed.
    pause
    exit /b 1
  )
)

echo [RAMSport] Starting http://localhost:3000/ ...
start "RAMSport Server" /min cmd.exe /c "npm.cmd run dev"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$url='http://localhost:3000/'; for($i=0;$i -lt 120;$i++){try{$response=Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 $url;if($response.StatusCode -ge 200){Start-Process $url;exit 0}}catch{};Start-Sleep -Milliseconds 500};exit 1"
if errorlevel 1 (
  echo [RAMSport] The server did not become ready. Check the RAMSport Server window.
  pause
  exit /b 1
)

exit /b 0
