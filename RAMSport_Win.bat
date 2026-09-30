@echo off
title RAMSport - Quick Start (No Docker)
color 0B

echo ============================================
echo    RAMSport
echo    Quick Start (No Docker)
echo ============================================
echo.

REM Must run from repo root (this file's folder)
cd /d "%~dp0"

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed.
    echo Install LTS from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

cd RAMspace_Base_UI

REM Install dependencies on first run
if not exist node_modules (
    echo [1/3] Installing dependencies - first run only...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

REM Production build when missing
if not exist .next\standalone\server.js (
    echo [2/3] Building production bundle...
    call npm run build
    if errorlevel 1 (
        echo [ERROR] Build failed.
        pause
        exit /b 1
    )
)

echo.
echo [3/3] Starting RAMSport...
echo.
echo ============================================
echo    RAMSport: http://localhost:3000
echo    Press CTRL+C to stop
echo ============================================
echo.

start http://localhost:3000
node .next\standalone\server.js

pause
