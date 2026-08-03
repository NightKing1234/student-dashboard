-- מיגרציה 001: משתמשים, רשויות והרשאות (אפיון §3)
-- "רשות = עולם": כל משתמש רואה רק את הרשויות המשויכות אליו.

-- טבלת רשויות (מטא) — רשימת הרשויות במערכת
create table if not exists public.authorities (
  code        text primary key,          -- קוד הרשות, למשל '1400000'
  name        text not null,             -- שם הרשות לתצוגה
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- טבלת משתמשים — מקושרת ל-auth.users, עם שיוך לרשויות
create table if not exists public.users (
  id               uuid primary key references auth.users on delete cascade,
  email            text not null,
  display_name     text,
  role             text not null default 'viewer'
                   check (role in ('viewer', 'admin', 'super_admin')),
  authority_codes  text[] not null default '{}',   -- הרשויות שהמשתמש משויך אליהן
  created_at       timestamptz not null default now()
);

-- יצירת רשומת משתמש אוטומטית בעת הרשמה ב-Auth
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, display_name, role, authority_codes)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', null),
    coalesce(new.raw_user_meta_data ->> 'role', 'viewer'),
    coalesce(
      (select array_agg(value) from jsonb_array_elements_text(
        coalesce(new.raw_user_meta_data -> 'authority_codes', '[]'::jsonb))),
      '{}'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- RLS
alter table public.authorities enable row level security;
alter table public.users enable row level security;

-- כל משתמש מאומת יכול לקרוא את רשימת הרשויות
drop policy if exists authorities_read on public.authorities;
create policy authorities_read on public.authorities
  for select to authenticated using (true);

-- משתמש קורא רק את הרשומה של עצמו
drop policy if exists users_read_self on public.users;
create policy users_read_self on public.users
  for select to authenticated using (id = auth.uid());

-- פונקציית עזר: האם למשתמש הנוכחי יש הרשאה לרשות מסוימת
create or replace function public.has_authority(code text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and code = any(authority_codes)
  );
$$;
