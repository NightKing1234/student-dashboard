"""
עדכון חודשי מקצה לקצה: קבצי מצב"ת -> pipeline של איתי -> Supabase.

מריץ את שני השלבים ברצף:
  1. ה-pipeline של איתי (Main_Module_6_files_using_JSON.py) — 8 מודולים שמייצרים
     שני קבצי אקסל בתיקיית הפלט שמוגדרת ב-config/merge_files.json.
     הקבצים נשמרים על הדיסק ונשארים שם.
  2. טעינת *הקובץ הראשי* שנוצר לטבלת students_{code} ב-Supabase (load_main.py).

הקובץ הראשי הוא `{code}_Talmidim_gormey_kesher_pirtey_kesher_mosdot_megamot_kitot.xlsx`
(נכתב ע"י מודול 7). קובץ התוספתים (`{code}_additional_fields_filled.xlsx`, מודול 8)
נוצר גם הוא אבל אינו נטען — הוא מיועד לשלב ד'.

שימוש (משתני סביבה: PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE):
    python scripts/update_from_moe.py --code 1400000

דגלים שימושיים:
    --skip-pipeline    לדלג על ה-pipeline ולטעון את הקובץ הקיים (למשל אחרי כשל טעינה)
    --pipeline-only    להריץ רק את ה-pipeline בלי לגעת ב-Supabase
    --file <path>      לטעון קובץ ספציפי במקום לאתר אוטומטית
    --max-age <דקות>   כמה "טרי" חייב הקובץ להיות אחרי ריצת pipeline (ברירת מחדל 120)
"""
import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPTS_DIR.parent.parent  # ...\ממשק אינטרנטי
PIPELINE_DIR = PROJECT_ROOT / "Itay_Modules" / "python_modules"
PIPELINE_ENTRY = PIPELINE_DIR / "Main_Module_6_files_using_JSON.py"
PIPELINE_CONFIG = PIPELINE_DIR / "config" / "merge_files.json"
LOAD_SCRIPT = SCRIPTS_DIR / "load_main.py"
ENV_DB_FILE = SCRIPTS_DIR.parent / ".env.db"

MAIN_FILE_SUFFIX = "_Talmidim_gormey_kesher_pirtey_kesher_mosdot_megamot_kitot.xlsx"
EXTRA_FILE_SUFFIX = "_additional_fields_filled.xlsx"

PG_VARS = ["PGHOST", "PGUSER", "PGPASSWORD"]


def log(msg=""):
    print(msg, flush=True)


def step(n, title):
    log()
    log("=" * 62)
    log(f"  שלב {n} — {title}")
    log("=" * 62)


def read_pipeline_config():
    """
    קורא את קונפיג ה-pipeline ופותר נתיבים יחסיים מול תיקיית ה-pipeline —
    אותה לוגיקה בדיוק כמו ב-Main_Module_6_files_using_JSON.py, כדי ששני
    הצדדים יסתכלו על אותן תיקיות גם אחרי מעבר לשרת.
    """
    if not PIPELINE_CONFIG.exists():
        sys.exit(f"לא נמצא קובץ הקונפיג של ה-pipeline: {PIPELINE_CONFIG}")
    with open(PIPELINE_CONFIG, encoding="utf-8") as f:
        cfg = json.load(f)

    env_overrides = {
        "dictionary_folder": "MATZEVET_DICT_FOLDER",
        "data_folder": "MATZEVET_DATA_FOLDER",
        "output_folder": "MATZEVET_OUTPUT_FOLDER",
    }
    for key, env_var in env_overrides.items():
        raw = os.environ.get(env_var) or cfg.get(key, "")
        path = Path(raw).expanduser()
        if not path.is_absolute():
            path = (PIPELINE_DIR / path).resolve()
        cfg[key] = str(path)
    return cfg


def load_env_db():
    """טוען פרטי חיבור מ-.env.db אם קיים. משתני סביבה קיימים גוברים עליו."""
    if not ENV_DB_FILE.exists():
        return False
    for line in ENV_DB_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())
    return True


def check_db_env():
    """בדיקה מוקדמת — עדיף להיכשל עכשיו מאשר אחרי ריצת pipeline ארוכה."""
    if load_env_db():
        log(f"פרטי חיבור נטענו מ-{ENV_DB_FILE.name}")

    missing = [v for v in PG_VARS if not os.environ.get(v)]
    if missing:
        sys.exit(
            "חסרים משתני סביבה לחיבור ל-DB: " + ", ".join(missing) + "\n\n"
            f"הגדר אותם ב-{ENV_DB_FILE} או בסביבה.\n"
            "לדוגמה (PowerShell):\n"
            '  $env:PGHOST = "aws-1-ap-southeast-2.pooler.supabase.com"\n'
            '  $env:PGPORT = "5432"\n'
            '  $env:PGUSER = "postgres.agcoeqshvkyopjjdvril"\n'
            '  $env:PGPASSWORD = "<db-password>"\n'
            '  $env:PGDATABASE = "postgres"'
        )


def run_pipeline():
    """מריץ את ה-pipeline של איתי בתיקייה שלו (הוא מייבא modules.* יחסית)."""
    if not PIPELINE_ENTRY.exists():
        sys.exit(f"לא נמצא ה-pipeline: {PIPELINE_ENTRY}")

    started = time.time()
    proc = subprocess.run(
        [sys.executable, PIPELINE_ENTRY.name],
        cwd=str(PIPELINE_DIR),
        env={**os.environ, "PYTHONIOENCODING": "utf-8"},
    )
    if proc.returncode != 0:
        sys.exit(
            f"\nה-pipeline נכשל (קוד יציאה {proc.returncode}). "
            "Supabase לא נגעה — הנתונים הקיימים נשארו כמו שהם."
        )
    log(f"\nה-pipeline הסתיים בהצלחה ({time.time() - started:.0f} שניות)")


def find_main_file(output_folder, code):
    """מאתר את הקובץ הראשי. אם ניתן קוד רשות — מחפש אותו במפורש."""
    folder = Path(output_folder)
    if not folder.is_dir():
        sys.exit(f"תיקיית הפלט לא קיימת: {folder}")

    if code:
        exact = folder / f"{code}{MAIN_FILE_SUFFIX}"
        if exact.exists():
            return exact

    matches = sorted(
        folder.glob(f"*{MAIN_FILE_SUFFIX}"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not matches:
        sys.exit(f"לא נמצא קובץ ראשי (*{MAIN_FILE_SUFFIX}) בתיקייה {folder}")
    if len(matches) > 1:
        log(f"נמצאו {len(matches)} קבצים ראשיים — נבחר העדכני ביותר")
    return matches[0]


def code_from_filename(path):
    return path.name[: -len(MAIN_FILE_SUFFIX)]


def check_freshness(path, max_age_minutes):
    """מוודא שהקובץ באמת נוצר בריצה הזו ולא נשאר מריצה קודמת."""
    age_min = (time.time() - path.stat().st_mtime) / 60
    if age_min > max_age_minutes:
        sys.exit(
            f"הקובץ {path.name} עודכן לפני {age_min:.0f} דקות — נראה שה-pipeline לא כתב אותו מחדש.\n"
            "אם זה בכל זאת הקובץ הנכון, הרץ שוב עם --skip-pipeline או הגדל את --max-age."
        )


def load_to_supabase(main_file, code):
    proc = subprocess.run(
        [
            sys.executable,
            str(LOAD_SCRIPT),
            "--file", str(main_file),
            "--code", code,
        ],
        env={**os.environ, "PYTHONIOENCODING": "utf-8"},
    )
    if proc.returncode != 0:
        sys.exit(f"\nהטעינה ל-Supabase נכשלה (קוד יציאה {proc.returncode}).")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--code", help="קוד הרשות, למשל 1400000 (ברירת מחדל: מזוהה משם הקובץ)")
    ap.add_argument("--file", help="נתיב לקובץ ראשי ספציפי (עוקף את האיתור האוטומטי)")
    ap.add_argument("--skip-pipeline", action="store_true", help="לטעון בלי להריץ את ה-pipeline")
    ap.add_argument("--pipeline-only", action="store_true", help="להריץ pipeline בלי לטעון")
    ap.add_argument("--max-age", type=int, default=120, help="גיל מרבי לקובץ בדקות (ברירת מחדל 120)")
    ap.add_argument("--dry-run", action="store_true", help="לאתר ולדווח בלי לטעון ל-Supabase")
    args = ap.parse_args()

    if args.skip_pipeline and args.pipeline_only:
        sys.exit("--skip-pipeline ו---pipeline-only סותרים זה את זה")

    cfg = read_pipeline_config()
    log(f"תיקיית קלט (קבצי מצב\"ת):  {cfg['data_folder']}")
    log(f"תיקיית פלט (קבצי אקסל):    {cfg['output_folder']}")

    if not args.pipeline_only:
        check_db_env()

    # ---------- שלב 1: ה-pipeline ----------
    ran_pipeline = False
    if args.skip_pipeline:
        log("\n(דילוג על ה-pipeline לפי בקשה)")
    else:
        step(1, "הרצת ה-pipeline של איתי (8 מודולים)")
        run_pipeline()
        ran_pipeline = True

    if args.pipeline_only:
        log("\n(--pipeline-only — Supabase לא עודכנה)")
        return

    # ---------- שלב 2: איתור הקובץ הראשי ----------
    step(2, "איתור הקובץ הראשי")
    if args.file:
        main_file = Path(args.file)
        if not main_file.exists():
            sys.exit(f"הקובץ לא נמצא: {main_file}")
    else:
        main_file = find_main_file(cfg["output_folder"], args.code)

    code = args.code or code_from_filename(main_file)
    if not code.isdigit():
        sys.exit(f"לא הצלחתי לזהות את קוד הרשות משם הקובץ ({main_file.name}) — העבר --code במפורש")

    mtime = datetime.fromtimestamp(main_file.stat().st_mtime)
    size_mb = main_file.stat().st_size / 1024 / 1024
    log(f"קובץ ראשי:  {main_file.name}")
    log(f"עודכן:      {mtime:%Y-%m-%d %H:%M}   ({size_mb:.1f}MB)")
    log(f"קוד רשות:   {code}")

    if ran_pipeline:
        check_freshness(main_file, args.max_age)

    extra_file = main_file.parent / f"{code}{EXTRA_FILE_SUFFIX}"
    if extra_file.exists():
        log(f"\nקובץ התוספתים נוצר גם הוא ({extra_file.name}) — אינו נטען (שלב ד').")

    # ---------- שלב 3: טעינה ל-Supabase ----------
    if args.dry_run:
        log(f"\n(--dry-run — כאן הייתה נטענת students_{code}. Supabase לא נגעה.)")
        return

    step(3, f"טעינה לטבלה students_{code}")
    log("שים לב: הטבלה נדרסת (TRUNCATE) ונטענת מחדש.\n")
    load_to_supabase(main_file, code)

    log()
    log("=" * 62)
    log("  הסתיים. הנתונים באתר מעודכנים.")
    log("=" * 62)


if __name__ == "__main__":
    main()
