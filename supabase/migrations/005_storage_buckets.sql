-- מיגרציה 005: באקטים לאחסון קבצים + מדיניות גישה
--
-- שני באקטים, שניהם **פרטיים** — הקבצים מכילים מידע עסקי ותעודות זהות.
-- הצפייה נעשית דרך signed URL זמני בלבד (ראה documentUrl ב-lib/admin.ts).

insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('moe-uploads', 'moe-uploads', false)
on conflict (id) do nothing;

-- ─────────────── מסמכי לקוחות: מנהל-על בלבד ───────────────

drop policy if exists client_docs_read on storage.objects;
create policy client_docs_read on storage.objects
  for select to authenticated
  using (bucket_id = 'client-documents' and public.is_super_admin());

drop policy if exists client_docs_write on storage.objects;
create policy client_docs_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'client-documents' and public.is_super_admin());

drop policy if exists client_docs_delete on storage.objects;
create policy client_docs_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'client-documents' and public.is_super_admin());

-- ─────────────── קבצי מצב"ת: לפי שיוך לרשות ───────────────
-- שם הקובץ מתחיל בקוד הרשות (`{code}/{timestamp}/...`), ולכן החלק הראשון
-- בנתיב הוא קוד הרשות שאותו בודקים מול has_authority.

drop policy if exists moe_uploads_read on storage.objects;
create policy moe_uploads_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'moe-uploads'
    and (public.is_super_admin() or public.has_authority((storage.foldername(name))[1]))
  );

drop policy if exists moe_uploads_write on storage.objects;
create policy moe_uploads_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'moe-uploads'
    and (public.is_super_admin() or public.has_authority((storage.foldername(name))[1]))
  );

drop policy if exists moe_uploads_delete on storage.objects;
create policy moe_uploads_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'moe-uploads' and public.is_super_admin());
