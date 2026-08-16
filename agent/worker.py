"""
סוכן העיבוד — רץ ברקע על המחשב של סבא ומטפל בהעלאות מהאתר.

שני מקורות עבודה:

  א. העלאה מהאתר — כל 5 שניות בודק אם יש רשומה 'pending' ב-moe_uploads,
     מוריד את הקבצים מ-Storage ומעבד.

  ב. תיקיית מצב"ת מקומית — כל דקה סורק תיקייה שאליה מגיעים אוטומטית
     קובצי משרד החינוך של כל המועצות, מקבץ אותם לפי קוד הרשות, ומעבד כל
     מועצה שהקבצים שלה השתנו. נדרש MATZEVET_WATCH_FOLDER ב-.env.agent.

בשני המקרים אותה ליבה: pipeline -> גיבוי הטבלה הקיימת -> טעינה ל-Supabase,
והסטטוס מתועד ב-moe_uploads כך שנראה גם באתר.

הכל עטוף כך שתקלה בעדכון אחד לא מפילה את הסוכן.
"""
from __future__ import annotations

import argparse
import io
import json
import logging
import os
import shutil
import subprocess
import sys
import tempfile
import time
import traceback
from logging.handlers import RotatingFileHandler
from pathlib import Path

import pandas as pd
import psycopg2
import requests
import urllib3

# יירוט SSL ברשתות מסוימות (נטספארק וכד') — החיבור עדיין ל-Supabase
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

AGENT_DIR = Path(__file__).resolve().parent
DASHBOARD_DIR = AGENT_DIR.parent
PROJECT_ROOT = DASHBOARD_DIR.parent            # ...\ממשק אינטרנטי
PIPELINE_DIR = PROJECT_ROOT / "Itay_Modules" / "python_modules"
LOAD_SCRIPT = DASHBOARD_DIR / "scripts" / "load_main.py"

BACKUP_DIR = AGENT_DIR / "backups"
BACKUP_KEEP = 12          # כמה גיבויים לשמור לכל רשות (שנה של עדכונים חודשיים)

WATCH_STATE = AGENT_DIR / "watch-state.json"
WATCH_EVERY = 60          # כל כמה שניות לסרוק את תיקיית המצב"ת המקומית
FILE_SETTLE_SECONDS = 30  # קובץ שנגעו בו לאחרונה - ממתינים שהעתקתו תסתיים

# ששת הקבצים שמשרד החינוך מפיץ, לפי הקידומת בשם
MOE_PREFIXES = ("TALMIDIM", "PIRTEY_KESHER", "GORMEY_KESHER",
                "MEGAMOT", "MOSDOT", "KITOT")

UPLOADS_BUCKET = "moe-uploads"
MAIN_FILE_SUFFIX = "_Talmidim_gormey_kesher_pirtey_kesher_mosdot_megamot_kitot.xlsx"
TEMPLATE_TABLE = "students_1400000"   # התבנית שממנה משכפלים טבלה לרשות חדשה

log = logging.getLogger("agent")


# ═══════════════════════════ הגדרות ═══════════════════════════

def load_env_files() -> None:
    """טוען .env.db (חיבור ל-DB) ו-.env.agent (פרטי חשבון הסוכן)."""
    for name in (".env.db", ".env.agent"):
        path = DASHBOARD_DIR / name
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip())


def require(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        sys.exit(
            f"חסר משתנה סביבה {name}.\n"
            f"הגדר אותו ב-{DASHBOARD_DIR / '.env.db'} או ב-{DASHBOARD_DIR / '.env.agent'}"
        )
    return value


def setup_logging(verbose: bool) -> None:
    log_file = AGENT_DIR / "agent.log"
    fmt = logging.Formatter("%(asctime)s  %(levelname)-7s  %(message)s", "%Y-%m-%d %H:%M:%S")

    # קובץ מתגלגל — לא מתנפח לאורך חודשים של ריצה
    file_handler = RotatingFileHandler(log_file, maxBytes=2_000_000, backupCount=5,
                                       encoding="utf-8")
    file_handler.setFormatter(fmt)

    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(fmt)

    log.setLevel(logging.DEBUG if verbose else logging.INFO)
    log.addHandler(file_handler)
    log.addHandler(console)


# ═══════════════════════════ מסד הנתונים ═══════════════════════════

def connect():
    """
    autocommit=True בכוונה: כל פעולה כאן היא הצהרה בודדת, ו-SELECT שנשאר
    בטרנזקציה פתוחה מחזיק ACCESS SHARE על הטבלה — מה שחוסם את ה-TRUNCATE
    של הטעינה עד שפג לה הזמן. זה הפיל את העיבוד פעמיים לפני שאותר.
    """
    conn = psycopg2.connect(
        host=require("PGHOST"),
        port=int(os.environ.get("PGPORT", "5432")),
        dbname=os.environ.get("PGDATABASE", "postgres"),
        user=require("PGUSER"),
        password=require("PGPASSWORD"),
        sslmode="require",
        connect_timeout=20,
    )
    conn.autocommit = True
    return conn


def claim_next_upload(conn):
    """
    תופס העלאה ממתינה. ה-UPDATE ... WHERE status='pending' אטומי, ולכן שני
    סוכנים שירוצו במקביל לא יעבדו על אותה שורה.
    """
    with conn.cursor() as cur:
        cur.execute("""
            update public.moe_uploads
               set status = 'processing'
             where id = (
                   select id from public.moe_uploads
                    where status = 'pending'
                    order by uploaded_at
                    limit 1
                    for update skip locked)
            returning id, authority_code, storage_prefix, file_count
        """)
        row = cur.fetchone()
    if not row:
        return None
    return {"id": row[0], "code": row[1], "prefix": row[2], "files": row[3]}


def finish_upload(conn, upload_id, status, rows=None, error=None):
    with conn.cursor() as cur:
        cur.execute("""
            update public.moe_uploads
               set status = %s, processed_at = now(), rows_loaded = %s,
                   error_message = %s
             where id = %s
        """, (status, rows, (error or "")[:500] or None, upload_id))


def ensure_table(conn, code: str) -> bool:
    """
    מוודא שקיימת טבלת students_{code}. אם לא — משכפל את מבנה טבלת התבנית
    ומגדיר RLS זהה. מחזיר True אם נוצרה טבלה חדשה.
    """
    table = f"students_{code}"
    if not code.isdigit():
        raise ValueError(f"קוד רשות לא חוקי: {code}")

    with conn.cursor() as cur:
        cur.execute("select to_regclass(%s)", (f"public.{table}",))
        if cur.fetchone()[0]:
            return False

        log.info("טבלה %s אינה קיימת — יוצר אותה מהתבנית", table)
        cur.execute(
            f'create table public.{table} (like public.{TEMPLATE_TABLE} including all)')
        cur.execute(f'alter table public.{table} enable row level security')
        cur.execute(f"""
            create policy {table}_read on public.{table}
              for select to authenticated
              using (public.has_authority('{code}')
                     and public.in_user_scope("SEMEL_YISHUV1", "SEMEL_MOSAD"))
        """)
        cur.execute("""
            insert into public.authorities (code, name) values (%s, %s)
            on conflict (code) do nothing
        """, (code, f"רשות {code}"))
        cur.execute("""
            insert into public.clients (authority_code) values (%s)
            on conflict (authority_code) do nothing
        """, (code,))
    return True


def check_moe_code(conn, code: str, file_code: str) -> None:
    """
    מוודא שקובצי המצב"ת שייכים לרשות שאליה נרשמה ההעלאה.

    קוד הרשות אצלנו אינו בהכרח זה של משרד החינוך, ולכן ההשוואה היא מול
    `authorities.moe_code`. בעדכון הראשון השדה ריק — אז לומדים אותו.
    מכאן ואילך אי-התאמה עוצרת את העיבוד: היא מסמנת שהועלו קבצים של
    מועצה אחרת, וטעינה כזו הייתה דורסת רשות שלמה בנתונים זרים.
    """
    with conn.cursor() as cur:
        cur.execute("select moe_code from public.authorities where code = %s", (code,))
        row = cur.fetchone()
        known = row[0] if row else None

        if known is None:
            cur.execute("update public.authorities set moe_code = %s where code = %s",
                        (file_code, code))
            log.info("    קוד משרד החינוך לרשות %s נלמד: %s", code, file_code)
            return

    if known != file_code:
        raise RuntimeError(
            f"הקבצים אינם שייכים לרשות הזו. ההעלאה נרשמה לרשות {code} "
            f"(קוד משרד החינוך {known}), אך הקבצים הם של רשות {file_code}. "
            "יש להעלות אותם תחת המועצה הנכונה."
        )


def backup_table(conn, code: str) -> Path | None:
    """
    שומר עותק של הטבלה לפני שהיא נדרסת.

    הטעינה עושה TRUNCATE, ולכן בלי גיבוי אין דרך לחזור לנתונים הקודמים —
    למשל אם התברר שקובץ מצב"ת שהועלה היה שגוי.

    הקובץ נשמר כאקסל כדי שאפשר יהיה לפתוח אותו בלחיצה כפולה ולהשוות מול
    המצב הנוכחי. השליפה עצמה נעשית ב-COPY לקובץ זמני — הרבה יותר מהיר
    מקריאה שורה-שורה — ורק אז ממירים.

    מחזיר את נתיב הגיבוי, או None אם אין מה לגבות (טבלה ריקה/חדשה).
    """
    rows = table_count(conn, code)
    if rows == 0:
        return None

    folder = BACKUP_DIR / f"students_{code}"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"students_{code}_{time.strftime('%Y-%m-%d_%H%M')}.xlsx"

    # mkstemp מחזיר מתאר קובץ *פתוח*. בלי לסגור אותו הקובץ נשאר נעול
    # בווינדוס, וגם הכתיבה וגם המחיקה בסוף נכשלות.
    fd, tmp_name = tempfile.mkstemp(suffix=".csv", prefix="backup-")
    os.close(fd)
    tmp_csv = Path(tmp_name)
    try:
        with io.open(tmp_csv, "w", encoding="utf-8", newline="") as fh:
            with conn.cursor() as cur:
                cur.copy_expert(
                    f"copy public.students_{code} to stdout with csv header", fh)

        # dtype=str כדי שתעודות זהות וסמלי מוסד לא יומרו למספרים ויאבדו
        # אפסים מובילים, ולא יוצגו בכתיב מדעי.
        df = pd.read_csv(tmp_csv, dtype=str, keep_default_na=False, low_memory=False)
        with pd.ExcelWriter(path, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="תלמידים")
            # RTL מוגדר על תצוגת הגיליון, לא על החוברת
            writer.sheets["תלמידים"].sheet_view.rightToLeft = True
    finally:
        tmp_csv.unlink(missing_ok=True)

    size_mb = path.stat().st_size / 1024 / 1024
    log.info("    גובו %s שורות -> %s (%.1fMB)", f"{rows:,}", path.name, size_mb)

    prune_backups(folder)
    return path


def prune_backups(folder: Path) -> None:
    """משאיר רק את BACKUP_KEEP הגיבויים האחרונים, שהדיסק לא יתמלא."""
    files = sorted(folder.glob("*.xlsx"), key=lambda p: p.stat().st_mtime,
                   reverse=True)
    for old_file in files[BACKUP_KEEP:]:
        old_file.unlink(missing_ok=True)
        log.debug("    נמחק גיבוי ישן: %s", old_file.name)


def table_count(conn, code: str) -> int:
    with conn.cursor() as cur:
        cur.execute(f"select count(*) from public.students_{code}")
        return cur.fetchone()[0]


# ═══════════════════════════ Storage ═══════════════════════════
#
# הסוכן מזדהה כמשתמש רגיל (מייל+סיסמה) ולא עם מפתח service_role.
# הסיבה: service_role עוקף כל הגנה, ואם המחשב של סבא ייפרץ — הכל חשוף.
# חשבון ייעודי אפשר להשהות בלחיצה אחת ממסך ניהול ההרשאות.

_token_cache = {"value": None, "expires": 0.0}


def agent_token() -> str:
    """מחזיר טוקן תקף, ומתחבר מחדש כשהוא עומד לפוג."""
    if _token_cache["value"] and time.time() < _token_cache["expires"] - 60:
        return _token_cache["value"]

    url = require("SUPABASE_URL").rstrip("/")
    resp = requests.post(
        f"{url}/auth/v1/token?grant_type=password",
        headers={"apikey": require("SUPABASE_ANON_KEY"),
                 "Content-Type": "application/json"},
        json={"email": require("AGENT_EMAIL"), "password": require("AGENT_PASSWORD")},
        verify=False, timeout=60,
    )
    if resp.status_code >= 300:
        raise RuntimeError(
            "התחברות הסוכן נכשלה — בדוק את AGENT_EMAIL / AGENT_PASSWORD, "
            f"ושהחשבון אינו מושהה. ({resp.status_code})"
        )
    body = resp.json()
    _token_cache["value"] = body["access_token"]
    _token_cache["expires"] = time.time() + body.get("expires_in", 3600)
    log.debug("טוקן חדש התקבל")
    return _token_cache["value"]


def storage_headers() -> dict:
    return {"apikey": require("SUPABASE_ANON_KEY"),
            "Authorization": f"Bearer {agent_token()}"}


def download_files(prefix: str, target: Path) -> list:
    """מוריד את כל הקבצים שתחת ה-prefix בבאקט אל תיקייה מקומית."""
    url = require("SUPABASE_URL").rstrip("/")
    headers = storage_headers()

    resp = requests.post(
        f"{url}/storage/v1/object/list/{UPLOADS_BUCKET}",
        headers={**headers, "Content-Type": "application/json"},
        json={"prefix": prefix, "limit": 100,
              "sortBy": {"column": "name", "order": "asc"}},
        verify=False, timeout=60,
    )
    resp.raise_for_status()
    names = [item["name"] for item in resp.json() if item.get("name")]
    if not names:
        raise RuntimeError(f"לא נמצאו קבצים תחת {prefix}")

    target.mkdir(parents=True, exist_ok=True)
    downloaded = []
    for name in names:
        r = requests.get(f"{url}/storage/v1/object/{UPLOADS_BUCKET}/{prefix}/{name}",
                         headers=headers, verify=False, timeout=300)
        r.raise_for_status()
        (target / name).write_bytes(r.content)
        downloaded.append(name)
        log.info("   הורד %s (%.1fMB)", name, len(r.content) / 1024 / 1024)
    return downloaded


# ═══════════════════════════ עיבוד ═══════════════════════════

def run_pipeline(data_folder: Path) -> None:
    """מריץ את ה-pipeline של איתי על תיקיית הקבצים שהורדנו."""
    env = {
        **os.environ,
        "PYTHONIOENCODING": "utf-8",
        "MATZEVET_DATA_FOLDER": str(data_folder),
        "MATZEVET_OUTPUT_FOLDER": str(data_folder),
    }
    proc = subprocess.run(
        [sys.executable, "Main_Module_6_files_using_JSON.py"],
        cwd=str(PIPELINE_DIR), env=env,
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    if proc.returncode != 0:
        tail = (proc.stderr or proc.stdout or "")[-800:]
        raise RuntimeError(f"ה-pipeline נכשל (קוד {proc.returncode}):\n{tail}")
    log.debug("פלט ה-pipeline:\n%s", (proc.stdout or "")[-1500:])


def load_to_db(main_file: Path, code: str) -> None:
    proc = subprocess.run(
        [sys.executable, str(LOAD_SCRIPT), "--file", str(main_file), "--code", code],
        env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    if proc.returncode != 0:
        tail = (proc.stderr or proc.stdout or "")[-800:]
        raise RuntimeError(f"הטעינה נכשלה (קוד {proc.returncode}):\n{tail}")
    log.debug("פלט הטעינה:\n%s", (proc.stdout or "")[-800:])


def process_files(conn, code: str, work_dir: Path) -> int:
    """
    הליבה המשותפת: מקבלת תיקייה עם 6 קבצי מצב"ת של רשות אחת, מריצה את
    ה-pipeline, מגבה את הטבלה הקיימת וטוענת. מחזירה את מספר השורות.

    שני מקורות מגיעים לכאן — העלאה מהאתר וסריקת התיקייה המקומית.
    """
    log.info("2/5 מריץ את ה-pipeline…")
    started = time.time()
    run_pipeline(work_dir)
    log.info("    הסתיים ב-%.0f שניות", time.time() - started)

    matches = sorted(work_dir.glob(f"*{MAIN_FILE_SUFFIX}"),
                     key=lambda p: p.stat().st_mtime, reverse=True)
    if not matches:
        raise RuntimeError("ה-pipeline לא יצר קובץ ראשי")
    main_file = matches[0]

    # ה-pipeline גוזר את קוד הרשות משם קובץ המצב"ת, והוא לא בהכרח הקוד
    # שלנו (כפר = 120 אצלנו, 5108 במשרד החינוך). לכן ההשוואה היא מול
    # moe_code שנלמד בעדכון הראשון — כדי לתפוס את המקרה המסוכן: קבצים
    # של מועצה אחת שהועלו תחת מועצה אחרת.
    file_code = main_file.name[: -len(MAIN_FILE_SUFFIX)]
    check_moe_code(conn, code, file_code)
    log.info("    קובץ ראשי: %s (%.1fMB)",
             main_file.name, main_file.stat().st_size / 1024 / 1024)

    log.info("3/5 מוודא שהטבלה קיימת…")
    is_new = ensure_table(conn, code)
    if is_new:
        log.info("    נוצרה טבלה חדשה לרשות %s", code)

    # טבלה שזה עתה נוצרה ריקה — אין מה לגבות
    if is_new:
        log.info("4/5 גיבוי — מדולג (טבלה חדשה)")
    else:
        log.info("4/5 מגבה את הטבלה הנוכחית…")
        backup_table(conn, code)

    log.info("5/5 טוען ל-Supabase…")
    load_to_db(main_file, code)
    return table_count(conn, code)


def process(conn, job) -> None:
    """העלאה שהגיעה מהאתר: מוריד מ-Storage ומעביר לליבה."""
    code = job["code"]
    log.info("═" * 60)
    log.info("העלאה מהאתר — רשות %s (%s קבצים)", code, job["files"])

    work_dir = Path(tempfile.mkdtemp(prefix=f"matzevet-{code}-"))
    try:
        log.info("1/5 מוריד קבצים…")
        download_files(job["prefix"], work_dir)
        rows = process_files(conn, code, work_dir)
        finish_upload(conn, job["id"], "done", rows=rows)
        log.info("✓ הושלם — %s שורות בטבלה students_%s", f"{rows:,}", code)
    except Exception as exc:
        log.error("✗ נכשל: %s", exc)
        log.debug(traceback.format_exc())
        try:
            finish_upload(conn, job["id"], "failed", error=str(exc))
        except Exception:
            log.exception("לא הצלחתי לעדכן את סטטוס הכישלון")
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


# ═══════════════ סריקת תיקיית המצב"ת המקומית ═══════════════
#
# על המחשב של סבא יש תיקייה שאליה מגיעים קובצי המצב"ת של כל המועצות.
# הסוכן סורק אותה, מקבץ את הקבצים לפי קוד הרשות, ומעבד כל מועצה
# שהקבצים שלה השתנו מאז הפעם הקודמת.


def load_watch_state() -> dict:
    if WATCH_STATE.exists():
        try:
            return json.loads(WATCH_STATE.read_text(encoding="utf-8"))
        except Exception:
            log.warning("קובץ המצב פגום — מתחילים מחדש")
    return {}


def save_watch_state(state: dict) -> None:
    WATCH_STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2),
                           encoding="utf-8")


def authority_moe_codes(conn) -> dict:
    """מיפוי קוד משרד החינוך -> קוד הרשות אצלנו."""
    with conn.cursor() as cur:
        cur.execute("""select code, moe_code from public.authorities
                        where moe_code is not null and is_active""")
        return {moe: code for code, moe in cur.fetchall()}


def group_files_by_authority(folder: Path, moe_codes: dict) -> dict:
    """
    מקבץ את קובצי ה-CSV בתיקייה לפי רשות.

    ההתאמה היא על *מילה שלמה* בשם הקובץ ולא על הכלה, כדי שקוד קצר
    כמו 120 לא ייתפס בטעות בתוך חותמת תאריך.
    """
    groups: dict = {}
    for path in folder.glob("*.csv"):
        tokens = set(path.stem.split("_"))
        moe = next((m for m in moe_codes if m in tokens), None)
        if not moe:
            continue
        prefix = next((p for p in MOE_PREFIXES if path.name.upper().startswith(p)), None)
        if not prefix:
            continue
        # אם יש כמה גרסאות לאותה קידומת — לוקחים את העדכנית
        current = groups.setdefault(moe, {}).get(prefix)
        if current is None or path.stat().st_mtime > current.stat().st_mtime:
            groups[moe][prefix] = path
    return groups


def fingerprint(files: dict) -> str:
    """טביעת אצבע של קבוצת קבצים — משתנה רק כשהתוכן באמת התחלף."""
    parts = []
    for prefix in sorted(files):
        st = files[prefix].stat()
        parts.append(f"{files[prefix].name}:{st.st_size}:{int(st.st_mtime)}")
    return "|".join(parts)


def files_settled(files: dict) -> bool:
    """קובץ שעדיין מועתק לתיקייה — לא נוגעים בו עד שיירגע."""
    now = time.time()
    return all(now - f.stat().st_mtime > FILE_SETTLE_SECONDS for f in files.values())


def record_local_run(conn, code: str, folder: Path):
    """רושם את הריצה ב-moe_uploads כדי שתופיע בהיסטוריה באתר."""
    with conn.cursor() as cur:
        cur.execute("""
            insert into public.moe_uploads
                   (authority_code, storage_prefix, file_count, status)
            values (%s, %s, 6, 'processing') returning id
        """, (code, f"מהתיקייה המקומית: {folder}"))
        return cur.fetchone()[0]


def scan_watch_folder(conn, folder: Path) -> None:
    if not folder.is_dir():
        log.warning("תיקיית המצב\"ת לא נמצאה: %s", folder)
        return

    state = load_watch_state()
    moe_codes = authority_moe_codes(conn)
    if not moe_codes:
        return

    groups = group_files_by_authority(folder, moe_codes)

    for moe, files in sorted(groups.items()):
        code = moe_codes[moe]
        missing = [p for p in MOE_PREFIXES if p not in files]
        if missing:
            log.debug("רשות %s — חסרים %s, מדלג", code, ", ".join(missing))
            continue

        fp = fingerprint(files)
        if state.get(code) == fp:
            continue                      # כבר עובד, שום דבר לא השתנה

        if not files_settled(files):
            log.info("רשות %s — הקבצים עדיין בהעתקה, ממתין", code)
            continue

        log.info("═" * 60)
        log.info("קבצים חדשים בתיקייה — רשות %s (קוד מש\"ח %s)", code, moe)

        # מעתיקים רק את ששת הקבצים של הרשות הזו: ה-pipeline בוחר קובץ לפי
        # קידומת מתוך התיקייה, ואם יש בה כמה מועצות הוא היה מערבב ביניהן.
        work_dir = Path(tempfile.mkdtemp(prefix=f"matzevet-local-{code}-"))
        upload_id = None
        try:
            for path in files.values():
                shutil.copy2(path, work_dir / path.name)
            log.info("1/5 הועתקו 6 קבצים לעיבוד")

            upload_id = record_local_run(conn, code, folder)
            rows = process_files(conn, code, work_dir)

            finish_upload(conn, upload_id, "done", rows=rows)
            state[code] = fp
            save_watch_state(state)
            log.info("✓ הושלם — %s שורות בטבלה students_%s", f"{rows:,}", code)

        except Exception as exc:
            log.error("✗ נכשל: %s", exc)
            log.debug(traceback.format_exc())
            if upload_id:
                try:
                    finish_upload(conn, upload_id, "failed", error=str(exc))
                except Exception:
                    pass
            # לא שומרים את טביעת האצבע — כך ננסה שוב בסבב הבא
        finally:
            shutil.rmtree(work_dir, ignore_errors=True)


# ═══════════════════════════ הלולאה ═══════════════════════════

def main() -> None:
    ap = argparse.ArgumentParser(description="סוכן עיבוד קבצי מצב\"ת")
    ap.add_argument("--interval", type=int, default=5, help="כל כמה שניות לבדוק (ברירת מחדל 5)")
    ap.add_argument("--once", action="store_true", help="לעבד העלאה אחת ולצאת")
    ap.add_argument("--verbose", action="store_true", help="לוג מפורט")
    ap.add_argument("--watch-folder",
                    help='תיקיית קובצי מצב"ת מקומית (ברירת מחדל: MATZEVET_WATCH_FOLDER)')
    ap.add_argument("--no-watch", action="store_true",
                    help="לא לסרוק את התיקייה המקומית")
    args = ap.parse_args()

    load_env_files()
    setup_logging(args.verbose)

    log.info("סוכן העיבוד עלה. בודק כל %s שניות.", args.interval)
    log.info("pipeline: %s", PIPELINE_DIR)
    if not PIPELINE_DIR.exists():
        sys.exit(f"לא נמצאה תיקיית ה-pipeline: {PIPELINE_DIR}")

    # תיקיית מצב"ת מקומית — אופציונלית. בלעדיה הסוכן עובד רק מול האתר.
    watch_folder = None
    if not args.no_watch:
        raw = args.watch_folder or os.environ.get("MATZEVET_WATCH_FOLDER", "").strip()
        if raw:
            watch_folder = Path(raw)
            log.info('תיקיית מצב"ת מקומית: %s (סריקה כל %s שניות)',
                     watch_folder, WATCH_EVERY)
        else:
            log.info('לא הוגדרה תיקיית מצב"ת מקומית — עובד מול האתר בלבד')

    last_scan = 0.0

    # ריצה שנקטעה משאירה תיקיית עבודה זמנית. מנקים בעלייה כדי שלא
    # יצטברו עשרות תיקיות של 10MB לאורך חודשים.
    stale = 0
    for leftover in Path(tempfile.gettempdir()).glob("matzevet-*"):
        if leftover.is_dir() and time.time() - leftover.stat().st_mtime > 3600:
            shutil.rmtree(leftover, ignore_errors=True)
            stale += 1
    if stale:
        log.info("נוקו %s תיקיות עבודה שנשארו מריצות קודמות", stale)

    conn = None
    idle_logged = False

    while True:
        try:
            if conn is None or conn.closed:
                conn = connect()
                log.info("מחובר ל-Supabase")

            # מצב בדיקה: סבב אחד של כל מקורות העבודה, ואז יציאה.
            # (התנאי הקודם בדק רק אם הייתה העלאה מהאתר, ולכן כשהעבודה הגיעה
            #  מהתיקייה המקומית הלולאה לא הסתיימה לעולם.)
            if args.once:
                if watch_folder:
                    scan_watch_folder(conn, watch_folder)
                job = claim_next_upload(conn)
                if job:
                    process(conn, job)
                else:
                    log.info("אין העלאות ממתינות באתר")
                log.info("סבב בדיקה הסתיים")
                break

            job = claim_next_upload(conn)
            if job:
                idle_logged = False
                process(conn, job)
            else:
                if not idle_logged:
                    log.info("אין העלאות ממתינות — ממתין…")
                    idle_logged = True

            # סריקת התיקייה המקומית — בקצב נפרד, איטי יותר מהתשאול
            if watch_folder and time.time() - last_scan > WATCH_EVERY:
                last_scan = time.time()
                scan_watch_folder(conn, watch_folder)

        except KeyboardInterrupt:
            log.info("הופסק ידנית")
            break
        except Exception:
            # תקלת רשת או ניתוק DB — סוגרים, ישנים, ומתחברים מחדש בסבב הבא
            log.exception("שגיאה בלולאה — מנסה שוב בעוד %s שניות", args.interval)
            try:
                if conn:
                    conn.close()
            except Exception:
                pass
            conn = None

        time.sleep(args.interval)

    if conn:
        conn.close()


if __name__ == "__main__":
    main()
