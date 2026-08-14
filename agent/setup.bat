@echo off
chcp 65001 >nul
setlocal

echo ============================================================
echo   התקנת סוכן העיבוד - מצבת תלמידים
echo ============================================================
echo.

cd /d "%~dp0"

REM ---------- בדיקת פייתון ----------
python --version >nul 2>&1
if errorlevel 1 (
    echo [שגיאה] פייתון לא מותקן, או שאינו ב-PATH.
    echo.
    echo   הורד מ:  https://www.python.org/downloads/windows/
    echo   מומלץ:   Python 3.11
    echo   חשוב:    לסמן "Add Python to PATH" במסך ההתקנה הראשון
    echo.
    pause
    exit /b 1
)

for /f "tokens=2" %%v in ('python --version 2^>^&1') do set PYVER=%%v
echo נמצא פייתון %PYVER%
echo.

REM ---------- סביבה וירטואלית ----------
if not exist "venv\" (
    echo יוצר סביבה וירטואלית...
    python -m venv venv
    if errorlevel 1 (
        echo [שגיאה] יצירת הסביבה הווירטואלית נכשלה.
        pause
        exit /b 1
    )
)

echo מתקין ספריות...
call venv\Scripts\activate.bat
python -m pip install --upgrade pip --quiet
pip install -r requirements.txt
if errorlevel 1 (
    echo.
    echo [שגיאה] התקנת הספריות נכשלה.
    echo אם השגיאה היא SELF_SIGNED_CERT או SSL, הרץ:
    echo     pip install -r requirements.txt --trusted-host pypi.org --trusted-host files.pythonhosted.org
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   ההתקנה הושלמה
echo ============================================================
echo.

REM ---------- בדיקת קובצי הגדרות ----------
if not exist "..\.env.db" (
    echo [חסר] ..\.env.db  - פרטי החיבור למסד הנתונים
    set MISSING=1
)
if not exist "..\.env.agent" (
    echo [חסר] ..\.env.agent - פרטי חשבון הסוכן
    echo        העתק את .env.agent.example ומלא את הערך
    set MISSING=1
)
if defined MISSING (
    echo.
    echo יש להשלים את הקבצים החסרים לפני ההרצה.
    echo.
    pause
    exit /b 1
)

echo כל קובצי ההגדרות קיימים.
echo.
echo   בדיקה חד-פעמית:      start.bat
echo   הפעלה קבועה 24/7:    לחיצה ימנית על install-service.ps1 ^> Run with PowerShell
echo.
pause
