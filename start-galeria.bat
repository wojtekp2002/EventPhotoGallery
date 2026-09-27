@echo off
cd /d "%~dp0"

where py >nul 2>&1
if errorlevel 1 (
    where python >nul 2>&1
    if errorlevel 1 (
        echo Nie znaleziono Pythona. Zainstaluj Python albo uruchom projekt przez VS Code Live Server.
        pause
        exit /b 1
    )
    set "PYTHON_CMD=python"
) else (
    set "PYTHON_CMD=py"
)

start "Serwer galerii SP24" cmd /k "%PYTHON_CMD% -m http.server 8000"
timeout /t 2 /nobreak >nul
start "" "http://localhost:8000"