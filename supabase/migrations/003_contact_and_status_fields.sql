-- 003 — שדות פרטי קשר שחסרו במילון + מצב רישום התלמיד.
-- כל העמודות text: הן מגיעות מהקובץ כטקסט, ו'תא ריק במקור נשאר ריק באתר'.

alter table public.students_1400000 add column if not exists "MATZAV_RISHUM_CODE" text;
alter table public.students_1400000 add column if not exists "MATZAV_RISHUM_TEUR" text;
alter table public.students_1400000 add column if not exists "NAYACH_1_talmid" text;
alter table public.students_1400000 add column if not exists "NAYACH_2_talmid" text;
alter table public.students_1400000 add column if not exists "NAYAD_1_talmid" text;
alter table public.students_1400000 add column if not exists "NAYAD_2_talmid" text;
alter table public.students_1400000 add column if not exists "EMAIL_talmid" text;
alter table public.students_1400000 add column if not exists "NAYACH_1_parent1" text;
alter table public.students_1400000 add column if not exists "NAYACH_2_parent1" text;
alter table public.students_1400000 add column if not exists "NAYAD_1_parent1" text;
alter table public.students_1400000 add column if not exists "NAYAD_2_parent1" text;
alter table public.students_1400000 add column if not exists "NAYAD_2B_parent1" text;
alter table public.students_1400000 add column if not exists "YISHUV_MIRSHAM_parent1" text;
alter table public.students_1400000 add column if not exists "RECHOV_MIRSHAM_parent1" text;
alter table public.students_1400000 add column if not exists "MISPAR_BAYIT_MIRSHAM_parent1" text;
alter table public.students_1400000 add column if not exists "MISPAR_DIRA_MIRSHAM_parent1" text;
alter table public.students_1400000 add column if not exists "MIKUD_MIRSHAM_parent1" text;
alter table public.students_1400000 add column if not exists "SHCHUNA_parent1" text;
alter table public.students_1400000 add column if not exists "KNISA_parent1" text;
alter table public.students_1400000 add column if not exists "TA_DOAR_parent1" text;
alter table public.students_1400000 add column if not exists "DOAR_NA_parent1" text;
alter table public.students_1400000 add column if not exists "HEARA_parent1" text;
alter table public.students_1400000 add column if not exists "STATUS_HATZHARAT_MENAHEL_parent1" text;
alter table public.students_1400000 add column if not exists "NAYACH_1_parent2" text;
alter table public.students_1400000 add column if not exists "NAYACH_2_parent2" text;
alter table public.students_1400000 add column if not exists "NAYAD_1_parent2" text;
alter table public.students_1400000 add column if not exists "NAYAD_2_parent2" text;
alter table public.students_1400000 add column if not exists "NAYAD_2B_parent2" text;
alter table public.students_1400000 add column if not exists "EMAIL_parent2" text;
alter table public.students_1400000 add column if not exists "YISHUV_MIRSHAM_parent2" text;
alter table public.students_1400000 add column if not exists "RECHOV_MIRSHAM_parent2" text;
alter table public.students_1400000 add column if not exists "MISPAR_BAYIT_MIRSHAM_parent2" text;
alter table public.students_1400000 add column if not exists "MISPAR_DIRA_MIRSHAM_parent2" text;
alter table public.students_1400000 add column if not exists "STATUS_HATZHARAT_MENAHEL_parent2" text;
alter table public.students_1400000 add column if not exists "HAIM_PIRTEY_KESHER_TALMID_parent2" text;
alter table public.students_1400000 add column if not exists "SHEM_MUTAV" text;
alter table public.students_1400000 add column if not exists "BAYISHUV_MICHUTZ" text;
alter table public.students_1400000 add column if not exists "HERKEV" text;
alter table public.students_1400000 add column if not exists "SHLAV_HINUCH_TALMID" text;
alter table public.students_1400000 add column if not exists "SHEM_RASHUT_MEGURIM_TALMID" text;
alter table public.students_1400000 add column if not exists "HAIM_LESHIBUTZ_TEUR" text;
alter table public.students_1400000 add column if not exists "TEUR_STATUS_RISHUM_MOE" text;
alter table public.students_1400000 add column if not exists "TEUR_ZAKAUT_LSCHAR_LIMUD" text;
alter table public.students_1400000 add column if not exists "CODE_SUG_SHGIAT_DIVUACH" text;
alter table public.students_1400000 add column if not exists "TEUR_SUG_SHGIAT_DIVUACH" text;
alter table public.students_1400000 add column if not exists "TAARICH_STATUS_ISHUR_MEGAMA" text;
alter table public.students_1400000 add column if not exists "MICHSAT_TALMIDIM_MEUSHERET" text;
alter table public.students_1400000 add column if not exists "HEARA_STATUS_ISHUR_MEGAMA" text;

-- אינדקס לסינון מהיר לפי מצב רישום (משובץ / עזב / מועמד ...)
create index if not exists students_1400000_matzav_rishum_idx
    on public.students_1400000 ("MATZAV_RISHUM_CODE");
