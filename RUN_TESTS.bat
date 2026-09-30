@echo off
title RAMSport - API Tests
color 0E

echo ============================================
echo    RAMSport - API Test Suite
echo ============================================
echo.

REM Must run from repo root - this file's folder
cd /d "%~dp0"
cd RAMspace_Base_UI

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed.
    echo Install LTS from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Dependencies
if not exist node_modules (
    echo Installing dependencies - first run only...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

REM Build when missing
if not exist .next\standalone\server.js (
    echo Building production bundle...
    call npm run build
    if errorlevel 1 (
        echo [ERROR] Build failed.
        pause
        exit /b 1
    )
)

echo.
echo Running API tests against standalone server on port 3101...
echo --------------------------------------------
call npm run test:api
echo --------------------------------------------

if errorlevel 1 (
    echo.
    echo [RESULT] API TESTS FAILED - see FAIL lines above.
    echo.
    pause
    exit /b 1
)

echo.
echo Running UI tests against standalone server on port 3102...
echo --------------------------------------------
call npm run test:ui
echo --------------------------------------------

if errorlevel 1 (
    echo.
    echo [RESULT] UI TESTS FAILED - see FAIL lines above.
    echo.
    pause
    exit /b 1
)

echo.
echo [RESULT] ALL TESTS PASSED.
echo.
pause
