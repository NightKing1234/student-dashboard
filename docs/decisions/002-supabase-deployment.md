# החלטה 002 — הקמת Supabase וטעינת נתונים

תאריך: 2026-07-01

## הקשר
לאחר מימוש הקוד של שלב א', הוקם פרויקט Supabase אמיתי ונטענו נתוני אמת של רשות 1400000.

## החלטות ופתרונות
1. **חיבור דרך session pooler** — החיבור הישיר (`db.<ref>.supabase.co:5432`) הוא IPv6 בלבד
   ולא נפתר ברשת של המשתמש. נעשה שימוש ב-session pooler
   (`aws-1-ap-southeast-2.pooler.supabase.com:5432`, משתמש `postgres.<ref>`), שהוא IPv4.
2. **הרצת מיגרציות בפייתון** — אין psql מותקן; נכתב `scripts/run_migrations.py` (psycopg2)
   שמריץ את קבצי ה-SQL. פרטי חיבור ממשתני סביבה בלבד.
3. **טעינה ישירה ל-DB** (ולא REST) — `scripts/load_main.py` מכניס דרך psycopg2, מהיר ואמין יותר.
4. **יצירת משתמש דרך Admin API** — `scripts/create_user.py` עם ה-secret key; הטריגר ב-DB
   ממלא את `public.users` עם השיוך לרשות.
5. **מפתחות API חדשים** — הפרויקט משתמש בפורמט החדש (`sb_publishable_...`, `sb_secret_...`),
   נתמך ע"י supabase-js וע"י ה-REST/Admin API.
6. **verify=False בבקשות REST** — בגלל יירוט SSL ברשת; החיבור עדיין ל-Supabase.

## באג שתוקן
`df.to_numpy()` בסקריפט הטעינה המיר `None` ל-`float nan`, שנכתב כמחרוזת `'NaN'` בעמודות טקסט.
תוקן ע"י המרת nan→None לפני ההכנסה. עיקרון: תא ריק במקור נשאר ריק, בלי ערכים מזויפים.

## פתוח
- **אבטחה:** ה-secret key וסיסמת ה-DB נחשפו במהלך ההקמה — יש לסובב אותם ב-Dashboard.
- **פריסה ל-Netlify** — טרם בוצעה.
