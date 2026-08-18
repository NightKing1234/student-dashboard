"""
תשתית משותפת לבדיקות הסוכן.

כל הבדיקות כאן **סינתטיות ולא נוגעות במסד** — הן בונות קובצי CSV מזויפים
בתיקייה זמנית ובודקות את ההחלטה בלבד: מה הסוכן היה בוחר לעבד. לכן אפשר
להריץ אותן על כל מחשב, בלי קובצי מצב"ת אמיתיים ובלי חיבור ל-Supabase.
"""
import io
import os
import shutil
import sys
import tempfile
import time
from pathlib import Path

# הסוכן נמצא תיקייה אחת מעל — בלי נתיב מוחלט, כדי שירוץ גם אצל סבא
AGENT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AGENT_DIR))

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

import worker      # noqa: E402


class Checks:
    """אוסף בדיקות עם דיווח בעברית וקוד יציאה."""

    def __init__(self, title: str):
        self.failures = 0
        print("=" * 64)
        print(f"  {title}")
        print("=" * 64)

    def __call__(self, label, got, want):
        if got == want:
            print(f"  ✓ {label}")
        else:
            self.failures += 1
            print(f"  ✗ {label}")
            print(f"      התקבל: {got!r}")
            print(f"      ציפינו: {want!r}")

    def done(self):
        print()
        print("=" * 64)
        print("  ✓ הכל עבר" if not self.failures
              else f"  ✗ {self.failures} בדיקות נכשלו")
        print("=" * 64)
        sys.exit(1 if self.failures else 0)


class Sandbox:
    """תיקייה זמנית שנמחקת ביציאה, גם כשהבדיקה נופלת."""

    def __enter__(self) -> Path:
        self.path = Path(tempfile.mkdtemp(prefix="matzevet-test-"))
        return self.path

    def __exit__(self, *exc):
        shutil.rmtree(self.path, ignore_errors=True)


def put_moe_files(folder: Path, moe: str, date: str, settled: bool = True):
    """
    יוצר את ששת קובצי המצב"ת של מועצה אחת, בשמות אמיתיים.

    ששת הקבצים של אותו עדכון אינם חולקים חותמת זהה — משרד החינוך כותב
    אותם בשניות שונות, ולכן גם כאן השניות נבדלות.
    """
    for i, prefix in enumerate(worker.MOE_PREFIXES):
        f = folder / f"{prefix}_2026_{moe}_{date}-19-02-{i:02d}_from_moe.csv"
        f.write_text("x" * (100 + i), encoding="utf-8")
        if settled:
            old = time.time() - 3600
            os.utime(f, (old, old))
