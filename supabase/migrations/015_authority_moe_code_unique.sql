-- מיגרציה 015: קוד משרד החינוך ייחודי למועצה
--
-- ═══ ההקשר ═══
--
-- `moe_code` ([מיגרציה 009](009_authority_moe_code.sql)) הוא הקוד שבשמות
-- קובצי המצב"ת, ואינו בהכרח הקוד שלנו (כפר = 120 אצלנו, 5108 שם). הסוכן
-- לומד אותו לבד בעדכון הראשון של כל מועצה (`check_moe_code` ב-worker.py),
-- ומכאן ואילך משתמש בו לשני דברים:
--
--   1. לחסום העלאה של קבצי מועצה אחת תחת מועצה אחרת.
--   2. לשייך קבצים בתיקייה הנסרקת למועצה שלהם — `authority_moe_codes`
--      בונה מילון שה**מפתח** בו הוא `moe_code`.
--
-- ═══ הבעיה ═══
--
-- לא היה שום אילוץ שמונע משתי מועצות לשאת את אותו `moe_code`. זה קורה
-- כשבעדכון הראשון של מועצה חדשה מועלים בטעות הקבצים של מועצה אחרת:
-- השדה ריק, ולכן הסוכן "לומד" את הקוד השגוי בלי להתלונן.
--
-- מאותו רגע המילון של `authority_moe_codes` מכיל מפתח אחד לשתי רשויות,
-- אחת דורסת את השנייה בסדר לא מוגדר, ו**הקבצים בתיקייה מנותבים למועצה
-- הלא נכונה** — בלי שגיאה, ועם TRUNCATE בסוף הדרך.
--
-- ═══ למה כאן ולא בסוכן ═══
--
-- אפשר היה להוסיף בדיקה ב-`check_moe_code`, אבל אז היא חיה על מחשב אחד
-- ודורשת עדכון שלו בכל שינוי. במסד היא תקפה לכל סוכן, לכל גרסה, וגם
-- לעריכה ידנית ב-SQL Editor. אותו שיקול כמו ב-011 (`protect_authority_code`)
-- וב-012 (`may_update_moe`).
--
-- הסוכן אינו משתנה: ה-UPDATE שלו פשוט נכשל במקום להצליח בשקט. הוא רץ
-- **לפני** הגיבוי והטעינה, ולכן ההעלאה נעצרת כשעוד לא נגענו בשום נתון,
-- מסומנת `failed` ב-moe_uploads, והסיבה מוצגת באתר.

-- ═══════════════════════════════════════════════════════════════
-- א. בדיקה מקדימה — האם כבר יש כפילות
-- ═══════════════════════════════════════════════════════════════
-- בלי זה, יצירת האינדקס נכשלת בהודעת Postgres שאינה אומרת *אילו* מועצות
-- מתנגשות. כאן נופלים עם רשימה, לפני שנגענו במשהו.

do $$
declare
  dupes text;
begin
  select string_agg(format('%s ← %s', moe_code, codes), ' · ')
    into dupes
    from (
      select moe_code, string_agg(code, ', ' order by code) as codes
        from public.authorities
       where moe_code is not null
       group by moe_code
      having count(*) > 1
    ) d;

  if dupes is not null then
    raise exception
      'לא ניתן להוסיף את האילוץ — קיימות מועצות שחולקות קוד משרד חינוך: %. '
      'יש להכריע איזו מהן נכונה, לתקן או לרוקן את השאר, ולהריץ שוב.', dupes;
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- ב. האילוץ עצמו
-- ═══════════════════════════════════════════════════════════════
-- אינדקס **חלקי**: `NULL` מותר לכמה מועצות במקביל — כך נראית כל מועצה
-- שטרם עברה עדכון ראשון, והיא חייבת להישאר חוקית.
--
-- האילוץ חל גם על מועצה מושבתת. היא עדיין מחזיקה את הקוד שלה, ואם
-- תוחזר לפעילות אחרי שהקוד ניתן לאחרת — נחזור בדיוק לניתוב הדו-משמעי
-- שהמיגרציה הזו באה למנוע.

create unique index if not exists authorities_moe_code_unique
  on public.authorities (moe_code)
  where moe_code is not null;

comment on index public.authorities_moe_code_unique is
  'קוד משרד החינוך ייחודי למועצה. NULL מותר — מועצה שטרם עברה עדכון ראשון.';

-- ═══════════════════════════════════════════════════════════════
-- ג. הודעה בעברית
-- ═══════════════════════════════════════════════════════════════
-- האינדקס הוא ההבטחה; הטריגר הוא ההסבר. בלעדיו ההודעה שמגיעה למסך
-- ההעלאות היא `duplicate key value violates unique constraint`, שאינה
-- אומרת למי שקורא אותה מה קרה ומה לעשות.
--
-- הטריגר אינו מחליף את האינדקס: שתי עסקאות מקבילות יכולות לעבור אותו
-- יחד, והאינדקס הוא זה שיעצור את השנייה.

create or replace function public.protect_moe_code_unique()
returns trigger
language plpgsql
as $$
declare
  taken_code text;
  taken_name text;
begin
  if new.moe_code is null then
    return new;
  end if;

  -- עדכון שלא נגע בעמודה (שינוי שם, השבתה) אינו מעניין אותנו.
  -- התנאי מקונן ולא מחובר ב-and: ב-INSERT אין `old`, ו-PL/pgSQL מעריך
  -- את הביטוי כולו כשאילתה אחת — בלי קיצור דרך — ולכן היה נופל על
  -- "record old is not assigned yet".
  if tg_op = 'UPDATE' then
    if new.moe_code is not distinct from old.moe_code then
      return new;
    end if;
  end if;

  select code, name into taken_code, taken_name
    from public.authorities
   where moe_code = new.moe_code
     and code <> new.code
   limit 1;

  if found then
    raise exception
      'קוד משרד החינוך % כבר משויך למועצה "%" (קוד %). '
      'אם הקבצים שהועלו שייכים למועצה ההיא — יש להעלות אותם תחתיה. '
      'אם הקוד הישן שגוי — יש לתקן אותו שם תחילה.',
      new.moe_code, taken_name, taken_code;
  end if;

  return new;
end;
$$;

comment on function public.protect_moe_code_unique() is
  'מונע שיוך אותו קוד משרד חינוך לשתי מועצות — ניתוב קבצים דו-משמעי בסוכן.';

drop trigger if exists authorities_moe_code_unique_check on public.authorities;
create trigger authorities_moe_code_unique_check
  before insert or update of moe_code on public.authorities
  for each row execute function public.protect_moe_code_unique();
