@echo off
chcp 65001 >nul
cd /d "%~dp0"
call venv\Scripts\activate.bat
echo מעבד העלאה אחת ויוצא (למצב בדיקה)
echo.
python worker.py --once --verbose
pause
