"""
סוכן העיבוד — רץ ברקע על המחשב של סבא ומטפל בהעלאות מהאתר.

מחזור העבודה:
  1. בודק ב-Supabase אם יש העלאה בסטטוס 'pending'
  2. תופס אותה (מסמן 'processing') כדי ששני סוכנים לא יעבדו על אותה העלאה
  3. מוריד את 6 הקבצים מ-Storage לתיקייה זמנית
  4. מריץ את ה-pipeline של איתי על התיקייה הזו
  5. טוען את הקובץ הראשי לטבלת students_{code} — ויוצר אותה אם אינה קיימת
  6. מסמן 'done' עם מספר השורות, או 'failed' עם הודעת השגיאה

הכל עטוף כך שתקלה בהעלאה אחת לא מפילה את הסוכן.
"""
from __future__ import annotations

import argparse
import gzip
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
    return psycopg2.connect(
        host=require("PGHOST"),
        port=int(os.environ.get("PGPORT", "5432")),
        dbname=os.environ.get("PGDATABASE", "postgres"),
        user=require("PGUSER"),
        password=require("PGPASSWORD"),
        sslmode="require",
        connect_timeout=20,
    )


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
    conn.commit()
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
    conn.commit()


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
    conn.commit()
    return True


def backup_table(conn, code: str) -> Path | None:
    """
    שומר עותק של הטבלה לפני שהיא נדרסת.

    הטעינה עושה TRUNCATE, ולכן בלי גיבוי אין דרך לחזור לנתונים הקודמים —
    למשל אם התברר שקובץ מצב"ת שהועלה היה שגוי. הקובץ נשמר כ-CSV דחוס
    בתיקיית backups שליד הסוכן.

    מחזיר את נתיב הגיבוי, או None אם אין מה לגבות (טבלה ריקה/חדשה).
    """
    rows = table_count(conn, code)
    if rows == 0:
        return None

    folder = BACKUP_DIR / f"students_{code}"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"students_{code}_{time.strftime('%Y-%m-%d_%H%M')}.csv.gz"

    try:
        with gzip.open(path, "wt", encoding="utf-8-sig", newline="") as fh:
            with conn.cursor() as cur:
                cur.copy_expert(
                    f"copy public.students_{code} to stdout with csv header", fh)
    finally:
        # חובה לסגור את הטרנזקציה: ה-COPY מחזיק נעילה על הטבלה, ובלי סגירה
        # ה-TRUNCATE של הטעינה ייתקע עד שיפוג לו הזמן.
        conn.commit()

    size_mb = path.stat().st_size / 1024 / 1024
    log.info("    גובו %s שורות -> %s (%.1fMB)", f"{rows:,}", path.name, size_mb)

    prune_backups(folder)
    return path


def prune_backups(folder: Path) -> None:
    """משאיר רק את BACKUP_KEEP הגיבויים האחרונים, שהדיסק לא יתמלא."""
    files = sorted(folder.glob("*.csv.gz"), key=lambda p: p.stat().st_mtime,
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


def process(conn, job) -> None:
    code = job["code"]
    log.info("═" * 60)
    log.info("העלאה חדשה — רשות %s (%s קבצים)", code, job["files"])

    work_dir = Path(tempfile.mkdtemp(prefix=f"matzevet-{code}-"))
    try:
        log.info("1/5 מוריד קבצים…")
        download_files(job["prefix"], work_dir)

        log.info("2/5 מריץ את ה-pipeline…")
        started = time.time()
        run_pipeline(work_dir)
        log.info("    הסתיים ב-%.0f שניות", time.time() - started)

        matches = sorted(work_dir.glob(f"*{MAIN_FILE_SUFFIX}"),
                         key=lambda p: p.stat().st_mtime, reverse=True)
        if not matches:
            raise RuntimeError("ה-pipeline לא יצר קובץ ראשי")
        main_file = matches[0]
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
        rows = table_count(conn, code)

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


# ═══════════════════════════ הלולאה ═══════════════════════════

def main() -> None:
    ap = argparse.ArgumentParser(description="סוכן עיבוד קבצי מצב\"ת")
    ap.add_argument("--interval", type=int, default=5, help="כל כמה שניות לבדוק (ברירת מחדל 5)")
    ap.add_argument("--once", action="store_true", help="לעבד העלאה אחת ולצאת")
    ap.add_argument("--verbose", action="store_true", help="לוג מפורט")
    args = ap.parse_args()

    load_env_files()
    setup_logging(args.verbose)

    log.info("סוכן העיבוד עלה. בודק כל %s שניות.", args.interval)
    log.info("pipeline: %s", PIPELINE_DIR)
    if not PIPELINE_DIR.exists():
        sys.exit(f"לא נמצאה תיקיית ה-pipeline: {PIPELINE_DIR}")

    conn = None
    idle_logged = False

    while True:
        try:
            if conn is None or conn.closed:
                conn = connect()
                log.info("מחובר ל-Supabase")

            job = claim_next_upload(conn)
            if job:
                idle_logged = False
                process(conn, job)
            else:
                if not idle_logged:
                    log.info("אין העלאות ממתינות — ממתין…")
                    idle_logged = True

            if args.once and job:
                break

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
