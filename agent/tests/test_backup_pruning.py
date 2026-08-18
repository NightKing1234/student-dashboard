"""
מחיקת גיבויים ישנים — 90 יום או 12 גיבויים, אבל האחרון תמיד נשאר.

החריג אינו קוסמטי: אחרי חצי שנה בלי עדכון כל הגיבויים היו עוברים את
90 היום ונמחקים, והעדכון הבא היה דורס את הטבלה בלי שום עותק קודם.
"""
import os
import time

from _harness import Checks, Sandbox, worker

check = Checks("שמירת גיבויים")
now = time.time()


def make(folder, ages_days):
    for age in ages_days:
        f = folder / f"students_1400000_age{age:03d}d.xlsx"
        f.write_bytes(b"x" * 100)
        t = now - age * 86400
        os.utime(f, (t, t))


def remaining(folder):
    return sorted(int(p.stem.split("age")[1].rstrip("d"))
                  for p in folder.glob("*.xlsx"))


with Sandbox() as folder:
    make(folder, [0, 30, 60, 95, 125, 160])
    worker.prune_backups(folder)
    check("עדכון חודשי — נמחקו הישנים מ-90 יום", remaining(folder), [0, 30, 60])

with Sandbox() as folder:
    make(folder, [200])
    worker.prune_backups(folder)
    check("גיבוי יחיד וישן נשאר — יש רשת ביטחון", remaining(folder), [200])

with Sandbox() as folder:
    make(folder, [5, 100, 150, 200])
    worker.prune_backups(folder)
    check("הכול ישן חוץ מאחד — נשאר רק העדכני", remaining(folder), [5])

with Sandbox() as folder:
    make(folder, list(range(20)))
    worker.prune_backups(folder)
    check("עדכונים תכופים — מכסת 12 בולמת הצטברות",
          len(remaining(folder)), worker.BACKUP_KEEP)

with Sandbox() as folder:
    worker.prune_backups(folder)          # תיקייה ריקה
    check("תיקייה ריקה לא מפילה", remaining(folder), [])

check.done()
