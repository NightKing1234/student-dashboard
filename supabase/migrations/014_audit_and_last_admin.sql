-- מיגרציה 014: יומן פעולות ניהול, והגנה על מנהל־העל האחרון
--
-- ב-29.8 התגלה שחשבון המנהל־על `eyal.yinnon@gmail.com` נמחק אי-שם בין
-- ה-21 ל-29 בחודש. הגילוי היה מקרי — רק בגלל השוואה לתמונת מצב ישנה
-- שנלקחה במקרה. **לא היה שום תיעוד של מי מחק, מה, ומתי.**
--
-- שני חורים נחשפו:
--   א. אין יומן. פעולה הרסנית לא משאירה עקבה.
--   ב. אין רצפה. מנהל־על יכול למחוק את עצמו או את האחרון שנשאר, ואז
--      אף אחד לא יכול ליצור מנהל־על חדש מהממשק — רק דרך SQL ישיר.
--
-- הערה: `auth.audit_log_entries` של Supabase קיימת אך **ריקה** בפרויקט
-- הזה, ולכן אי אפשר להישען עליה.

-- ═══════════════════════════════════════════════════════════════
-- חשבונות שירות
-- ═══════════════════════════════════════════════════════════════
-- `agent@matzevet.local` הוא מנהל־על, אבל הוא הסוכן ולא בן אדם. אם
-- הוא ייחשב "מנהל־על שנשאר", אפשר יהיה למחוק את כל בני האדם והמערכת
-- תיראה תקינה — בעוד שאיש לא יוכל להיכנס ולתקן.
alter table public.users
  add column if not exists is_service_account boolean not null default false;

comment on column public.users.is_service_account is
  'חשבון מכונה (הסוכן). אינו נספר כמנהל־על אנושי בהגנת "האחרון שנשאר".';

update public.users set is_service_account = true
 where email = 'agent@matzevet.local' and not is_service_account;

-- ═══════════════════════════════════════════════════════════════
-- א. הגנה על מנהל־העל האחרון
-- ═══════════════════════════════════════════════════════════════
-- מכסה שלוש דרכים לאבד את האחרון: מחיקה, השהיה, והורדת תפקיד.
-- המחיקה מגיעה בפועל בשרשור מ-`auth.users` דרך ה-Edge Function, ולכן
-- ההגנה חייבת לשבת כאן ולא בפונקציה — כאן היא תופסת בכל מסלול.

create or replace function public.protect_last_super_admin()
returns trigger
language plpgsql
as $$
declare
  was_active boolean;
  still_active boolean;
begin
  was_active := old.role = 'super_admin'
                and not old.is_suspended
                and not old.is_service_account;

  if not was_active then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'UPDATE' then
    still_active := new.role = 'super_admin'
                    and not new.is_suspended
                    and not new.is_service_account;
    if still_active then
      return new;
    end if;
  end if;

  if exists (
    select 1 from public.users
     where id <> old.id
       and role = 'super_admin'
       and not is_suspended
       and not is_service_account
  ) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  raise exception
    'זהו מנהל־העל האחרון (%). אי אפשר למחוק, להשהות או להוריד בתפקיד — '
    'אחרת לא יישאר אף אחד שיוכל ליצור מנהל־על חדש מהממשק. '
    'יש להגדיר מנהל־על נוסף תחילה.', old.email;
end;
$$;

drop trigger if exists users_protect_last_super_admin on public.users;
create trigger users_protect_last_super_admin
  before update or delete on public.users
  for each row execute function public.protect_last_super_admin();

-- ═══════════════════════════════════════════════════════════════
-- ב. יומן פעולות ניהול
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.admin_audit (
  id           bigserial primary key,
  at           timestamptz not null default now(),
  actor_id     uuid,          -- מי ביצע, כשידוע
  actor_email  text,          -- משוכפל בכוונה: שורד את מחיקת המבצע
  via          text not null, -- 'user' (JWT) / 'service_role' / 'direct'
  action       text not null, -- insert / update / delete
  entity       text not null, -- user / authority
  entity_id    text,
  entity_label text,          -- מייל או שם רשות — לקריאה בלי join
  changes      jsonb          -- update: מה השתנה. insert/delete: השורה
);

create index if not exists admin_audit_at_idx on public.admin_audit (at desc);
create index if not exists admin_audit_entity_idx
  on public.admin_audit (entity, entity_id, at desc);

comment on table public.admin_audit is
  'יומן פעולות ניהול על משתמשים ורשויות. נכתב בטריגר בלבד — אי אפשר לערוך או למחוק ממנו.';

-- קריאה למנהל־על בלבד. **אין** מדיניות insert/update/delete בכוונה:
-- הטריגר הוא security definer ועוקף RLS, ולכן אף אחד — כולל מנהל־על —
-- אינו יכול לשכתב את היומן דרך ה-API. יומן שאפשר לערוך אינו יומן.
alter table public.admin_audit enable row level security;

drop policy if exists admin_audit_read on public.admin_audit;
create policy admin_audit_read on public.admin_audit
  for select to authenticated
  using (public.is_super_admin());

create or replace function public.audit_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  o        jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n        jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  rec      jsonb := coalesce(n, o);
  entity   text  := tg_argv[0];
  id_col   text  := tg_argv[1];
  label_col text := tg_argv[2];
  a_id     uuid  := auth.uid();
  a_email  text;
  source   text;
  diff     jsonb;
begin
  if a_id is not null then
    source := 'user';
    select email into a_email from public.users where id = a_id;
  else
    -- קריאה מה-Edge Function רצה עם service_role ואין בה sub, ולכן
    -- המבצע אינו ידוע. עדיין מתעדים — "מה ומתי" הוא רוב הערך.
    source := coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
      'direct');
  end if;

  if tg_op = 'UPDATE' then
    select jsonb_object_agg(key, jsonb_build_object('לפני', o.value, 'אחרי', n2.value))
      into diff
      from jsonb_each(o) o
      join jsonb_each(n) n2 using (key)
     where o.value is distinct from n2.value;

    if diff is null then          -- עדכון שלא שינה דבר
      return new;
    end if;
  else
    diff := rec;
  end if;

  insert into public.admin_audit
         (actor_id, actor_email, via, action, entity, entity_id, entity_label, changes)
  values (a_id, a_email, source, lower(tg_op), entity,
          rec ->> id_col, rec ->> label_col, diff);

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists users_audit on public.users;
create trigger users_audit
  after insert or update or delete on public.users
  for each row execute function public.audit_change('user', 'id', 'email');

drop trigger if exists authorities_audit on public.authorities;
create trigger authorities_audit
  after insert or update or delete on public.authorities
  for each row execute function public.audit_change('authority', 'code', 'name');
