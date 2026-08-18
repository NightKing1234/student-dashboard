-- מיגרציה 011: עריכת פרטי רשות
--
-- עד היום אפשר היה רק *ליצור* רשות (`create_authority`), ולא לתקן אותה.
-- שם שהוקלד בטעות — "מועצת בדיקה" — נשאר לנצח, ואין דרך להשבית רשות
-- שאינה בשימוש בלי למחוק אותה על כל הנתונים שלה.
--
-- הרשאת העדכון ניתנת למנהל־על בלבד, באותה תבנית של `users` ו-`clients`
-- (מיגרציה 004). הקוד עצמו אינו ניתן לשינוי: הוא נכנס לשם טבלת התלמידים
-- (`students_{code}`), ושינוי שלו היה מנתק את הרשות מהנתונים שלה.

drop policy if exists authorities_update_super_admin on public.authorities;
create policy authorities_update_super_admin on public.authorities
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- הגנה: הקוד לא ישתנה גם אם מישהו ינסה לעדכן אותו ישירות
create or replace function public.protect_authority_code()
returns trigger
language plpgsql
as $$
begin
  if new.code is distinct from old.code then
    raise exception 'אי אפשר לשנות קוד רשות — הוא מזהה את טבלת התלמידים שלה';
  end if;
  return new;
end;
$$;

drop trigger if exists authorities_code_immutable on public.authorities;
create trigger authorities_code_immutable
  before update on public.authorities
  for each row execute function public.protect_authority_code();
