"""
מצב הפתיחה: מחברים את הסוכן לתיקייה שיש בה כבר שנים של עדכונים.
הוא חייב לרשום מה יש ולא לעבד כלום — ואז לתפוס את העדכון הבא.

רקע: decisions/005-watch-folder-baseline.md
"""
import json
import os

from _harness import Checks, Sandbox, put_moe_files, worker

MOE = {"1400000": "1400000", "5108": "120"}      # קוד מש"ח -> קוד אצלנו


def pending(folder, state):
    """אילו רשויות ייבחרו לעיבוד בהינתן המצב הזה."""
    out = []
    for moe, files in worker.group_files_by_authority(folder, MOE).items():
        if any(p not in files for p in worker.MOE_PREFIXES):
            continue
        if state["authorities"].get(MOE[moe]) != worker.fingerprint(files):
            out.append(MOE[moe])
    return sorted(out)


check = Checks("מצב פתיחה מול תיקייה עם היסטוריה")

with Sandbox() as folder:
    worker.WATCH_STATE = folder / "watch-state.json"

    # 14 עדכונים על פני שבע שנים, לשתי מועצות
    for year in range(2019, 2026):
        for month in (2, 9):
            for moe in MOE:
                put_moe_files(folder, moe, f"{year}-{month:02d}-05")
    total = len(list(folder.glob("*.csv")))
    check("נבנו 168 קבצים", total, 168)

    # ── 1. לפני החיבור: הכול היה נראה כשינוי ──
    state = worker.load_watch_state()
    check("בלי מצב פתיחה שתי המועצות היו מעובדות",
          pending(folder, state), ["120", "1400000"])

    # ── 2. החיבור הראשון רושם ולא מעבד ──
    groups = worker.group_files_by_authority(folder, MOE)
    worker.take_baseline(state, folder, groups, MOE)
    state = worker.load_watch_state()
    check("אחרי הרישום — אף מועצה לא תעובד", pending(folder, state), [])
    check("נרשמו שתי רשויות", sorted(state["authorities"]), ["120", "1400000"])
    check("נשמרה התיקייה שאליה התחברנו", state["folder"], str(folder))
    check("נרשם זמן", bool(state["baseline_at"]), True)

    # ── 3. סבב נוסף בלי שינוי ──
    check("סבב נוסף — עדיין כלום", pending(folder, worker.load_watch_state()), [])

    # ── 4. מגיע עדכון לאחת המועצות ──
    put_moe_files(folder, "1400000", "2026-08-17")
    check("עדכון חדש למטה מנשה — רק היא נבחרת",
          pending(folder, worker.load_watch_state()), ["1400000"])

    # ── 5. סנכרון שנגע בתאריכי כל הקבצים אינו עדכון ──
    state = worker.load_watch_state()
    state["authorities"]["1400000"] = worker.fingerprint(
        worker.group_files_by_authority(folder, MOE)["1400000"])
    worker.save_watch_state(state)
    for f in folder.glob("*.csv"):
        os.utime(f, None)
    check("העתקה מחדש של אותם קבצים — לא מעבד",
          pending(folder, worker.load_watch_state()), [])

    # ── 6. מועצה חסרת קבצים מדולגת ──
    partial = folder / "TALMIDIM_AM_2026_777_2026-08-17-19-02-00_from_moe.csv"
    partial.write_text("x", encoding="utf-8")
    check("מועצה עם קובץ אחד בלבד מדולגת",
          pending(folder, worker.load_watch_state()), [])

    # ── 7. שדרוג מקובץ מצב בגרסה הישנה ──
    worker.WATCH_STATE.write_text(json.dumps({"1400000": "ישן", "120": "ישן"}),
                                  encoding="utf-8")
    old = worker.load_watch_state()
    check("קובץ מגרסה 1 שודרג ל-2", old["version"], 2)
    check("המעקב שנשמר בו לא אבד", sorted(old["authorities"]), ["120", "1400000"])

    # ── 8. קובץ פגום ──
    worker.WATCH_STATE.write_text("{לא JSON", encoding="utf-8")
    check("קובץ פגום מחזיר מצב ריק", worker.load_watch_state()["authorities"], {})

check.done()
