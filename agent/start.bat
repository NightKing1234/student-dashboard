@echo off
REM Runs the agent in the foreground. Ctrl+C to stop.
cd /d "%~dp0"
if not exist "venv\Scripts\python.exe" (
    echo   [ERROR] Not installed yet. Run setup.bat first.
    pause
    exit /b 1
)
venv\Scripts\python.exe worker.py --interval 5
pause
