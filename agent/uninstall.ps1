# הסרת הסוכן — מבטל את הרישום ועוצר את התהליך.
#
# הפעלה: לחיצה ימנית  >  Run with PowerShell
#
# מה נמחק:  המשימה המתוזמנת, התהליך הרץ, והסביבה הווירטואלית (venv).
# מה נשאר:  קובצי ההגדרות (.env), הגיבויים, והיומן.
#
# הקובץ חייב להישמר כ-UTF-8 עם BOM — PowerShell 5.1 קורא קובץ ללא BOM כ-ANSI.

$ErrorActionPreference = 'Continue'

$agentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$taskName = 'MatzevetAgent'

Write-Host ''
Write-Host '============================================================'
Write-Host '  הסרת הסוכן'
Write-Host '============================================================'
Write-Host ''

# ---------- הרשאות מנהל ----------
$identity  = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host '  נדרשות הרשאות מנהל - מפעיל מחדש...'
    Write-Host '  יש לאשר את החלון שייפתח.'
    Start-Sleep -Seconds 1
    try {
        Start-Process powershell.exe -Verb RunAs -ArgumentList @(
            '-NoProfile', '-ExecutionPolicy', 'Bypass',
            '-File', "`"$($MyInvocation.MyCommand.Path)`""
        )
    } catch {
        Write-Host '  [שגיאה] ההרצה כמנהל בוטלה.' -ForegroundColor Red
        Read-Host 'Enter לסגירה'
    }
    exit 0
}

# ---------- המשימה ----------
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host '  המשימה המתוזמנת הוסרה.'
} else {
    Write-Host '  לא נמצאה משימה מתוזמנת.'
}

# ---------- התהליך ----------
# רק תהליכים שרצים מתוך תיקיית הסוכן הזו, כדי לא לגעת בפייתון אחר במחשב
$killed = 0
Get-CimInstance Win32_Process -Filter "Name='pythonw.exe' OR Name='python.exe'" |
    Where-Object { $_.CommandLine -and $_.CommandLine -like "*$agentDir*" } |
    ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        $killed++
    }
if ($killed -gt 0) { Write-Host "  נעצרו $killed תהליכים." }
else { Write-Host '  לא נמצאו תהליכים רצים.' }

# ---------- הסביבה הווירטואלית ----------
$venv = Join-Path $agentDir 'venv'
if (Test-Path $venv) {
    Start-Sleep -Seconds 2
    Remove-Item $venv -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path $venv) {
        Write-Host '  [!] לא ניתן היה למחוק את venv - ייתכן שקובץ עדיין בשימוש.'
        Write-Host '      אפשר למחוק אותה ידנית אחרי הפעלה מחדש.'
    } else {
        Write-Host '  הסביבה הווירטואלית נמחקה.'
    }
} else {
    Write-Host '  לא נמצאה סביבה וירטואלית.'
}

Write-Host ''
Write-Host '============================================================'
Write-Host '  הסוכן הוסר.'
Write-Host '============================================================'
Write-Host ''
Write-Host '  נשארו במקום (לא נמחקו):'
Write-Host '    .env.db / .env.agent   קובצי ההגדרות'
Write-Host '    backups\               גיבויי הטבלאות'
Write-Host '    agent.log              יומן ההרצה'
Write-Host ''
Write-Host '  להתקנה מחדש: setup.bat'
Write-Host '  למחיקה מלאה: למחוק את התיקייה כולה'
Write-Host ''
Read-Host 'Enter לסגירה'
