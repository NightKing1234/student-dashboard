"""
יוצר משתמש ב-Supabase Auth דרך ה-Admin API ומשייך אותו לרשות
(דרך user_metadata; הטריגר handle_new_auth_user ממלא את public.users).

שימוש (משתני סביבה: SUPABASE_URL, SUPABASE_SECRET):
    python create_user.py --email x@y.com --password ... --role admin --code 1400000
"""
import argparse
import os
import sys

import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--email", required=True)
    ap.add_argument("--password", required=True)
    ap.add_argument("--role", default="viewer")
    ap.add_argument("--code", required=True)
    ap.add_argument("--display", default="")
    args = ap.parse_args()

    url = os.environ["SUPABASE_URL"].rstrip("/")
    secret = os.environ["SUPABASE_SECRET"]
    endpoint = f"{url}/auth/v1/admin/users"
    headers = {
        "apikey": secret,
        "Authorization": f"Bearer {secret}",
        "Content-Type": "application/json",
    }
    payload = {
        "email": args.email,
        "password": args.password,
        "email_confirm": True,
        "user_metadata": {
            "display_name": args.display or args.email,
            "role": args.role,
            "authority_codes": [args.code],
        },
    }
    # verify=False בגלל יירוט SSL ברשת; החיבור עדיין ל-Supabase
    resp = requests.post(endpoint, headers=headers, json=payload, verify=False, timeout=30)
    if resp.status_code >= 300:
        sys.exit(f"שגיאה ({resp.status_code}): {resp.text[:500]}")
    data = resp.json()
    print(f"נוצר משתמש: {data.get('email')}  id={data.get('id')}  role={args.role}  רשות={args.code}")


if __name__ == "__main__":
    main()
