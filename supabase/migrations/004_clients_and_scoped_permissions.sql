-- מיגרציה 004: ניהול לקוחות והרשאות ברמת יישוב/בית ספר
--
-- שני נושאים:
--   א. טבלאות ניהול הלקוחות (התנהלות עסקית + מסמכים) — למסך המנהל.
--   ב. הרחבת ההרשאות משלוש רמות: מועצתי / יישובי / בית-ספרי.
--
-- עקרון "רשות = עולם" נשמר: ההרשאה החדשה רק *מצמצמת* בתוך רשות שהמשתמש
-- כבר משויך אליה. אי אפשר להרחיב גישה דרך scope.

-- ═══════════════════════════════════════════════════════════════
-- א. לקוחות
-- ═══════════════════════════════════════════════════════════════

-- כרטיס לקוח לכל מועצה אזורית. מקושר ל-authorities בקוד הרשות.
create table if not exists public.clients (
  authority_code     text primary key references public.authorities(code) on delete cascade,
  contact_name       text,                      -- איש קשר ברשות
  contact_email      text,
  contact_phone      text,
  -- התנהלות עסקית
  last_payment_date  date,                      -- מתי שולם לאחרונה
  next_payment_date  date,                      -- מתי התשלום הבא
  contract_renewal   date,                      -- מתי לחדש את ההסכם
  annual_fee         numeric(10, 2),            -- עלות שנתית (₪)
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- מסמכים מצורפים לכרטיס הלקוח. הקובץ עצמו ב-Storage; כאן המטא-דאטה.
create table if not exists public.client_documents (
  id              uuid primary key default gen_random_uuid(),
  authority_code  text not null references public.authorities(code) on delete cascade,
  title           text not null,                -- שם לתצוגה
  storage_path    text not null,                -- הנתיב בבאקט client-documents
  mime_type       text,
  size_bytes      bigint,
  uploaded_by     uuid references public.users(id),
  uploaded_at     timestamptz not null default now()
);

create index if not exists client_documents_authority_idx
  on public.client_documents (authority_code, uploaded_at desc);

-- ═══════════════════════════════════════════════════════════════
-- ב. הרשאות ברמת יישוב / בית ספר
-- ═══════════════════════════════════════════════════════════════

-- רמת ההיקף של המשתמש בתוך הרשות:
--   council — רואה את כל תלמידי הרשות (ברירת מחדל, ההתנהגות הקיימת)
--   locality — רואה רק יישובים מסוימים (לפי SEMEL_YISHUV1)
--   school   — רואה רק מוסדות מסוימים (לפי SEMEL_MOSAD)
alter table public.users
  add column if not exists scope_level text not null default 'council'
  check (scope_level in ('council', 'locality', 'school'));

-- הערכים המותרים ברמת ההיקף (סמלי יישוב או סמלי מוסד).
-- ריק כאשר scope_level = 'council'.
alter table public.users
  add column if not exists scope_values text[] not null default '{}';

-- פונקציית עזר: האם השורה הנוכחית בטווח ההיקף של המשתמש.
-- מקבלת את סמל היישוב וסמל המוסד של השורה ומחזירה true/false.
-- security definer — קוראת מ-public.users שחסומה ב-RLS.
create or replace function public.in_user_scope(semel_yishuv text, semel_mosad text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select case u.scope_level
           when 'council'  then true
           when 'locality' then semel_yishuv = any(u.scope_values)
           when 'school'   then semel_mosad  = any(u.scope_values)
           else false
         end
  from public.users u
  where u.id = auth.uid();
$$;

-- ═══════════════════════════════════════════════════════════════
-- ג. עדכון ה-RLS של טבלת התלמידים
-- ═══════════════════════════════════════════════════════════════
-- שתי בדיקות מצטברות: שיוך לרשות (כמו קודם) *וגם* היקף בתוך הרשות.
-- לכל רשות נוספת יש לחזור על שתי השורות האלה עם קוד הרשות שלה.

drop policy if exists students_1400000_read on public.students_1400000;
create policy students_1400000_read on public.students_1400000
  for select to authenticated
  using (
    public.has_authority('1400000')
    and public.in_user_scope("SEMEL_YISHUV1", "SEMEL_MOSAD")
  );

-- אינדקסים לתמיכה בסינון ההיקף
create index if not exists students_1400000_semel_yishuv_idx
  on public.students_1400000 ("SEMEL_YISHUV1");
create index if not exists students_1400000_semel_mosad_idx
  on public.students_1400000 ("SEMEL_MOSAD");

-- ═══════════════════════════════════════════════════════════════
-- ד. מעקב אחר העלאות קבצי מצב"ת
-- ═══════════════════════════════════════════════════════════════
-- הקבצים עולים ל-Storage; העיבוד עצמו רץ בפייתון (pandas) מחוץ לענן.
-- הטבלה הזו היא תור העבודה: update_from_moe.py מוריד, מעבד, ומסמן.

create table if not exists public.moe_uploads (
  id              uuid primary key default gen_random_uuid(),
  authority_code  text not null references public.authorities(code) on delete cascade,
  status          text not null default 'pending'
                  check (status in ('pending', 'processing', 'done', 'failed')),
  file_count      int not null default 0,
  storage_prefix  text not null,               -- התיקייה בבאקט moe-uploads
  uploaded_by     uuid references public.users(id),
  uploaded_at     timestamptz not null default now(),
  processed_at    timestamptz,
  rows_loaded     int,
  error_message   text
);

create index if not exists moe_uploads_pending_idx
  on public.moe_uploads (authority_code, status, uploaded_at desc);

-- ═══════════════════════════════════════════════════════════════
-- ה. RLS לטבלאות החדשות
-- ═══════════════════════════════════════════════════════════════

alter table public.clients          enable row level security;
alter table public.client_documents enable row level security;
alter table public.moe_uploads      enable row level security;

-- האם המשתמש הנוכחי הוא מנהל-על (סבא). מסך המנהל כולו מותנה בזה.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'super_admin'
  );
$$;

-- לקוחות ומסמכים: מנהל-על בלבד. אלה נתונים עסקיים, לא של הרשות.
drop policy if exists clients_super_admin on public.clients;
create policy clients_super_admin on public.clients
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists client_documents_super_admin on public.client_documents;
create policy client_documents_super_admin on public.client_documents
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- העלאות: מנהל-על רואה הכל; משתמש רגיל רואה ומעלה רק ברשות שלו.
drop policy if exists moe_uploads_read on public.moe_uploads;
create policy moe_uploads_read on public.moe_uploads
  for select to authenticated
  using (public.is_super_admin() or public.has_authority(authority_code));

drop policy if exists moe_uploads_insert on public.moe_uploads;
create policy moe_uploads_insert on public.moe_uploads
  for insert to authenticated
  with check (public.is_super_admin() or public.has_authority(authority_code));

-- מנהל-על קורא את כל רשומות המשתמשים (למסך ניהול ההרשאות);
-- משתמש רגיל ממשיך לקרוא רק את עצמו.
drop policy if exists users_read_self on public.users;
create policy users_read_self on public.users
  for select to authenticated
  using (id = auth.uid() or public.is_super_admin());

-- מנהל-על מעדכן תפקיד, שיוך לרשות והיקף. משתמש רגיל אינו יכול לשנות
-- את ההרשאות של עצמו — זו הסיבה שאין כאן `id = auth.uid()`.
drop policy if exists users_update_super_admin on public.users;
create policy users_update_super_admin on public.users
  for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ═══════════════════════════════════════════════════════════════
-- ו. שורת לקוח לרשות הקיימת
-- ═══════════════════════════════════════════════════════════════

insert into public.clients (authority_code)
values ('1400000')
on conflict (authority_code) do nothing;
