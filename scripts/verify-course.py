"""Check the actual combined and standalone course exports with FFprobe."""
import json,shutil,subprocess
from pathlib import Path

root=Path(__file__).resolve().parents[1]/'evs-cat2-content'
out=root/'video/out'
probe=shutil.which('ffprobe') or str(Path.home()/'ffmpeg/ffmpeg-master-latest-win64-gpl/bin/ffprobe.exe')

def info(name):
    result=subprocess.run([probe,'-v','error','-show_format','-show_streams','-show_chapters','-of','json',str(out/name)],capture_output=True,check=True)
    return json.loads(result.stdout)

def check_video(name):
    value=info(name);visual=next(s for s in value['streams'] if s['codec_type']=='video')
    assert (visual['width'],visual['height'])==(1280,720),name
    assert any(s['codec_type']=='audio' for s in value['streams']),name
    return value

def duration(value):return float(value['format']['duration'])

for name in ['INTRO','FINALE']:
    actual=check_video(name+'.mp4')
    report=json.loads((root/f'qa/{name}_report.json').read_text(encoding='utf-8'))
    assert report['status']=='PASS'
    print(name,round(duration(actual),2),'seconds; audio and video present')

for item in json.loads((root/'qa/course_manifest.json').read_text(encoding='utf-8')):
    visual=check_video(item['file']);audio=info(item['audio'])
    assert len(visual['chapters'])==len(audio['chapters'])==len(item['chapters']),item['profile']
    assert all(stream['codec_type'] in ('audio','data') for stream in audio['streams']),item['audio']
    assert any(stream['codec_type']=='audio' for stream in audio['streams']),item['audio']
    assert abs(duration(visual)-item['duration_seconds'])<1 and abs(duration(audio)-duration(visual))<1,item['profile']
    print(item['profile'],round(duration(visual)/60,2),'minutes;',len(visual['chapters']),'chapters in both exports')
