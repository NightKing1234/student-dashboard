# מסד הנתונים — סכימה, הרשאות ושדות

מסד הנתונים הוא Supabase (PostgreSQL). המיגרציות נמצאות ב-`supabase/migrations/`.

## טבלאות

### `authorities` — רשויות (מטא)
| עמודה | סוג | תיאור |
|-------|-----|--------|
| code | text (PK) | קוד הרשות, למשל `1400000` |
| name | text | שם לתצוגה, למשל "מטה מנשה" |
| is_active | boolean | פעילה? |
| created_at | timestamptz | |

### `users` — משתמשים ושיוך לרשויות
| עמודה | סוג | תיאור |
|-------|-----|--------|
| id | uuid (PK) | מקושר ל-`auth.users` |
| email | text | |
| display_name | text | שם לתצוגה |
| role | text | `viewer` / `admin` / `super_admin` |
| authority_codes | text[] | קודי הרשויות שהמשתמש משויך אליהן |

רשומת משתמש נוצרת אוטומטית בעת הרשמה ב-Auth דרך הטריגר `handle_new_auth_user()`,
שקורא `role` ו-`authority_codes` מ-`raw_user_meta_data`.

### `students_{code}` — טבלת התלמידים (אחת לכל רשות)
- למשל `students_1400000`. **117 עמודות**, מפתח ראשי: `MISPAR_ZEHUT` (תעודת זהות).
- **נדרסת בכל עדכון חודשי** (TRUNCATE + טעינה מחדש).
- שמות העמודות באנגלית (python_name של ה-pipeline); התוויות בעברית ב-`src/config/fields.ts`.
- אינדקסים: על ת.ז. ההורים (זיהוי אחים) ועל סמל מוסד.

## הרשאות (RLS)
- **`students_{code}`**: קריאה מותרת רק אם קוד הרשות נמצא ב-`authority_codes` של המשתמש
  (דרך פונקציית העזר `has_authority(code)`).
- **`users`**: כל משתמש קורא רק את הרשומה של עצמו.
- **`authorities`**: כל משתמש מאומת יכול לקרוא.

## שדות מחושבים
שלושה שדות אינם מגיעים ישירות ממשרד החינוך אלא נוצרים בעיבוד:

| שדה | סטטוס | הערה |
|------|--------|------|
| `KITA_MESHULEVET` (כיתה משולב) | ✅ ממומש | מחושב מ"מקבילה" (ט5 → ט-5) בסקריפט הטעינה |
| `STATUS_CHINUCH_MEYUCHAD` (סטטוס חינוך מיוחד) | ⬜ ריק | לוגיקת משבצת/זכאות — שלב ג' |
| `STATUS_TALMID_BARASHUT` (סטטוס תלמיד ברשות) | ⬜ ריק | השוואת רשות מגורים/מוסד — שלב ג' |

## עמודות מוסתרות מה-UI
`GOREM_KESHER_1_Family_Name` ו-`GOREM_KESHER_2_Name` — כפילויות של שמות ההורים; השם
מוצג דרך `GOREM_KESHER_1/2_FULL_NAME`. לכן העמודות הכפולות אינן ב-`fields.ts`.

## פרטי חיבור (סביבה)
- הפרויקט: `agcoeqshvkyopjjdvril` (Supabase).
- חיבור ישיר (`db.<ref>.supabase.co:5432`) הוא IPv6 בלבד; ברשתות IPv4 יש להשתמש ב-**session pooler**
  (`aws-1-ap-southeast-2.pooler.supabase.com:5432`, משתמש `postgres.<ref>`).
- הסקריפטים קוראים פרטי חיבור ממשתני סביבה (`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`) —
  לא מאוחסנים בקוד.

> ⚠️ אבטחה: אם מפתח `service_role` / סיסמת DB נחשפו — לסובב אותם ב-Dashboard.
