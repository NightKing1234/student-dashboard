-- מיגרציה 013: מחיקת מועצה שנוצרה בטעות
--
-- עד היום אפשר היה ליצור רשות ולערוך אותה, אבל לא למחוק — ומועצה שהוזנה
-- עם נתונים שגויים נשארה לנצח. השבתה (`is_active`) מסתירה אותה מהתצוגה,
-- אך משאירה את כל הנתונים במסד. כשמדובר במועצה שמעולם לא הייתה לקוחה,
-- זו התשובה הלא נכונה: אין סיבה להחזיק תעודות זהות של אלפי קטינים.
--
-- ═══ למה זו פונקציה ולא מדיניות DELETE ═══
--
-- `delete from authorities` מפיל בשרשור רק שלושה דברים: כרטיס הלקוח,
-- רשומות המסמכים ורשומות ההעלאות. שלושה אחרים נשארים מאחור:
--
--   1. `students_{code}` — טבלה נפרדת, לא מפתח זר. הייתה נשארת עם כל
--      הנתונים ובלי RLS שמגן עליה, כי המדיניות מפנה לקוד שכבר לא קיים.
--   2. `users.authority_codes[]` — משתמש שהרשות היחידה שלו נמחקה היה
--      נשאר מחובר מול מערך שמצביע לשומקום.
--   3. קבצי ה-Storage — נמחקים מהדפדפן *לפני* הקריאה לכאן, כי מחיקת
--      `storage.objects` ב-SQL משאירה את הקובץ עצמו בבאקט.
--
-- לכן אין כאן מדיניות DELETE כלל: הפונקציה היא הדרך היחידה, והיא
-- security definer כדי לעקוף את ה-RLS אחרי שבדקה בעצמה מי הקורא.

-- ═══════════════════════════════════════════════════════════════
-- טבלת התבנית — אסור למחוק
-- ═══════════════════════════════════════════════════════════════
-- `students_1400000` היא המקור שממנו משוכפל המבנה בכל יצירת מועצה:
-- ב-`create_authority` (מיגרציה 006) וגם ב-`ensure_table` של הסוכן
-- (agent/worker.py, TEMPLATE_TABLE). מחיקתה הייתה חוסמת הוספת לקוח
-- חדש בשני המסלולים — בלי שגיאה עד שמישהו ינסה.
--
-- הקבוע כאן חייב להישאר זהה ל-TEMPLATE_TABLE שבסוכן.
create or replace function public.template_authority_code()
returns text language sql immutable as $$ select '1400000'::text $$;

comment on function public.template_authority_code() is
  'הרשות שטבלת התלמידים שלה משמשת תבנית ליצירת מועצות חדשות. חייב להתאים ל-TEMPLATE_TABLE ב-agent/worker.py.';


create or replace function public.delete_authority(
  target_code  text,
  confirm_name text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  auth_row      public.authorities%rowtype;
  tbl           text;
  student_rows  bigint := 0;
  users_touched int    := 0;
  uploads_count int    := 0;
  docs_count    int    := 0;
  busy          int    := 0;
begin
  if not public.is_super_admin() then
    raise exception 'נדרשת הרשאת מנהל־על';
  end if;

  -- הקוד נכנס לשם טבלה ב-format(%I) — ספרות בלבד, הגנה מפני SQL injection
  if target_code !~ '^[0-9]+$' then
    raise exception 'קוד רשות חייב להכיל ספרות בלבד';
  end if;

  select * into auth_row from public.authorities where code = target_code;
  if not found then
    raise exception 'רשות בקוד % אינה קיימת', target_code;
  end if;

  if target_code = public.template_authority_code() then
    raise exception
      'אי אפשר למחוק את % — טבלת התלמידים שלה היא התבנית שממנה נבנית כל מועצה חדשה',
      auth_row.name;
  end if;

  -- עדכון בעיבוד: הסוכן מחזיק את הקוד בזיכרון וכותב לטבלה. מחיקה עכשיו
  -- הייתה גורמת לו ליצור אותה מחדש ריקה ולטעון לתוך טבלה יתומה.
  select count(*) into busy
    from public.moe_uploads
   where authority_code = target_code
     and status in ('pending', 'processing');
  if busy > 0 then
    raise exception 'יש עדכון מצב"ת בעיבוד עבור %. יש להמתין לסיומו לפני המחיקה', auth_row.name;
  end if;

  -- אישור בהקלדה, נאכף כאן ולא רק בדפדפן: זו פעולה בלתי הפיכה
  if confirm_name is distinct from auth_row.name then
    raise exception 'שם האישור אינו תואם. יש להקליד בדיוק: %', auth_row.name;
  end if;

  tbl := 'students_' || target_code;

  if to_regclass('public.' || quote_ident(tbl)) is not null then
    execute format('select count(*) from public.%I', tbl) into student_rows;
  end if;

  select count(*) into uploads_count
    from public.moe_uploads where authority_code = target_code;
  select count(*) into docs_count
    from public.client_documents where authority_code = target_code;

  -- מסירים את השיוך לפני מחיקת הרשות, אחרת נשאר מערך שמצביע לשומקום
  update public.users
     set authority_codes = array_remove(authority_codes, target_code)
   where target_code = any(authority_codes);
  get diagnostics users_touched = row_count;

  -- מפיל גם את מדיניות ה-RLS והאינדקסים של הטבלה
  execute format('drop table if exists public.%I', tbl);

  -- clients, client_documents ו-moe_uploads נגררים ב-on delete cascade
  delete from public.authorities where code = target_code;

  return jsonb_build_object(
    'code',     target_code,
    'name',     auth_row.name,
    'students', student_rows,
    'users',    users_touched,
    'uploads',  uploads_count,
    'documents', docs_count
  );
end;
$$;

comment on function public.delete_authority(text, text) is
  'מוחקת מועצה על טבלת התלמידים, השיוכים והרשומות התלויות. מנהל־על בלבד, ודורשת הקלדת שם המועצה.';

grant execute on function public.delete_authority(text, text) to authenticated;
grant execute on function public.template_authority_code() to authenticated;
