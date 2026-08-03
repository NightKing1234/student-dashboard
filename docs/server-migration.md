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
2. **`os.path.join` במקום backslash** — 19 חיבורי נתיבים הומרו, כך שהקוד רץ גם על לינוקס.
3. **דריסה דרך משתני סביבה** — בלי לגעת בקונפיג:
   - `MATZEVET_DICT_FOLDER` — תיקיית המילונים
   - `MATZEVET_DATA_FOLDER` — תיקיית קבצי המצב"ת
   - `MATZEVET_OUTPUT_FOLDER` — תיקיית הפלט
4. **פרטי DB בקובץ נפרד** — `.env.db` (לא בגיט), נטען אוטומטית ע"י `update_from_moe.py`.

## איך מעבירים לשרת

```bash
# 1. להעתיק לשרת שתי תיקיות:
#      Itay_Modules/          (ה-pipeline + המילונים)
#      student-dashboard/scripts/   (update_from_moe.py, load_main.py)

# 2. תלויות
pip install pandas numpy openpyxl psycopg2-binary requests

# 3. פרטי חיבור — או .env.db, או משתני סביבה
export PGHOST=aws-1-ap-southeast-2.pooler.supabase.com
export PGPORT=5432
export PGUSER=postgres.<project-ref>
export PGPASSWORD=<db-password>
export PGDATABASE=postgres

# 4. אם מבנה התיקיות שונה — לדרוס בלי לערוך קונפיג
export MATZEVET_DATA_FOLDER=/srv/matzevet/incoming

# 5. הרצה
python update_from_moe.py --code 1400000
```

### לאוטומציה חודשית (cron)
```
0 6 1 * *  cd /srv/matzevet && python update_from_moe.py --code 1400000 >> update.log 2>&1
```

## מה שנשאר לבדוק במעבר ללינוקס

- **tkinter** — כמה מודולים מייבאים אותו בראש הקובץ (שאריות מבורר קבצים ידני).
  על שרת בלי GUI צריך `python3-tk` מותקן, או להסיר את היבוא.
- **קידוד** — הקוד קורא CSV ב-`utf-8`; על לינוקס זה ברירת המחדל ממילא.
- **שמות תיקיות בעברית** — עובדים על לינוקס, אבל אם זה מציק אפשר לשנות
  את `data_folder` בקונפיג לשם באנגלית.

## ⚠️ מה לא לעשות

**לא להעלות את קבצי המצב"ת לגיט ולא להריץ את ה-pipeline ב-GitHub Actions.**
הקבצים מכילים תעודות זהות, כתובות וטלפונים של אלפי קטינים. הם חייבים להישאר
על מחשב או שרת בשליטתך. `.gitignore` של הפרויקט חוסם `.env` ו-`.env.db`, אבל
תיקיית `Itay_Modules` כולה אינה חלק מהריפו של האתר — וכך זה צריך להישאר.
