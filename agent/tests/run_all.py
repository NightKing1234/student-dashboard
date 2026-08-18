"""
מריץ את כל בדיקות הסוכן. מחזיר קוד יציאה שונה מאפס אם משהו נכשל.

    venv\\Scripts\\python.exe tests\\run_all.py
"""
import io
import subprocess
import sys
from pathlib import Path

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

HERE = Path(__file__).resolve().parent
failed = []

for test in sorted(HERE.glob("test_*.py")):
    result = subprocess.run([sys.executable, str(test)], cwd=HERE)
    if result.returncode:
        failed.append(test.name)
    print()

print("=" * 64)
if failed:
    print(f"  ✗ נכשלו: {', '.join(failed)}")
else:
    print("  ✓ כל הבדיקות עברו")
print("=" * 64)
sys.exit(1 if failed else 0)
