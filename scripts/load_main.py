"""
טעינת הקובץ הראשי (פלט ה-pipeline, כותרות בעברית) לטבלת students_{code}
ישירות דרך חיבור ה-DB (psycopg2). מבצע:
  - מיפוי access_name (עברית) -> python_name (עמודות ה-DB) לפי המילון
  - התאמה רק לעמודות שקיימות בטבלה
  - מיפוי מועדף לתוויות דו-משמעיות (למשל "שם מלא1" -> FULL_NAME)
  - חישוב שדה "כיתה (משולב)" מתוך "מקבילה" (ט5 -> ט-5)
  - המרת סוגים: תאריכים ומספרים, ערכים לא-תקינים / 'NaN' -> NULL
  - הסרת כפילויות לפי תעודת זהות (מפתח ראשי)
  - TRUNCATE + הכנסה בבאצ'ים (הטבלה נדרסת בכל עדכון חודשי)

שימוש (משתני סביבה: PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE):
    python load_main.py --file <path.xlsx> --code 1400000 --dict <dict.xlsx>
"""
import argparse
import os
import re
import sys

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

DEFAULT_DICT = os.path.join(
    os.path.dirname(__file__), "..", "..", "Itay_Modules", "tables", "columns_name_dictionary.xlsx"
)

# תוויות עברית שמופיעות במילון עבור יותר מעמודה אחת — כאן קובעים לאיזו עמודה
# הן ימופו (העמודות שה-UI משתמש בהן), כדי למנוע מיפוי לעמודה הלא-נכונה.
PREFERRED_MAPPING = {
    "שם מלא1": "GOREM_KESHER_1_FULL_NAME",
    "שם מלא2": "GOREM_KESHER_2_FULL_NAME",
}

# ערכי טקסט שנחשבים ריקים (מגיעים מ-pandas/אקסל)
NULL_TOKENS = {"", "nan", "none", "nat", "null"}


def build_he_to_py(dict_path):
    d = pd.read_excel(dict_path)
    m = {}
    for _, r in d.iterrows():
        py = str(r["python_name"]).replace(" ", "_")
        he = str(r["access_name"])
        m.setdefault(he, py)  # שמירת ההופעה הראשונה
    m.update(PREFERRED_MAPPING)  # דריסת מיפויים דו-משמעיים
    return m


def connect():
    return psycopg2.connect(
        host=os.environ["PGHOST"],
        port=int(os.environ.get("PGPORT", "5432")),
        dbname=os.environ.get("PGDATABASE", "postgres"),
        user=os.environ["PGUSER"],
        password=os.environ["PGPASSWORD"],
        sslmode="require",
        connect_timeout=20,
    )


def table_columns(conn, table):
    with conn.cursor() as cur:
        cur.execute(
            """select column_name, data_type from information_schema.columns
               where table_schema='public' and table_name=%s""",
            (table,),
        )
        return {row[0]: row[1] for row in cur.fetchall()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True)
    ap.add_argument("--code", required=True)
    ap.add_argument("--dict", default=DEFAULT_DICT)
    args = ap.parse_args()

    table = f"students_{args.code}"
    conn = connect()
    cols_types = table_columns(conn, table)
    if not cols_types:
        sys.exit(f"הטבלה {table} לא קיימת — הרץ קודם את המיגרציות")

    he2py = build_he_to_py(args.dict)
    df = pd.read_excel(args.file, dtype=str)
    print(f"נקראו {len(df)} שורות, {len(df.columns)} עמודות מהקובץ")

    # מיפוי כותרות עברית -> python_name, השארת עמודות מוכרות בלבד
    rename = {}
    for c in df.columns:
        py = he2py.get(str(c))
        if py and py in cols_types and py not in rename.values():
            rename[c] = py
    df = df[list(rename.keys())].rename(columns=rename)
    print(f"מופו {len(df.columns)} עמודות לטבלה")

    # שדה מחושב: כיתה (משולב) = מקבילה עם מקף לפני הספרות (ט5 -> ט-5)
    if "MAKBILA" in df.columns and "KITA_MESHULEVET" in cols_types:
        df["KITA_MESHULEVET"] = df["MAKBILA"].map(
            lambda v: re.sub(r"(\d+)$", r"-\1", v) if isinstance(v, str) and v.strip() else v
        )

    # המרת סוגים
    for col in df.columns:
        t = cols_types[col]
        if t == "date":
            df[col] = pd.to_datetime(df[col], errors="coerce", dayfirst=True).dt.date
        elif t in ("numeric", "integer", "bigint", "double precision"):
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # ניקוי ערכי NaN/ריק ל-None (כולל מחרוזות 'NaN' שמגיעות מהקובץ)
    df = df.astype(object).where(pd.notnull(df), None)
    for col in df.columns:
        df[col] = df[col].map(
            lambda v: None
            if (isinstance(v, str) and v.strip().lower() in NULL_TOKENS)
            else (v.strip() if isinstance(v, str) else v)
        )

    # הסרת כפילויות לפי תעודת זהות
    if "MISPAR_ZEHUT" in df.columns:
        before = len(df)
        df = df[df["MISPAR_ZEHUT"].notnull()]
        df = df.drop_duplicates(subset=["MISPAR_ZEHUT"], keep="first")
        if before != len(df):
            print(f"הוסרו {before - len(df)} שורות כפולות/ריקות לפי ת.ז. — נשארו {len(df)}")

    cols = list(df.columns)
    quoted = ", ".join(f'"{c}"' for c in cols)
    # np/to_numpy עלול להחזיר None לכדי float nan — ממירים חזרה ל-None
    # (אחרת nan נכתב כמחרוזת 'NaN' בעמודות טקסט). x != x מזהה nan.
    rows = [
        tuple(None if (isinstance(x, float) and x != x) else x for x in r)
        for r in df.to_numpy()
    ]

    with conn.cursor() as cur:
        cur.execute(f'truncate table public.{table}')
        execute_values(
            cur,
            f'insert into public.{table} ({quoted}) values %s',
            rows,
            page_size=1000,
        )
    conn.commit()

    with conn.cursor() as cur:
        cur.execute(f'select count(*) from public.{table}')
        total = cur.fetchone()[0]
    conn.close()
    print(f"נטענו בהצלחה. סה\"כ שורות בטבלה: {total}")


if __name__ == "__main__":
    main()
