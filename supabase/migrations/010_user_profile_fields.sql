-- מיגרציה 010: תפקיד ומוסד למשתמש
--
-- סבא (הערות 1 ו-4): "רצוי שלכל משתמש בנוסף לשמו ושם הרשות יהיה גם שדה
-- לתפקידו, ואם הוא מבית ספר שיהיה גם שם בית הספר"... "מאוד יכול להיות
-- שצריך להוסיף את השדה הזה גם במסך ניהול הרשאות".
--
-- שלושה שדות תיאוריים בלבד. הם **אינם** משפיעים על הרשאות — ההיקף בפועל
-- נקבע ב-scope_level/scope_values ונאכף ב-RLS. מוסד כאן הוא תווית תצוגה
-- ("שרה, מזכירה, מקיף גוונים"), לא מנגנון גישה.
--
-- בטוח להרצה חוזרת ואינו נוגע בנתונים קיימים.

alter table public.users
  add column if not exists job_title text;

alter table public.users
  add column if not exists institution_name text;

alter table public.users
  add column if not exists institution_code text;

comment on column public.users.job_title is
  'תפקיד לתצוגה — "מזכירת בית ספר", "מנהל אגף החינוך". תיאורי בלבד.';
comment on column public.users.institution_name is
  'שם המוסד למשתמש בית-ספרי. תיאורי בלבד; ההגבלה בפועל ב-scope_values.';
comment on column public.users.institution_code is
  'סמל המוסד לתצוגה לצד השם — סבא: "הכי טוב שניהם".';
