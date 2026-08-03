# תיעוד הפרויקט

Vault תיעוד (Obsidian) לפרויקט ממשק ניהול נתוני תלמידים.

## מסמכים

| מסמך | תיאור |
|------|--------|
| [project-spec.md](project-spec.md) | **מסמך האפיון המלא** — מקור האמת לדרישות |
| [architecture.md](architecture.md) | סקירת הארכיטקטורה, שלוש השכבות, מבנה תיקיות |
| [database.md](database.md) | סכימת ה-DB, טבלאות, RLS, שדות מחושבים |
| [data-loading.md](data-loading.md) | טעינת נתונים מקבצי ה-pipeline ל-Supabase |
| [features.md](features.md) | מיפוי פיצ'רים של שלב א' לקוד |
| [setup-and-run.md](setup-and-run.md) | מדריך הקמה והרצה מאפס |
| [server-migration.md](server-migration.md) | מה רץ איפה, והעברת ה-pipeline לשרת |
| [dev-log.md](dev-log.md) | יומן פיתוח כרונולוגי |
| [decisions/](decisions/) | החלטות טכניות |
| [meetings/](meetings/) | סיכומי פגישות |

## התחלה מהירה
1. לקרוא את [architecture.md](architecture.md) להבנת המבנה.
2. לעקוב אחר [setup-and-run.md](setup-and-run.md) להקמה והרצה.
3. לעיין ב-[features.md](features.md) לראות מה מומש.

## סטטוס נוכחי

**שלב א' מומש, והמערכת חיה בענן.**

- 🌐 האתר: https://astounding-pudding-d07e8f.netlify.app
- 🗄 Supabase: 8,244 תלמידים (רשות 1400000), 165 עמודות
- 🔄 עדכון חודשי: `python scripts/update_from_moe.py --code 1400000`

ראה [dev-log.md](dev-log.md) לפרטים ו-[decisions/003](decisions/003-unified-pipeline-and-cloud.md)
להחלטות האחרונות.
