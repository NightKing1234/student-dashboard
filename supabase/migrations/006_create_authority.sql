-- מיגרציה 006: הוספת מועצה חדשה מתוך הממשק
--
-- הוספת רשות אינה רק שורה בטבלה — לפי עקרון "רשות = עולם" צריך גם
-- טבלת תלמידים משלה, RLS משלה ואינדקסים. הפונקציה הזו עושה את הכל
-- בפעולה אחת, כדי שסבא יוכל להוסיף מועצה בלי שאף אחד יריץ SQL ידנית.
--
-- security definer — הפונקציה יוצרת טבלאות, אבל בודקת בעצמה שהקורא
-- הוא מנהל-על לפני שהיא נוגעת במשהו.

create or replace function public.create_authority(
  new_code text,
  new_name text
)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  table_name text;
begin
  if not public.is_super_admin() then
    raise exception 'נדרשת הרשאת מנהל־על';
  end if;

  -- קוד הרשות נכנס לשם טבלה, ולכן חייב להיות ספרות בלבד (הגנה מפני SQL injection)
  if new_code !~ '^[0-9]+$' then
    raise exception 'קוד רשות חייב להכיל ספרות בלבד';
  end if;

  if coalesce(trim(new_name), '') = '' then
    raise exception 'חובה להזין שם רשות';
  end if;

  if exists (select 1 from public.authorities where code = new_code) then
    raise exception 'רשות בקוד % כבר קיימת', new_code;
  end if;

  table_name := 'students_' || new_code;

  insert into public.authorities (code, name) values (new_code, trim(new_name));
  insert into public.clients (authority_code) values (new_code);

  -- הטבלה נוצרת כהעתק מבני של הרשות הראשונה — אותן עמודות, מפתח ואינדקסים.
  -- including all מעתיק גם ברירות מחדל, אילוצים ואינדקסים, אך לא נתונים.
  execute format(
    'create table if not exists public.%I (like public.students_1400000 including all)',
    table_name
  );

  execute format('alter table public.%I enable row level security', table_name);

  -- אותה מדיניות כמו בשאר הרשויות: שיוך לרשות *וגם* היקף בתוך הרשות.
  execute format(
    'create policy %I on public.%I for select to authenticated
       using (public.has_authority(%L) and public.in_user_scope("SEMEL_YISHUV1", "SEMEL_MOSAD"))',
    table_name || '_read', table_name, new_code
  );

  return table_name;
end;
$$;

-- הרשאת קריאה לפונקציה; הבדיקה הפנימית היא זו שמגינה בפועל
grant execute on function public.create_authority(text, text) to authenticated;
