"""Offline video QA: only existing audio is read; no TTS/network fallback exists."""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
EVS = ROOT / 'evs-cat2-content'
spec = importlib.util.spec_from_file_location('video_build', EVS / 'scripts/video_build.py')
video = importlib.util.module_from_spec(spec)
spec.loader.exec_module(video)

def cached_audio(text, _retry=False):
    key = hashlib.sha256(f"{text}|{video.CFG['voice']}|{video.CFG['rate']}|{video.CFG['lexicon_version']}".encode()).hexdigest()[:20]
    mp3 = video.CACHE / f'{key}.mp3'
    words_file = video.CACHE / f'{key}.words.json'
    if not mp3.exists() or not words_file.exists():
        raise FileNotFoundError(f'Uncached narration {key}; external TTS disabled')
    words = json.loads(words_file.read_text(encoding='utf-8'))
    pcm = subprocess.run([video.FFMPEG, '-v', 'error', '-i', str(mp3), '-f', 's16le', '-ac', '1', '-ar', str(video.SR), '-'], capture_output=True, check=True).stdout
    if words and len(pcm) / 2 / video.SR < words[-1]['e'] - 0.05:
        raise ValueError(f'Truncated cached audio {key}')
    return pcm, words

video.tts = cached_audio  # Original online TTS path is never called.
allocation = json.loads((EVS / 'config/allocation.json').read_text(encoding='utf-8'))
reports = []
for source in sorted((EVS / 'content/video/scenes').glob('M*.json')):
    if len(sys.argv) > 1 and source.stem not in sys.argv[1:]:
        continue
    for profile in ('full', 'sprint', 'blitz'):
        name = source.stem + ('' if profile == 'full' else '_' + profile)
        try:
            scenes = video.select_profile(json.loads(source.read_text(encoding='utf-8')), profile)
            if not scenes:
                raise ValueError('No scenes for profile')
            timeline, track, words, warnings = video.build_timeline(scenes)
            target = allocation[source.stem]['video_min'] * 60 * {'full':1,'sprint':0.30,'blitz':12/136}[profile]
            result = video.check(timeline, name, target)
            duration = timeline['duration']
            if profile == 'blitz':
                duration_ok = 25 <= duration <= (90 if source.stem in ('M04','M07','M10','M15') else 75)
            else:
                duration_ok = abs(duration-target) <= target * (0.08 if profile == 'full' else 0.15)
            result.update(module=source.stem, profile=profile, timing_warnings=warnings, duration_ok=duration_ok,
                          status='PASS' if duration_ok and not warnings and not result['layout_warnings'] else 'REVIEW')
            # Fresh timeline/captions are useful even when a review is still needed.
            base = video.OUT / name
            base.with_suffix('.timeline.json').write_text(json.dumps(timeline,ensure_ascii=False),encoding='utf-8')
            video.write_audio(track, duration, base.with_suffix('.wav'))
            video.captions(words, base)
        except (FileNotFoundError, ValueError) as error:
            result = {'module':source.stem,'profile':profile,'status':'BLOCKED','reason':str(error)}
        reports.append(result)
        print(source.stem,profile,result['status'],result.get('duration_s',''),result.get('reason',''),flush=True)
        if result.get('timing_warnings') or result.get('layout_warnings'):
            print(json.dumps({'timing':result['timing_warnings'],'layout':result['layout_warnings']}),flush=True)
        (EVS / 'qa/offline_video_report.json').write_text(json.dumps(reports,indent=2),encoding='utf-8')
