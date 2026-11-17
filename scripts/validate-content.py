"""Rebuild all existing modules; never invent missing modules or weaken validators."""
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
EVS = ROOT / 'evs-cat2-content'
os.environ['PYTHONIOENCODING'] = 'utf-8'
failed = []
for module in sorted((EVS / 'modules').glob('M*.json')):
    result = subprocess.run([sys.executable, str(EVS / 'scripts/build_module.py'), module.stem],
                            capture_output=True, text=True, encoding='utf-8')
    clean = result.returncode == 0 and '## Warnings\n- none' in result.stdout
    print(module.stem, 'PASS' if clean else 'FAIL', flush=True)
    if not clean:
        failed.append(module.stem)
        print(result.stdout, result.stderr)
print('Failed:', failed)
sys.exit(bool(failed))
