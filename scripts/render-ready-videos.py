"""Render only locally validated video profiles. Never calls TTS or uploads files."""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = Path(__file__).resolve().parents[1]
EVS = ROOT / 'evs-cat2-content'
spec = importlib.util.spec_from_file_location('video_build', EVS / 'scripts/video_build.py')
video = importlib.util.module_from_spec(spec)
spec.loader.exec_module(video)
reports = json.loads((EVS / 'qa/offline_video_report.json').read_text(encoding='utf-8'))
parser=argparse.ArgumentParser();parser.add_argument('--name');parser.add_argument('--workers',type=int,default=1);args=parser.parse_args()
if args.workers>1:
    jobs=[]
    for result in reports:
        if result['status']!='PASS':continue
        name=result['module']+('' if result['profile']=='full' else '_'+result['profile'])
        base=video.OUT/name;bench=base.with_suffix('.bench.json')
        checksum=hashlib.sha256(base.with_suffix('.timeline.json').read_bytes()).hexdigest()
        previous=json.loads(bench.read_text(encoding='utf-8')) if bench.exists() else {}
        if base.with_suffix('.mp4').exists() and previous.get('timeline_sha256')==checksum and previous.get('media_verified'):continue
        jobs.append(name)
    def task(name):
        log=EVS/'qa'/f'render_{name}.log'
        with log.open('w',encoding='utf-8') as output:
            run=subprocess.run([sys.executable,str(Path(__file__).resolve()),'--name',name],stdout=output,stderr=subprocess.STDOUT)
        if run.returncode:raise RuntimeError(f'{name} render failed: {log}')
        return name
    print(f'Rendering {len(jobs)} changed profiles using {min(2,args.workers)} local workers.',flush=True)
    with ThreadPoolExecutor(max_workers=min(2,args.workers)) as executor:
        for future in as_completed([executor.submit(task,name) for name in jobs]):print(future.result(),'DONE',flush=True)
    sys.exit(0)
for result in reports:
    if result['status'] != 'PASS':
        continue
    name = result['module'] + ('' if result['profile'] == 'full' else '_' + result['profile'])
    if args.name and args.name!=name:continue
    base = video.OUT / name
    timeline_file = base.with_suffix('.timeline.json')
    checksum = hashlib.sha256(timeline_file.read_bytes()).hexdigest()
    bench_file = base.with_suffix('.bench.json')
    if base.with_suffix('.mp4').exists() and bench_file.exists():
        previous = json.loads(bench_file.read_text(encoding='utf-8'))
        if previous.get('timeline_sha256') == checksum:
            print(name, 'already current', flush=True)
            continue
    print(name, 'rendering offline', flush=True)
    timeline = json.loads(timeline_file.read_text(encoding='utf-8'))
    stats = video.render(timeline, base.with_suffix('.wav'), base.with_suffix('.mp4'))
    probe = subprocess.run([str(Path(video.FFMPEG).with_name('ffprobe.exe' if sys.platform == 'win32' else 'ffprobe')),
                            '-v','error','-show_streams','-show_format','-of','json',str(base.with_suffix('.mp4'))],
                           capture_output=True,text=True,check=True)
    media = json.loads(probe.stdout)
    streams = media['streams']
    visual = next(s for s in streams if s['codec_type'] == 'video')
    assert (visual['width'],visual['height']) == (video.CFG['width'],video.CFG['height'])
    assert any(s['codec_type'] == 'audio' for s in streams)
    assert abs(float(media['format']['duration']) - timeline['duration']) < 1
    stats['timeline_sha256'] = checksum
    stats['profile'] = result['profile']
    stats['media_verified'] = True
    bench_file.write_text(json.dumps(stats,indent=2),encoding='utf-8')
    print(name, 'DONE', stats['video_s'], 'seconds', flush=True)
