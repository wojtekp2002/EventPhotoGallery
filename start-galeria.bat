@echo off
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
    echo Nie znaleziono Node.js.
    pause
    exit /b 1
)

node local-server.js --open
