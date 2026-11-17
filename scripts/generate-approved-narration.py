"""Generate only the exact narration manifest approved by the owner on 17 Nov 2026."""
import asyncio
import hashlib
import importlib.util
import json
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVS = ROOT / 'evs-cat2-content'
spec = importlib.util.spec_from_file_location('video_build', EVS/'scripts/video_build.py')
video = importlib.util.module_from_spec(spec)
spec.loader.exec_module(video)
parser=argparse.ArgumentParser();parser.add_argument('--completion',action='store_true');args=parser.parse_args()
manifest_name='narration-completion.json' if args.completion else 'pending-narration.json'
approved_sha='f865ea4b912f0f7803ede08f081a13f3197aeb787c905bd23bf4a3ab4d44ab76' if args.completion else '6ef9938256aa5b7fee6276bdfaa0387210e5d2483b3162b358d24bb2fa0d3163'
manifest_bytes = (ROOT/'private-build'/manifest_name).read_bytes()
assert hashlib.sha256(manifest_bytes).hexdigest() == approved_sha, 'Manifest changed since owner approval'
manifest = json.loads(manifest_bytes.decode('utf-8'))
assert manifest['voice'] == video.CFG['voice'] and manifest['rate'] == video.CFG['rate'], 'Voice configuration changed since approval'
requests = manifest['requests']
for request in requests:
    expected = hashlib.sha256(f"{request['text']}|{manifest['voice']}|{manifest['rate']}|{video.CFG['lexicon_version']}".encode()).hexdigest()[:20]
    assert request['cache_key'] == expected, 'Approved request hash mismatch'

report = []
report_file = EVS/'qa'/('completion_narration_report.json' if args.completion else 'approved_narration_report.json')

async def main():
    queue = asyncio.Queue()
    for request in requests:
        queue.put_nowait(request)
    failures = 0
    async def worker():
        nonlocal failures
        while not queue.empty() and failures < 3:
            request = queue.get_nowait()
            key = request['cache_key']
            mp3, words = video.CACHE/f'{key}.mp3', video.CACHE/f'{key}.words.json'
            result = {'cache_key':key,'status':'cached'}
            if not (mp3.exists() and words.exists()):
                for attempt in range(3):
                    try:
                        await asyncio.wait_for(video._tts(request['text'],mp3,words),timeout=60)
                        result['status'] = 'generated'
                        result.pop('error',None)
                        break
                    except Exception as error:
                        result.update(status='failed',error=type(error).__name__,detail=str(error))
                        if attempt < 2:
                            await asyncio.sleep(2*(attempt+1))
                if result['status'] == 'failed':
                    failures += 1
            report.append(result)
            report_file.write_text(json.dumps(report,indent=2),encoding='utf-8')
            print(f"{len(report)}/{len(requests)} {key} {result['status']} {result.get('error','')}",flush=True)
    await asyncio.gather(*(worker() for _ in range(3)))
    print(f"Generated: {sum(r['status']=='generated' for r in report)}; failed: {sum(r['status']=='failed' for r in report)}; not attempted: {len(requests)-len(report)}",flush=True)

asyncio.run(main())
