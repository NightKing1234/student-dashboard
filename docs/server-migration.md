# מעבר לשרת — מה רץ איפה

## חלוקת האחריות

| רכיב | איפה הוא רץ | הערה |
|------|-------------|------|
| האתר (React) | **Netlify** | סטטי, זמין 24/7, לא תלוי במחשב שלך |
| מסד הנתונים | **Supabase** | ענן, כבר שם |
| ה-pipeline + קבצי המצב"ת | **מחשב מקומי → שרת** | ראה למטה |

ה-pipeline **לא יכול** לרוץ על Netlify: הוא רץ ~30 שניות עם pandas, קורא 6 קבצי CSV
וכותב שני קבצי אקסל של כמה MB. פונקציות Netlify הן JavaScript, נחתכות אחרי שניות
בודדות, ואין להן דיסק מתמיד.

## מה כבר הוכן למעבר

הקוד כבר נייד — אין צורך לערוך אותו כדי להעביר אותו:

1. **נתיבים יחסיים** — `config/merge_files.json` מכיל `../tables` במקום נתיב מוחלט.
   הם נפתרים מול תיקיית ה-pipeline, כך שהתיקייה יכולה לשבת בכל מקום בדיסק.
2. **`os.path.join` במקום backslash** — 19 חיבורי נתיבים הומרו. נקי יותר, וגם
   יעבוד על לינוקס אם יידרש בעתיד.
3. **דריסה דרך משתני סביבה** — בלי לגעת בקונפיג:
   - `MATZEVET_DICT_FOLDER` — תיקיית המילונים
   - `MATZEVET_DATA_FOLDER` — תיקיית קבצי המצב"ת
   - `MATZEVET_OUTPUT_FOLDER` — תיקיית הפלט
4. **פרטי DB בקובץ נפרד** — `.env.db` (לא בגיט), נטען אוטומטית ע"י `update_from_moe.py`.

## איך מעבירים לשרת

**השרת של אייל הוא Windows**, כמו מחשב הפיתוח — לכן המעבר הוא כמעט
העתק-הדבק, בלי התאמות מערכת הפעלה.

```powershell
# 1. להעתיק לשרת:
#      Itay_Modules\                (ה-pipeline + המילונים)
#      student-dashboard\scripts\   (update_from_moe.py, load_main.py)
#      student-dashboard\.env.db    (פרטי החיבור ל-DB)

# 2. תלויות
pip install pandas numpy openpyxl psycopg2-binary requests

# 3. אם מבנה התיקיות שונה — לדרוס בלי לערוך קונפיג
$env:MATZEVET_DATA_FOLDER = "D:\matzevet\incoming"

# 4. הרצה
python scripts\update_from_moe.py --code 1400000
```

`.env.db` נטען אוטומטית, כך שאין צורך להגדיר `PGHOST`/`PGPASSWORD` בכל הרצה.

### אוטומציה חודשית — Task Scheduler

```powershell
$action = New-ScheduledTaskAction -Execute "python" `
    -Argument "scripts\update_from_moe.py --code 1400000" `
    -WorkingDirectory "D:\matzevet\student-dashboard"
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 6am
Register-ScheduledTask -TaskName "עדכון מצבת חודשי" -Action $action -Trigger $trigger
```

> קבצי המצב"ת החדשים צריכים להיות בתיקיית הקלט לפני ההרצה. אם משרד החינוך
> מפיץ אותם ידנית — השלב הזה נשאר ידני; הסקריפט אינו מוריד אותם.

## אם בעתיד עוברים ללינוקס

רלוונטי **רק** אם השרת יהיה לינוקס:

- **tkinter** — כמה מודולים מייבאים אותו בראש הקובץ (שאריות מבורר קבצים ידני).
  על שרת בלי GUI צריך `python3-tk` מותקן, או להסיר את היבוא.
- **שמות תיקיות בעברית** — עובדים, אבל אפשר לשנות את `data_folder` בקונפיג
  לשם באנגלית אם זה מציק.

## ⚠️ מה לא לעשות

**לא להעלות את קבצי המצב"ת לגיט ולא להריץ את ה-pipeline ב-GitHub Actions.**
הקבצים מכילים תעודות זהות, כתובות וטלפונים של אלפי קטינים. הם חייבים להישאר
על מחשב או שרת בשליטתך. `.gitignore` של הפרויקט חוסם `.env` ו-`.env.db`, אבל
תיקיית `Itay_Modules` כולה אינה חלק מהריפו של האתר — וכך זה צריך להישאר.
