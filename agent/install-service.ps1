# רישום הסוכן כמשימה מתוזמנת שרצה 24/7.
#
# הפעלה: לחיצה ימנית על הקובץ  >  Run with PowerShell
#
# הערה למי שעורך את הקובץ: הוא חייב להישמר כ-UTF-8 **עם BOM**.
# PowerShell 5.1 קורא קובץ ללא BOM כ-ANSI, והעברית נהרסת עד כדי שגיאות ניתוח.

$ErrorActionPreference = 'Stop'

$agentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$taskName = 'MatzevetAgent'
$python   = Join-Path $agentDir 'venv\Scripts\pythonw.exe'
$script   = Join-Path $agentDir 'worker.py'
$logFile  = Join-Path $agentDir 'install-service.log'

# החלון המוסלם נסגר עם סיום הסקריפט, ואיתו כל הודעת שגיאה. לכן הכול
# נרשם גם לקובץ — אחרת אי אפשר לאבחן כישלון מרחוק.
try { Start-Transcript -Path $logFile -Force | Out-Null } catch { }

function Write-Step($text) { Write-Host "  $text" }

function Fail($text) {
    Write-Host ''
    Write-Host "  [שגיאה] $text" -ForegroundColor Red
    Write-Host ''
    Write-Host "  הפירוט נשמר ב: $logFile"
    Write-Host ''
    try { Stop-Transcript | Out-Null } catch { }
    Read-Host 'Enter לסגירה'
    exit 1
}

Write-Host ''
Write-Host '============================================================'
Write-Host '  רישום הסוכן להפעלה אוטומטית'
Write-Host '============================================================'
Write-Host ''

# ---------- הרשאות מנהל ----------
# רישום משימה שרצה תחת SYSTEM מחייב הרשאות מנהל, ו"Run with PowerShell"
# אינו מעלה אותן. במקום להיכשל בהמשך עם "Access denied" - מבקשים אותן כאן.
$identity  = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
$isAdmin   = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Step 'נדרשות הרשאות מנהל - מפעיל מחדש...'
    Write-Step 'יש לאשר את החלון שייפתח.'
    try { Stop-Transcript | Out-Null } catch { }
    Start-Sleep -Seconds 1
    try {
        Start-Process powershell.exe -Verb RunAs -ArgumentList @(
            '-NoProfile', '-ExecutionPolicy', 'Bypass',
            '-File', "`"$($MyInvocation.MyCommand.Path)`""
        )
    } catch {
        Write-Host ''
        Write-Host '  [שגיאה] ההרצה כמנהל בוטלה. יש להריץ שוב ולאשר.' -ForegroundColor Red
        Read-Host 'Enter לסגירה'
        exit 1
    }
    exit 0
}

Write-Step "תיקיית הסוכן: $agentDir"

# ---------- בדיקות מוקדמות ----------
if (-not (Test-Path $python)) {
    Fail "הסביבה הווירטואלית לא נמצאה ב:`n          $python`n          יש להריץ קודם את setup.bat"
}
if (-not (Test-Path $script)) {
    Fail "worker.py לא נמצא ב: $script"
}
Write-Step 'הקבצים נמצאו.'
Write-Host ''

# ---------- הסרת משימה קודמת ----------
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Step 'מסיר רישום קודם...'
    try {
        Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    } catch {
        Fail "הסרת הרישום הקודם נכשלה: $($_.Exception.Message)"
    }
}

# ---------- רישום ----------
# pythonw.exe רץ ללא חלון קונסולה - הסוכן לא מפריע לעבודה על המחשב.
try {
    $action = New-ScheduledTaskAction -Execute $python `
        -Argument "`"$script`" --interval 5" -WorkingDirectory $agentDir

    $trigger = New-ScheduledTaskTrigger -AtStartup

    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -RestartCount 999 `
        -RestartInterval (New-TimeSpan -Minutes 1) `
        -ExecutionTimeLimit (New-TimeSpan -Seconds 0)

    # SYSTEM - כדי שהסוכן ירוץ גם כשאף אחד לא מחובר למשתמש
    $taskPrincipal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' `
        -LogonType ServiceAccount -RunLevel Highest

    Register-ScheduledTask -TaskName $taskName `
        -Action $action -Trigger $trigger `
        -Settings $settings -Principal $taskPrincipal `
        -Description 'Matzevet agent - downloads uploaded files, runs the pipeline, updates the database' `
        | Out-Null
} catch {
    Fail "הרישום נכשל: $($_.Exception.Message)"
}

Write-Step 'המשימה נרשמה.'

try {
    Start-ScheduledTask -TaskName $taskName
} catch {
    Fail "המשימה נרשמה אך ההפעלה נכשלה: $($_.Exception.Message)"
}

Start-Sleep -Seconds 4
$state = (Get-ScheduledTask -TaskName $taskName).State
$info  = Get-ScheduledTaskInfo -TaskName $taskName
Write-Step "מצב: $state"
Write-Step "קוד תוצאה: $($info.LastTaskResult)"

Write-Host ''
Write-Host '============================================================'
Write-Host '  הסוכן פועל ויעלה אוטומטית בכל הפעלה של המחשב'
Write-Host '============================================================'
Write-Host ''
Write-Host '  מעקב:'
Write-Host "    notepad `"$agentDir\agent.log`""
Write-Host ''
Write-Host '  פקודות ניהול:'
Write-Host "    Stop-ScheduledTask  -TaskName '$taskName'"
Write-Host "    Start-ScheduledTask -TaskName '$taskName'"
Write-Host "    Unregister-ScheduledTask -TaskName '$taskName'"
Write-Host ''
try { Stop-Transcript | Out-Null } catch { }
Read-Host 'Enter לסגירה'
