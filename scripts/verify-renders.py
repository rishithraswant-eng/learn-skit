"""Inspect actual local MP4 streams and record a manifest of current renders."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
EVS = ROOT / 'evs-cat2-content'
OUT = EVS / 'video/out'
FFPROBE = Path.home() / 'ffmpeg/ffmpeg-master-latest-win64-gpl/bin/ffprobe.exe'
config = json.loads((EVS / 'config/video.json').read_text(encoding='utf-8'))
manifest = []
for bench_file in sorted(OUT.glob('M*.bench.json')):
    stats = json.loads(bench_file.read_text(encoding='utf-8'))
    timeline_file = bench_file.with_name(bench_file.name.replace('.bench.json','.timeline.json'))
    media_file = bench_file.with_name(bench_file.name.replace('.bench.json','.mp4'))
    if not stats.get('timeline_sha256') or not media_file.exists():
        continue
    assert hashlib.sha256(timeline_file.read_bytes()).hexdigest() == stats['timeline_sha256'], str(timeline_file)
    timeline = json.loads(timeline_file.read_text(encoding='utf-8'))
    probe = subprocess.run([str(FFPROBE),'-v','error','-show_streams','-show_format','-of','json',str(media_file)],capture_output=True,text=True,check=True)
    info = json.loads(probe.stdout)
    visual = next(s for s in info['streams'] if s['codec_type'] == 'video')
    assert (visual['width'],visual['height']) == (config['width'],config['height']), str(media_file)
    assert any(s['codec_type'] == 'audio' for s in info['streams']), str(media_file)
    assert abs(float(info['format']['duration'])-timeline['duration']) < 1, str(media_file)
    stats['media_verified'] = True
    bench_file.write_text(json.dumps(stats,indent=2),encoding='utf-8')
    manifest.append({'file':media_file.name,'seconds':float(info['format']['duration']),'bytes':media_file.stat().st_size,'profile':stats.get('profile','full')})
(EVS / 'qa/render_manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(f'Verified {len(manifest)} videos: 1280x720, audio present, duration matches current timeline.')
