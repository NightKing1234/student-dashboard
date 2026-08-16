@echo off
REM Processes one pending upload and exits. For testing.
cd /d "%~dp0"
if not exist "venv\Scripts\python.exe" (
    echo   [ERROR] Not installed yet. Run setup.bat first.
    pause
    exit /b 1
)
venv\Scripts\python.exe worker.py --once --verbose
pause
