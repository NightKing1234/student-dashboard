@echo off
chcp 65001 >nul
cd /d "%~dp0"
call venv\Scripts\activate.bat
echo מפעיל את סוכן העיבוד. לעצירה: Ctrl+C
echo.
python worker.py --interval 5
pause
