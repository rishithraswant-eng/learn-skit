"""Build a source-backed warm-up, final recap, chaptered course videos and audio.
All speech is reused from already generated module clips; no external TTS calls.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[1]
EVS=ROOT/'evs-cat2-content'
spec=importlib.util.spec_from_file_location('video',EVS/'scripts/video_build.py')
video=importlib.util.module_from_spec(spec);spec.loader.exec_module(video)

def cached(text,_retry=False):
    key=hashlib.sha256(f"{text}|{video.CFG['voice']}|{video.CFG['rate']}|{video.CFG['lexicon_version']}".encode()).hexdigest()[:20]
    mp3,words=video.CACHE/f'{key}.mp3',video.CACHE/f'{key}.words.json'
    if not mp3.exists() or not words.exists():raise FileNotFoundError('Uncached speech; course assembler never sends narration')
    pcm=subprocess.run([video.FFMPEG,'-v','error','-i',str(mp3),'-f','s16le','-ac','1','-ar',str(video.SR),'-'],capture_output=True,check=True).stdout
    return pcm,json.loads(words.read_text(encoding='utf-8'))
video.tts=cached
probe=str(Path(video.FFMPEG).with_name('ffprobe.exe' if Path(video.FFMPEG).suffix.lower()=='.exe' else 'ffprobe'))
allocation=json.loads((EVS/'config/allocation.json').read_text(encoding='utf-8'))

def duration(file):
    result=subprocess.run([probe,'-v','error','-show_entries','format=duration','-of','json',str(file)],capture_output=True,text=True,check=True)
    return float(json.loads(result.stdout)['format']['duration'])

def build_special(name,scenes,target):
    timeline,track,words,warnings=video.build_timeline(scenes)
    report=video.check(timeline,name,target)
    assert not warnings and not report['layout_warnings'],(name,warnings,report['layout_warnings'])
    assert abs(timeline['duration']-target)<=target*.08,(name,timeline['duration'])
    base=video.OUT/name
    checksum=hashlib.sha256(json.dumps(timeline,ensure_ascii=False).encode()).hexdigest()
    previous=json.loads(base.with_suffix('.bench.json').read_text(encoding='utf-8')) if base.with_suffix('.bench.json').exists() else {}
    if not base.with_suffix('.mp4').exists() or previous.get('timeline_sha256')!=checksum:
        video.write_audio(track,timeline['duration'],base.with_suffix('.wav'));video.captions(words,base)
        stats=video.render(timeline,base.with_suffix('.wav'),base.with_suffix('.mp4'));stats['timeline_sha256']=checksum
        base.with_suffix('.bench.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
    report.update(status='PASS',source='Existing approved module speech, reused for spaced recall')
    (EVS/f'qa/{name}_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    return base.with_suffix('.mp4')

warmup=video.select_profile(json.loads((EVS/'content/video/scenes/M01.json').read_text(encoding='utf-8')),'full')[:2]
intro=build_special('INTRO',warmup,120)
finale=[]
for module in ('M04','M05','M06','M07','M10','M15','M16','M17'):
    selected=video.select_profile(json.loads((EVS/f'content/video/scenes/{module}.json').read_text(encoding='utf-8')),'blitz')
    for scene in selected:
        scene['id']='FINAL-'+scene['id'];scene['profile']=['full'];scene['board']={**scene['board'],'panel':'FINAL-'+scene['board']['panel']}
        for action in scene['actions']:action['only']=['full']
        finale.append(scene)
ending=build_special('FINALE',finale,300)
manifest=[]
for profile in ('full','sprint','blitz'):
    label=profile.upper();files=[('Warm-up: the big picture',intro)]
    for module,info in allocation.items():
        if not module.startswith('M'):continue
        name=module+('' if profile=='full' else '_'+profile)
        file=video.OUT/(name+'.mp4')
        bench=json.loads((video.OUT/(name+'.bench.json')).read_text(encoding='utf-8'))
        current=hashlib.sha256((video.OUT/(name+'.timeline.json')).read_bytes()).hexdigest()
        assert bench.get('media_verified') and bench.get('timeline_sha256')==current,(module,profile,'render stale')
        files.append((module+' — '+info['title'],file))
    if profile!='blitz':files.append(('Final recall',ending))
    chapters=[];offset=0;concat=[];metadata=[';FFMETADATA1','title=EVS '+label+' revision']
    for title,file in files:
        seconds=duration(file);chapters.append({'title':title,'start_seconds':round(offset,3),'duration_seconds':round(seconds,3),'file':file.name})
        safe=str(file.resolve()).replace('\\','/').replace("'","'\\''")
        concat.append("file '"+safe+"'")
        clean=title.replace('=','\\=').replace(';','\\;').replace('#','\\#')
        metadata.extend(['[CHAPTER]','TIMEBASE=1/1000',f'START={round(offset*1000)}',f'END={round((offset+seconds)*1000)}',f'title={clean}'])
        offset+=seconds
    listing=video.OUT/(label+'.concat.txt');listing.write_text('\n'.join(concat),encoding='utf-8')
    meta=video.OUT/(label+'.ffmetadata');meta.write_text('\n'.join(metadata),encoding='utf-8')
    output=video.OUT/(label+'.mp4')
    subprocess.run([video.FFMPEG,'-y','-v','error','-f','concat','-safe','0','-i',str(listing),'-i',str(meta),'-map_metadata','1','-map_chapters','1','-c','copy','-movflags','+faststart',str(output)],check=True)
    subprocess.run([video.FFMPEG,'-y','-v','error','-i',str(output),'-vn','-c:a','copy',str(video.OUT/(label+'.m4a'))],check=True)
    actual=duration(output);assert abs(actual-offset)<5,(label,actual,offset)
    manifest.append({'profile':label,'file':output.name,'audio':label+'.m4a','duration_seconds':round(actual,3),'chapters':chapters})
    print(label,'DONE',round(actual/60,2),'minutes',len(chapters),'chapters',flush=True)
(EVS/'qa/course_manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
