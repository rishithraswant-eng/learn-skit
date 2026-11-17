"""Pedagogical recall pacing after exact local audio measurements; no speech edits."""
import json
from pathlib import Path
import re
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[1]
EVS=ROOT/'evs-cat2-content'
for module in ('M03','M04','M09'):
    file=EVS/f'video/scenes/src/{module}.json'
    scenes=json.loads(file.read_text(encoding='utf-8'))
    if module=='M03':
        scenes[0]['narration']=scenes[0]['narration'].replace('[[pause 7]]','[[pause 6]]',1)
    if module=='M04':
        for scene in scenes:
            scene['narration']=scene['narration'].replace('[[pause 2]]','[[pause 8]]')
            scene['narration_short']=scene['narration_short'].replace('[[pause 2]]','[[pause 5]]')
    if module=='M09':
        for scene in scenes:
            scene['narration_short']=scene['narration_short'].replace('[[pause 3]]','[[pause 8]]')
    file.write_text(json.dumps(scenes,ensure_ascii=False,indent=1),encoding='utf-8')
    subprocess.run([sys.executable,str(EVS/'scripts/build_module.py'),module],check=True)
