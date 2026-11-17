"""List exact missing speech requests for review. Makes no network requests."""
import hashlib
import importlib.util
import json
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVS = ROOT / 'evs-cat2-content'
spec = importlib.util.spec_from_file_location('video_build',EVS/'scripts/video_build.py')
video = importlib.util.module_from_spec(spec)
spec.loader.exec_module(video)
missing = {}
for source in sorted((EVS/'content/video/scenes').glob('M*.json')):
    for profile in ('full','sprint','blitz'):
        for scene in video.select_profile(json.loads(source.read_text(encoding='utf-8')),profile):
            for index, segment in enumerate(video.PAUSE.split(scene['narration'])):
                if index % 2 or not segment.strip():
                    continue
                text = video.speakable(segment.strip())
                key = hashlib.sha256(f"{text}|{video.CFG['voice']}|{video.CFG['rate']}|{video.CFG['lexicon_version']}".encode()).hexdigest()[:20]
                if (video.CACHE/f'{key}.mp3').exists() and (video.CACHE/f'{key}.words.json').exists():
                    continue
                entry = missing.setdefault(key,{'cache_key':key,'text':text,'used_in':[]})
                entry['used_in'].append({'module':source.stem,'profile':profile,'scene':scene['id']})
parser=argparse.ArgumentParser();parser.add_argument('--out',default='pending-narration.json');args=parser.parse_args()
if Path(args.out).name!=args.out:raise ValueError('Output must be a filename in private-build')
output = ROOT/'private-build'/args.out
output.parent.mkdir(exist_ok=True)
output.write_text(json.dumps({'provider':'Microsoft Edge speech service','voice':video.CFG['voice'],'rate':video.CFG['rate'],'requests':list(missing.values())},indent=2),encoding='utf-8')
print(f'Prepared {len(missing)} missing narration requests for review; none sent.')
