@echo off
REM ===========================================================
REM  RAMSport_R01 - One-time login for GitHub + Vercel
REM  Run this ONCE. After it finishes, the push + deploy run
REM  automatically.
REM ===========================================================
title RAMSport - Login (GitHub + Vercel)
color 0B

set "GH=%ProgramFiles%\GitHub CLI\gh.exe"

echo.
echo ============================================
echo    STEP 1 of 2 - GitHub login
echo ============================================
echo.
echo A browser will open. Choose "GitHub.com", then
echo click "Login with a web browser" and paste
echo the one-time code it shows you.
echo.

if exist "%GH%" (
    "%GH%" auth login --hostname github.com --git-protocol https --web
) else (
    echo [ERROR] GitHub CLI not found at %GH%
    pause
    exit /b 1
)

if errorlevel 1 (
    echo.
    echo [ERROR] GitHub login failed or was cancelled.
    pause
    exit /b 1
)

echo.
echo ============================================
echo    GitHub OK
echo ============================================
echo.

echo ============================================
echo    STEP 2 of 2 - Vercel login
echo ============================================
echo.
echo A browser will open. Click "Log in" and
echo finish signing in with GitHub or email.
echo.

call vercel login

if errorlevel 1 (
    echo.
    echo [ERROR] Vercel login failed or was cancelled.
    pause
    exit /b 1
)

echo.
echo ============================================
echo    Both logins complete
echo ============================================
echo.
echo You can close this window.
echo.
pause
