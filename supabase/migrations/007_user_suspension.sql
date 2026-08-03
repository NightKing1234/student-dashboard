-- מיגרציה 007: השהיית משתמש
--
-- ההשהיה נאכפת בשני רבדים:
--   1. ב-Auth — הפונקציה admin-users מטילה ban, וכך הכניסה עצמה נחסמת.
--   2. כאן — הדגל is_suspended מנטרל את פונקציות ההרשאה, כך שגם אם למשתמש
--      נשאר טוקן תקף מלפני ההשהיה, הוא לא יראה שום נתון עד לפקיעתו.

alter table public.users
  add column if not exists is_suspended boolean not null default false;

-- משתמש מושהה אינו משויך לאף רשות, בפועל.
create or replace function public.has_authority(code text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and not is_suspended
      and code = any(authority_codes)
  );
$$;

-- וגם אינו בהיקף של שום שורה.
create or replace function public.in_user_scope(semel_yishuv text, semel_mosad text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select case
           when u.is_suspended then false
           when u.scope_level = 'council'  then true
           when u.scope_level = 'locality' then semel_yishuv = any(u.scope_values)
           when u.scope_level = 'school'   then semel_mosad  = any(u.scope_values)
           else false
         end
  from public.users u
  where u.id = auth.uid();
$$;

-- מנהל-על מושהה מאבד גם את גישת הניהול.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and not is_suspended
      and role = 'super_admin'
  );
$$;
