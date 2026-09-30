@echo off
title RAMSport - Docker Setup
color 0A

echo ============================================
echo    RAMSport
echo    Docker Setup for Windows
echo ============================================
echo.

REM Must run from repo root (this file's folder)
cd /d "%~dp0"

REM Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not installed or not in PATH.
    echo.
    echo Please install Docker Desktop from:
    echo https://www.docker.com/products/docker-desktop/
    echo.
    echo After installing, restart your PC and run this file again.
    echo.
    pause
    exit /b 1
)

REM Check if Docker daemon is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Desktop is not running.
    echo.
    echo Please start Docker Desktop from the Start Menu.
    echo Wait for "Docker Desktop is running" status, then run this file again.
    echo.
    pause
    exit /b 1
)

echo [1/3] Building Docker image...
docker build -t RAMSport .
if errorlevel 1 (
    echo [ERROR] Build failed.
    pause
    exit /b 1
)

echo.
echo [2/3] Stopping old container (if any)...
docker stop RAMSport >nul 2>&1
docker rm RAMSport >nul 2>&1

echo.
echo [3/3] Starting RAMSport on port 3000...
echo.
echo ============================================
echo    RAMSport: http://localhost:3000
echo    Press CTRL+C to stop
echo ============================================
echo.

start http://localhost:3000
docker run --name RAMSport -p 3000:3000 RAMSport

pause
