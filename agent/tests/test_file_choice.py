"""
בחירת הקובץ מתוך תיקייה שנצברים בה עדכונים, ושיוך לפי קוד רשות.

השאלה שמאחורי הבדיקה: קבצים של חודש שעבר עדיין בתיקייה, ומגיעים חדשים.
מה ייבחר — ולפי מה.
"""
import os
import time

from _harness import Checks, Sandbox, put_moe_files, worker

MOE = {"1400000": "1400000", "800000": "800000", "5108": "120"}

check = Checks("בחירת קבצים ושיוך למועצה")

# ── 1. הישן נשאר, החדש נבחר ─────────────────────────────────────────
with Sandbox() as folder:
    put_moe_files(folder, "1400000", "2026-06-18")
    put_moe_files(folder, "1400000", "2026-08-15")
    files = worker.group_files_by_authority(folder, MOE)["1400000"]
    check("נבחר העדכון החדש מכל סוג",
          {p for p, f in files.items() if "2026-08-15" in f.name},
          set(worker.MOE_PREFIXES))

# ── 2. תאריך הדיסק לא קובע ──────────────────────────────────────────
# העתקה ששימרה את תאריך המקור (robocopy /COPY:DAT, ZIP, סנכרון) יכולה
# לתת לקבצים החדשים mtime ישן יותר מאלה שהועתקו בחודש שעבר.
with Sandbox() as folder:
    put_moe_files(folder, "1400000", "2026-06-18")
    for f in folder.glob("*.csv"):                    # יוני = "נגעו בו אתמול"
        recent = time.time() - 86400
        os.utime(f, (recent, recent))
    put_moe_files(folder, "1400000", "2026-08-15")
    for f in folder.glob("*2026-08-15*.csv"):         # אוגוסט = תאריך ישן
        ancient = time.time() - 90 * 86400
        os.utime(f, (ancient, ancient))

    files = worker.group_files_by_authority(folder, MOE)["1400000"]
    check("החותמת שבשם גוברת על תאריך השינוי בדיסק",
          {p for p, f in files.items() if "2026-08-15" in f.name},
          set(worker.MOE_PREFIXES))

# ── 3. הפרדה בין מועצות ─────────────────────────────────────────────
with Sandbox() as folder:
    for moe in MOE:
        put_moe_files(folder, moe, "2026-08-15")
    groups = worker.group_files_by_authority(folder, MOE)
    check("שלוש מועצות זוהו בנפרד", sorted(groups), ["1400000", "5108", "800000"])

    leaks = [f.name for moe, files in groups.items() for f in files.values()
             if moe not in set(f.stem.split("_"))]
    check("אף קובץ לא שויך למועצה זרה", leaks, [])

    check("קוד שאינו במערכת נזרק",
          worker.group_files_by_authority(folder, {"9999999": "9999999"}), {})

    # ההתאמה על מילה שלמה: 120 לא אמור להיתפס בתוך 1400000 או בתוך תאריך
    check("קוד קצר לא נתפס בתוך מחרוזת אחרת",
          worker.group_files_by_authority(folder, {"120": "120"}), {})

# ── 4. קובץ שעדיין בהעתקה ───────────────────────────────────────────
with Sandbox() as folder:
    put_moe_files(folder, "1400000", "2026-08-15", settled=False)
    files = worker.group_files_by_authority(folder, MOE)["1400000"]
    check("קובץ טרי — ממתינים שההעתקה תסתיים",
          worker.files_settled(files), False)

check.done()
