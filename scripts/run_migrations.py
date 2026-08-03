"""
מריץ את כל קבצי ה-SQL מתיקיית supabase/migrations לפי סדר שמם, מול מסד ה-Supabase.
פרטי החיבור נלקחים ממשתני סביבה (לא נשמרים בקוד):
    PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD
שימוש:
    python run_migrations.py
"""
import glob
import os
import sys

import psycopg2

MIGRATIONS_DIR = os.path.join(os.path.dirname(__file__), "..", "supabase", "migrations")


def main():
    conn = psycopg2.connect(
        host=os.environ["PGHOST"],
        port=int(os.environ.get("PGPORT", "5432")),
        dbname=os.environ.get("PGDATABASE", "postgres"),
        user=os.environ["PGUSER"],
        password=os.environ["PGPASSWORD"],
        sslmode="require",
        connect_timeout=20,
    )
    conn.autocommit = False
    files = sorted(glob.glob(os.path.join(MIGRATIONS_DIR, "*.sql")))
    if not files:
        sys.exit("לא נמצאו קבצי מיגרציה")

    for path in files:
        name = os.path.basename(path)
        sql = open(path, encoding="utf-8").read()
        print(f"מריץ {name} ...", flush=True)
        try:
            with conn.cursor() as cur:
                cur.execute(sql)
            conn.commit()
            print(f"  ✓ {name} הושלם")
        except Exception as e:
            conn.rollback()
            sys.exit(f"  ✗ שגיאה ב-{name}: {e}")

    conn.close()
    print("כל המיגרציות הורצו בהצלחה.")


if __name__ == "__main__":
    main()
