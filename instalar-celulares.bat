@echo off
setlocal
chcp 65001 >nul
title Phone Finder - Instalador em Serie USB

echo.
echo ====================================================================
echo    Iniciando Phone Finder - Instalador em Serie via USB (ADB)...
echo ====================================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\instalar-celulares.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] Ocorreu um erro durante a execucao do instalador.
    pause
)
endlocal
