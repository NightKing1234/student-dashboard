"""
טעינת פלט ה-pipeline לטבלת students_{code} ב-Supabase.

השימוש:
    pip install pandas openpyxl requests
    set SUPABASE_URL=https://xxxx.supabase.co
    set SUPABASE_SERVICE_KEY=<service_role_key>   # מפתח service_role, לא anon
    python load_data.py --file "..\..\Itay_Modules\...\output.xlsx" --code 1400000

הסקריפט:
  1. קורא את קובץ האקסל (פלט ה-pipeline).
  2. אם הכותרות בעברית (access_name) — ממפה אותן חזרה ל-python_name לפי המילון.
  3. משאיר רק עמודות מוכרות ומעלה בבאצ'ים לטבלה students_{code}.

הערה: הטבלה נדרסת בכל עדכון חודשי — הסקריפט מבצע upsert לפי MISPAR_ZEHUT.
"""
import argparse
import json
import math
import os
import sys

import pandas as pd
import requests

DICT_PATH = os.path.join(
    os.path.dirname(__file__),
    "..", "..", "Itay_Modules", "tables", "columns_name_dictionary.xlsx",
)
BATCH = 500


def load_reverse_dict():
    """access_name (עברית) -> python_name (עמודת DB)."""
    df = pd.read_excel(DICT_PATH)
    rev = {}
    for _, r in df.iterrows():
        py = str(r["python_name"]).replace(" ", "_")
        he = str(r["access_name"])
        rev[he] = py
        rev[py] = py  # מזהה גם עמודות שכבר באנגלית
    return rev


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True, help="נתיב לקובץ פלט ה-pipeline")
    ap.add_argument("--code", required=True, help="קוד הרשות, למשל 1400000")
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        sys.exit("חסרים משתני סביבה SUPABASE_URL / SUPABASE_SERVICE_KEY")

    rev = load_reverse_dict()
    df = pd.read_excel(args.file, dtype=str)
    df = df.rename(columns={c: rev.get(str(c), str(c)) for c in df.columns})
    # משאירים רק עמודות מוכרות (python_name)
    known = set(rev.values())
    df = df[[c for c in df.columns if c in known]]
    df = df.where(pd.notnull(df), None)

    records = df.to_dict(orient="records")
    endpoint = f"{url}/rest/v1/students_{args.code}"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    total = len(records)
    for i in range(0, total, BATCH):
        chunk = records[i : i + BATCH]
        # ניקוי ערכי NaN שנותרו
        for row in chunk:
            for k, v in list(row.items()):
                if isinstance(v, float) and math.isnan(v):
                    row[k] = None
        resp = requests.post(endpoint, headers=headers, data=json.dumps(chunk))
        if resp.status_code >= 300:
            sys.exit(f"שגיאה בהעלאה (שורות {i}-{i+len(chunk)}): {resp.status_code} {resp.text[:500]}")
        print(f"הועלו {min(i + BATCH, total)}/{total}")

    print("הטעינה הושלמה בהצלחה.")


if __name__ == "__main__":
    main()
