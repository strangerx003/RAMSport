@echo off
REM ===========================================================
REM  RAMSport_R01 - Push to GitHub + Deploy to Vercel
REM  Run this AFTER LOGIN_FIRST.bat has completed.
REM ===========================================================
title RAMSport - Push and Deploy
color 0A

set "GH=%ProgramFiles%\GitHub CLI\gh.exe"
set "REPO=strangerx003/RAMSport"

cd /d "%~dp0"

echo.
echo ============================================
echo    STEP 1 - GitHub
echo ============================================
echo.

"%GH%" auth status
if errorlevel 1 (
    echo [ERROR] Not logged into GitHub. Run LOGIN_FIRST.bat first.
    pause
    exit /b 1
)

REM --- Create the repo if it does not exist yet ---
"%GH%" repo view %REPO% >nul 2>&1
if errorlevel 1 (
    echo [1/3] Creating %REPO% ...
    "%GH%" repo create %REPO% --public --source=. --remote=origin --push
    if errorlevel 1 (
        echo [ERROR] Repo creation failed.
        pause
        exit /b 1
    )
    echo [1/3] Created.
) else (
    echo [1/3] Repo already exists - pushing.
    git push -u origin main
    if errorlevel 1 (
        echo [ERROR] Push failed.
        pause
        exit /b 1
    )
)

echo.
echo [2/3] Pushing the RAMSport_R01 tag ...
git push origin RAMSport_R01
if errorlevel 1 echo [WARN] Tag push failed - you can retry later.

echo.
echo [3/3] Done - GitHub is up to date.
echo.
echo ============================================
echo    GitHub: https://github.com/%REPO%
echo ============================================
echo.

REM ===========================================================
REM  Vercel deploy
REM ===========================================================
echo.
echo ============================================
echo    STEP 2 - Vercel
echo ============================================
echo.

where vercel >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Vercel CLI not found. Install with: npm install -g vercel
    pause
    exit /b 1
)

call vercel whoami >nul 2>&1
if errorlevel 1 (
    echo Vercel CLI is not logged in. Running login now...
    echo A browser will open - finish signing in there.
    echo.
    call vercel login
)

echo.
echo Deploying RAMSport_R01 to Vercel as project "ramsport"...
echo This produces: https://ramsport.vercel.app
echo.

cd RAMspace_Base_UI
call vercel deploy --prod --yes --name ramsport

echo.
echo ============================================
echo    Vercel deploy finished
echo    https://ramsport.vercel.app
echo ============================================
echo.

cd /d "%~dp0"
pause
