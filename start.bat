@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
title SynchroLens Starter
cd /d "%~dp0"

echo ========================================
echo   SynchroLens - AI Tong Sheng Chuan Yi
echo ========================================
echo.

where node >nul 2>&1
if !errorlevel! neq 0 (
    set "NODE_PATH=C:\Users\A\AppData\Roaming\TRAE SOLO CN\ModularData\ai-agent\vm\tools\node"
    if exist "!NODE_PATH!\node.exe" (
        set "PATH=!NODE_PATH!;!PATH!"
        echo Found Node.js in IDE bundle
    ) else (
        echo [ERROR] Node.js not found.
        echo Install Node.js from https://nodejs.org then try again.
        pause
        exit /b 1
    )
)

if not exist "node_modules\" (
    echo [1/3] Installing dependencies...
    call npm install
    if !errorlevel! neq 0 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
    echo Done.
) else (
    echo [1/3] Dependencies OK
)

if not exist "out\" (
    echo [2/3] Building project...
    call npx electron-vite build
    if !errorlevel! neq 0 (
        echo [ERROR] Build failed.
        pause
        exit /b 1
    )
    echo Done.
) else (
    echo [2/3] Build output OK
)

echo.
echo [3/3] Starting SynchroLens...
echo Press Ctrl+C to stop
echo.

call npx electron-vite dev

endlocal
pause