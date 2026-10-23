@echo off
setlocal
title RAMSport - Local Server
color 0B

cd /d "%~dp0"

echo.
echo  ========================================================
echo     RAMSport - Local Application Launcher
echo  ========================================================
echo.

if not exist "RAMspace_Base_UI\package.json" (
    color 0C
    echo  [ERROR] Application files were not found.
    echo  Expected: %~dp0RAMspace_Base_UI\package.json
    echo.
    pause
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    color 0C
    echo  [ERROR] Node.js is not installed or is not in PATH.
    echo  Install the current Node.js LTS release, then run this file again.
    echo  https://nodejs.org/
    echo.
    pause
    exit /b 1
)

where npm.cmd >nul 2>&1
if errorlevel 1 (
    color 0C
    echo  [ERROR] npm was not found. Reinstall Node.js with npm enabled.
    echo.
    pause
    exit /b 1
)

cd /d "%~dp0RAMspace_Base_UI"

echo  [1/3] Checking dependencies...
if not exist "node_modules\next\package.json" (
    echo        Installing application packages. This may take a few minutes...
    call npm.cmd install
    if errorlevel 1 goto install_error
) else (
    echo        Dependencies are available.
)

set "NEEDS_BUILD=0"
if defined RAMSPORT_REBUILD set "NEEDS_BUILD=1"
if not exist ".next\BUILD_ID" set "NEEDS_BUILD=1"
if exist ".next\BUILD_ID" (
    powershell.exe -NoProfile -Command "$build = (Get-Item '.next\BUILD_ID').LastWriteTimeUtc; $newer = Get-ChildItem 'app','components','lib' -Recurse -File | Where-Object { $_.LastWriteTimeUtc -gt $build }; if ($newer) { exit 1 } else { exit 0 }" >nul 2>&1
    if errorlevel 1 set "NEEDS_BUILD=1"
)

REM Reuse a current server, but replace it when application source has changed.
powershell.exe -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000/login' -TimeoutSec 2; $build = (Get-Content '.next\BUILD_ID' -Raw).Trim(); if ($r.StatusCode -eq 200 -and $r.Content -match 'RAMSport' -and $r.Content -match [regex]::Escape($build)) { exit 0 } } catch {}; exit 1" >nul 2>&1
if not errorlevel 1 (
    if "%NEEDS_BUILD%"=="0" (
        REM Keep the running standalone server's browser assets synchronized.
        if not exist ".next\standalone\.next" mkdir ".next\standalone\.next"
        xcopy ".next\static" ".next\standalone\.next\static" /E /I /Y /Q >nul
        if exist "public" xcopy "public" ".next\standalone\public" /E /I /Y /Q >nul
        echo.
        echo  [READY] RAMSport is already running.
        powershell.exe -NoProfile -Command "Start-Process explorer.exe 'http://localhost:3000/login?refresh=%RANDOM%'"
        exit /b 0
    )
    echo        Stopping the previous RAMSport server to apply updates...
    powershell.exe -NoProfile -Command "$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($listener) { Stop-Process -Id $listener.OwningProcess -Force }" >nul 2>&1
    timeout /t 1 /nobreak >nul
)

REM A listener that failed the build check is an older RAMSport process.
powershell.exe -NoProfile -Command "$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($listener) { Stop-Process -Id $listener.OwningProcess -Force }" >nul 2>&1
timeout /t 1 /nobreak >nul

if "%NEEDS_BUILD%"=="1" goto build_app
echo.
echo  [2/3] Using the existing production build.
goto prepare_standalone

:build_app
echo.
echo  [2/3] Building the current application...
call npm.cmd run build
if errorlevel 1 goto build_error

:prepare_standalone

REM Next.js standalone builds do not copy browser assets automatically.
REM Mirror them into the runnable bundle so styles and scripts load correctly.
if not exist ".next\standalone\.next" mkdir ".next\standalone\.next"
xcopy ".next\static" ".next\standalone\.next\static" /E /I /Y /Q >nul
if errorlevel 1 goto build_error
if exist "public" xcopy "public" ".next\standalone\public" /E /I /Y /Q >nul

echo.
echo  [3/3] Starting the local server...
echo.
echo  ========================================================
echo     RAMSport: http://localhost:3000/login
echo     The browser will open when the server is ready.
echo     Press CTRL+C in this window to stop RAMSport.
echo  ========================================================
echo.

REM Wait until Next.js is ready before opening the browser.
if not defined RAMSPORT_NO_BROWSER start "" /b powershell.exe -NoProfile -WindowStyle Hidden -Command "$url = 'http://localhost:3000/login'; for ($i = 0; $i -lt 120; $i++) { try { $r = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2; if ($r.StatusCode -eq 200) { Start-Process explorer.exe $url; exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }; exit 1"

set "NODE_ENV=production"
set "PORT=3000"
set "HOSTNAME=0.0.0.0"
pushd ".next\standalone"
node server.js
set "SERVER_EXIT=%ERRORLEVEL%"
popd

echo.
if "%SERVER_EXIT%"=="0" (
    echo  RAMSport has stopped.
) else (
    color 0C
    echo  [ERROR] RAMSport stopped unexpectedly with code %SERVER_EXIT%.
    echo  Check whether another application is using port 3000.
)
echo.
pause
exit /b %SERVER_EXIT%

:install_error
color 0C
echo.
echo  [ERROR] Dependency installation failed.
echo  Check the internet connection and run START_RAMSPORT.bat again.
echo.
pause
exit /b 1

:build_error
color 0C
echo.
echo  [ERROR] The production build failed.
echo  Review the messages above for the file and line that caused the error.
echo.
pause
exit /b 1
