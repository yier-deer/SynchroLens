@echo off
chcp 65001 >nul
title SynchroLens Starter

cd /d "%~dp0"

echo ========================================
echo   SynchroLens — AI 同声传译助手
echo ========================================
echo.

if not exist "node_modules\" (
    echo [1/2] 正在安装依赖 (仅首次)...
    call npm install
    if %errorlevel% neq 0 (
        echo 依赖安装失败!
        pause
        exit /b 1
    )
    echo 依赖安装完成!
    echo.
) else (
    echo 依赖已就绪, 跳过安装
    echo.
)

echo [2/2] 正在启动应用...
echo.
echo 提示: 主窗口启动后, 悬浮字幕和控制窗将自动弹出
echo 按 Ctrl+C 可停止
echo.

call npm run dev

pause
