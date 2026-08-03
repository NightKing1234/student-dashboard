# יומן פיתוח (Dev Log)

יומן כרונולוגי של ההתקדמות בפרויקט. רישום קצר אחרי כל יום עבודה / שלב משמעותי: מה נעשה, מה נתקענו בו, ומה הצעד הבא.

הרשומה החדשה ביותר למעלה.

---

## 2026-07-01 — הקמת Supabase, טעינת נתונים והרצה חיה

- **הוקם פרויקט Supabase אמיתי** (`agcoeqshvkyopjjdvril`) והורצו המיגרציות דרך
  [run_migrations.py](../scripts/run_migrations.py) (חיבור session pooler, IPv4).
- **נטענו 7,905 תלמידים אמיתיים** של מטה מנשה (1400000) דרך [load_main.py](../scripts/load_main.py).
- **נוצר משתמש admin** (`eyal.yinnon@gmail.com`) משויך לרשות, דרך [create_user.py](../scripts/create_user.py).
- נבדקה כל השרשרת: כניסה + RLS + שאילתה מחזירים נתוני אמת.
- **תוקן באג טעינה:** `df.to_numpy()` המיר ריקים ל-`float nan` שנכתבו כ-`'NaN'` בטקסט — תוקן
  (nan→None). כן חושב `כיתה משולב` (ט5→ט-5) ותוקן מיפוי שמות הורים דו-משמעי.
- **עיקרון שאושר:** תא ריק במקור נשאר ריק באתר — בלי ערכים מזויפים.
- **תיעוד:** נוצרו [architecture.md](architecture.md), [database.md](database.md),
  [data-loading.md](data-loading.md), [features.md](features.md), [setup-and-run.md](setup-and-run.md),
  ו-[decisions/002](decisions/002-supabase-deployment.md).
- **הצעד הבא:** פריסה ל-Netlify, מסך ניהול משתמשים, וסיבוב מפתחות שנחשפו.

---

## 2026-07-01 — מימוש שלב א' (MVP)

- נבנתה אפליקציית React + TypeScript + Vite + Tailwind (RTL מלא) ב-`student-dashboard/`.
- **קונפיג שדות:** [src/config/fields.ts](../src/config/fields.ts) — ~117 שדות עם תוויות עברית,
  סוגים וקבוצות, נגזר מ-`columns_name_dictionary.xlsx`. + 3 שדות מחושבים.
- **4 תצורות** ב-[src/config/presets.ts](../src/config/presets.ts): תלמידים, פרטי קשר, מוסדות, חינוך מיוחד.
- **רכיבים:** StudentTable (וירטואליזציה + מיון + דפדוף שדות), FilterBar (כל האופרטורים, AND),
  FieldPicker, StudentCard (כרטיס תואם-תצורה, ניווט הבא/קודם, זיהוי אחים).
- **מנועים:** filters.ts (סינון), table.ts (מיון + דפדוף שדות), exportExcel.ts (ייצוא), AuthContext.
- **DB:** מיגרציות Supabase — 001 (users/authorities/RLS + has_authority), 002 (students_1400000).
- **טעינת נתונים:** [scripts/load_data.py](../scripts/load_data.py).
- החלטות טכניות תועדו ב-[decisions/001-tech-choices.md](decisions/001-tech-choices.md).
- **הצעד הבא:** הקמת פרויקט Supabase אמיתי, הרצת מיגרציות, טעינת נתוני 1400000, ובדיקת end-to-end.

---

## 2026-06-30 — הקמת מבנה הפרויקט

- הוקם מבנה התיקיות `student-dashboard/` עם תיקיית `docs/` לאובסידיאן.
- מסמך האפיון המלא הועתק ל-[project-spec.md](project-spec.md).
- נוצרו תיקיות `decisions/` ו-`meetings/` עם תבניות.
- נוצרו `CLAUDE.md` (הוראות ל-Claude Code) ו-`package.json` בשורש.
- **הצעד הבא:** התחלת שלב א' — הקמת Supabase, מערכת הרשאות, וטבלה ראשית.
