# רושם את הסוכן כמשימה מתוזמנת שרצה 24/7.
#
# למה Task Scheduler ולא שירות Windows: שירות אמיתי דורש כלי חיצוני (NSSM)
# והרשאות מנהל. משימה מתוזמנת מובנית במערכת, עולה עם המחשב, ומרימה את
# עצמה אם התהליך נפל — וזה בדיוק מה שצריך כאן.
#
# הרצה: לחיצה ימנית על הקובץ > Run with PowerShell

$ErrorActionPreference = 'Stop'
$agentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$taskName = 'סוכן מצבת תלמידים'
$python   = Join-Path $agentDir 'venv\Scripts\pythonw.exe'
$script   = Join-Path $agentDir 'worker.py'

Write-Host '============================================================'
Write-Host '  רישום הסוכן כמשימה מתוזמנת'
Write-Host '============================================================'
Write-Host ''

if (-not (Test-Path $python)) {
    Write-Host '[שגיאה] הסביבה הווירטואלית לא נמצאה.' -ForegroundColor Red
    Write-Host '        הרץ קודם את setup.bat'
    Read-Host 'Enter לסגירה'
    exit 1
}

# משימה קיימת מוחלפת, כדי שאפשר יהיה להריץ את הסקריפט שוב אחרי עדכון
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Write-Host 'מסיר משימה קודמת...'
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# pythonw.exe רץ בלי חלון קונסולה — הסוכן לא מפריע לעבודה על המחשב
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

# SYSTEM — כדי שהסוכן ירוץ גם כשאף אחד לא מחובר למחשב
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' `
    -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Settings $settings -Principal $principal `
    -Description 'מוריד קבצי מצבת שהועלו באתר, מריץ את ה-pipeline ומעדכן את Supabase' | Out-Null

Write-Host 'המשימה נרשמה.' -ForegroundColor Green
Write-Host ''
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 3
$state = (Get-ScheduledTask -TaskName $taskName).State
Write-Host "מצב נוכחי: $state"
Write-Host ''
Write-Host 'הסוכן יעלה אוטומטית בכל הפעלה של המחשב.'
Write-Host ''
Write-Host 'פקודות שימושיות:'
Write-Host "  צפייה ביומן:   notepad `"$agentDir\agent.log`""
Write-Host "  עצירה:         Stop-ScheduledTask -TaskName '$taskName'"
Write-Host "  הפעלה:         Start-ScheduledTask -TaskName '$taskName'"
Write-Host "  הסרה:          Unregister-ScheduledTask -TaskName '$taskName'"
Write-Host ''
Read-Host 'Enter לסגירה'
