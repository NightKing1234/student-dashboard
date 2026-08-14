-- מיגרציה 008: מנהל־על רואה את כל הרשויות
--
-- הבעיה: has_authority בדק רק את authority_codes של המשתמש. מנהל־על שמנהל
-- את כל הלקוחות לא היה משויך ידנית לכל רשות, ולכן:
--   * כרטיסי הלקוח הראו 0 תלמידים לרשויות שלא שויכו אליו
--   * כניסה לטבלה של רשות אחרת החזירה ריק
--
-- הפתרון: מנהל־על עובר את הבדיקה עבור כל רשות. זה תואם למה שהוא כבר יכול
-- לעשות ממילא — לערוך לקוחות, לנהל הרשאות וליצור רשויות חדשות.
--
-- מנהל־על מושהה עדיין נחסם (הבדיקה נשארת בפנים).

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
      and (role = 'super_admin' or code = any(authority_codes))
  );
$$;
