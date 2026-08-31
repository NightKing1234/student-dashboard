# ממשק אינטרנטי לניהול נתוני תלמידים

ממשק React לניהול נתוני תלמידים ממשרד החינוך, מחליף מערכת Access קיימת.
מסמך האפיון המלא: [docs/project-spec.md](docs/project-spec.md).

## הרצה מקומית

```bash
npm install
cp .env.example .env   # מלא URL ו-anon key של Supabase
npm run dev
```

## סקריפטים
- `npm run dev` — שרת פיתוח (Vite)
- `npm run build` — בדיקת טיפוסים (tsc) + build לפרודקשן
- `npm run preview` — תצוגה מקדימה של ה-build
- `npm run lint` — ESLint

## מבנה
```
src/
  config/     fields.ts (כל השדות + תוויות עברית), presets.ts (5 תצורות)
  lib/        supabase.ts, students.ts, filters.ts, table.ts, exportExcel.ts
  context/    AuthContext.tsx
  components/  StudentTable, FilterBar, FieldPicker, StudentCard
  pages/      Login.tsx, Dashboard.tsx
supabase/migrations/   001 (users/authorities/RLS), 002 (students_1400000)
scripts/load_data.py   טעינת פלט ה-pipeline ל-Supabase
```

## הקמת מסד הנתונים (Supabase)
1. צור פרויקט Supabase, העתק URL + anon key ל-`.env`.
2. הרץ את המיגרציות תחת `supabase/migrations/` (SQL Editor או Supabase CLI).
3. צור משתמש ב-Auth ושייך אותו לרשות דרך `authority_codes` בטבלת `users`
   (או דרך `raw_user_meta_data` בהרשמה).
4. טען נתונים: `python scripts/load_data.py --file <פלט pipeline> --code 1400000`.

## מה מומש (שלב א')
טבלה ראשית עם 5 תצורות שדות, בורר שדות, דפדוף שדות אופקי, סינון מתקדם (כולל "מכיל"),
מיון, כרטיס תלמיד עם ניווט הבא/הקודם, זיהוי אחים, וייצוא לאקסל — הכל RTL ורספונסיבי.
```
