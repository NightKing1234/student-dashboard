# הקמה והרצה — מאפס עד אתר עובד

מדריך שחזור: איך להקים את המערכת מאפס, כפי שנעשה בפועל.

## דרישות מוקדמות
- Node.js (npm)
- Python 3 עם `pandas`, `openpyxl`, `psycopg2-binary`, `requests`
- חשבון Supabase (פרויקט קיים)

## שלב 1 — התקנת הפרונטאנד
```bash
cd student-dashboard
npm install
```
> אם ההתקנה נכשלת עם `SELF_SIGNED_CERT_IN_CHAIN` (יירוט SSL ברשת ארגונית):
> `npm config set strict-ssl false`, להתקין, ואז `npm config set strict-ssl true`.
> npm עדיין מאמת שלמות חבילות לפי checksum, אז זה בטוח יחסית.

## שלב 2 — הקמת מסד הנתונים
1. ליצור פרויקט Supabase ולהשיג: Project URL, publishable/anon key, secret key, וסיסמת DB.
2. להריץ את המיגרציות:
```bash
set PGHOST=aws-1-ap-southeast-2.pooler.supabase.com   # session pooler (IPv4)
set PGPORT=5432
set PGUSER=postgres.<project-ref>
set PGPASSWORD=<db-password>
set PGDATABASE=postgres
python scripts/run_migrations.py
```
זה יוצר את `users`, `authorities`, `students_1400000`, ה-RLS והטריגרים.

## שלב 3 — טעינת נתונים
```bash
python scripts/load_main.py --file "<path-to-main.xlsx>" --code 1400000
```
ראה פרטים ב-[data-loading.md](data-loading.md).

## שלב 4 — יצירת משתמש
```bash
set SUPABASE_URL=https://<project-ref>.supabase.co
set SUPABASE_SECRET=<secret-key>
python scripts/create_user.py --email you@example.com --password "..." --role admin --code 1400000 --display "שם"
```

## שלב 5 — הגדרת הפרונטאנד והרצה
צור קובץ `.env` בתיקיית `student-dashboard`:
```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-or-anon-key>
```
ואז:
```bash
npm run dev
```
פתח **http://localhost:5173** והתחבר.

## שלב 6 (עתידי) — פריסה ל-Netlify
- `npm run build` מייצר את `dist/`.
- להעלות ל-Netlify (חיבור GitHub / CLI / גרירה ידנית) ולהגדיר את שני משתני הסביבה
  (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) בהגדרות ה-Site.
- קובץ `netlify.toml` עם redirect ל-SPA (`/* → /index.html`) יידרש לניתוב.

## מצב נוכחי (2026-07-01)
- Supabase: פרויקט `agcoeqshvkyopjjdvril`, טבלה `students_1400000` עם 7,905 תלמידים.
- משתמש: `eyal.yinnon@gmail.com` (admin, רשות 1400000).
- הפרונטאנד: רץ מקומית על `localhost:5173`. טרם נפרס ל-Netlify.
