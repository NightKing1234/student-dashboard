-- מיגרציה 012: עדכון מצב"ת — מנהל רשות בלבד
--
-- סבא (19.8): "אם אני נותן את זה למנהל בית ספר או למנהל גיל הרך — אני
-- לא רוצה שזה יעדכן... זה צריך להיות רק ברמה של מנהל רשות."
--
-- הממשק כבר מסתיר את הכפתור מצופה, אבל ה-RLS התיר את הפעולה לכל מי
-- שמשויך לרשות — כולל `viewer`. כלומר מנהל בית ספר עם גישת צפייה יכול
-- היה לפנות ישירות ל-API, להעלות שישה קבצים, ולגרום לטעינה מחדש של כל
-- הרשות. הסתרה בתצוגה אינה הרשאה.
--
-- מכאן: העלאה דורשת `role in ('admin','super_admin')`. הצפייה בהיסטוריית
-- העדכונים נשארת פתוחה לכל מי שמשויך לרשות — היא אינה משנה דבר.

create or replace function public.may_update_moe(code text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and not is_suspended
      and (
        role = 'super_admin'
        or (role = 'admin' and code = any(authority_codes))
      )
  );
$$;

comment on function public.may_update_moe(text) is
  'האם המשתמש רשאי להעלות קובצי מצב"ת לרשות — מנהל רשות או מנהל־על בלבד.';

-- רישום ההעלאה
drop policy if exists moe_uploads_insert on public.moe_uploads;
create policy moe_uploads_insert on public.moe_uploads
  for insert to authenticated
  with check (public.may_update_moe(authority_code));

-- העלאת הקבצים עצמם לבאקט
drop policy if exists moe_uploads_write on storage.objects;
create policy moe_uploads_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'moe-uploads'
    and public.may_update_moe((storage.foldername(name))[1])
  );
