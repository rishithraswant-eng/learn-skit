"""Exercise R2 signing and direct media requests without live credentials."""
import runpy,json,re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];BASE='http://127.0.0.1:4173/'
mock=runpy.run_path(str(ROOT/'scripts/browser-smoke.py'))['mock'].replace("session:{user:{id:'browser-test'}}","session:{user:{id:'browser-test'},access_token:'fixture-session'}")
def wait_video(page):
 for _ in range(100):
  if page.evaluate('() => !!document.querySelector("video") && document.querySelector("video").readyState >= 1'):return
  page.wait_for_timeout(100)
 raise AssertionError(page.locator('body').inner_text()[-1200:])

# Windows Playwright WebKit rejects both fixture H.264 files, including a known
# standard MP4. Decode checks here use Chrome; verify native Safari separately.
with sync_playwright() as p:
 for name,engine in [('chromium',p.chromium)]:
  browser=engine.launch(**({'channel':'chrome'} if name=='chromium' else {}));page=browser.new_page(viewport={'width':390,'height':844},service_workers='block');calls=[];storage=[]
  page.on('request',lambda request:storage.append(request.url) if '/storage/v1/' in request.url else None)
  page.route('**/js/vendor/supabase.js',lambda r:r.fulfill(content_type='text/javascript',body=mock))
  page.route('**/js/config.js',lambda r:r.fulfill(content_type='text/javascript',body='window.LEARN_SKIT_CONFIG={supabaseUrl:"https://fixture.invalid",supabaseAnonKey:"fixture",mediaProvider:"r2"};'))
  def sign(route):
   assert route.request.headers['authorization']=='Bearer fixture-session'
   paths=route.request.post_data_json['paths'];calls.extend(paths)
   route.fulfill(content_type='application/json',body=json.dumps({'data':[{'path':key,'signedUrl':'https://fixture.r2.cloudflarestorage.com/'+key+'?temporary=1'} for key in paths]}))
  page.route('**/api/media-urls',sign)
  def media(route):
   key=route.request.url.split('fixture.r2.cloudflarestorage.com/')[1].split('?')[0]
   path=ROOT/'evs-cat2-content/video/out'/key if key.startswith('course/') else ROOT/'evs-cat2-content/video/out'/key.split('/')[1]
   kind='application/vnd.apple.mpegurl' if key.endswith('.m3u8') else 'text/vtt' if key.endswith('.vtt') else 'video/iso.segment' if key.endswith('.m4s') else 'video/mp4'
   data=path.read_bytes();headers={'Access-Control-Allow-Origin':'*','Accept-Ranges':'bytes','Access-Control-Expose-Headers':'Content-Range, Content-Length, Accept-Ranges'}
   requested=route.request.headers.get('range');status=200
   if requested and (match:=re.match(r'bytes=(\d+)-(\d*)',requested)):
    start=int(match[1]);end=min(int(match[2]) if match[2] else len(data)-1,len(data)-1);headers['Content-Range']=f'bytes {start}-{end}/{len(data)}';data=data[start:end+1];status=206
   route.fulfill(status=status,body=data,content_type=kind,headers=headers)
  page.route('https://fixture.r2.cloudflarestorage.com/**',media)
  page.goto(BASE+'#/s/evs/M01/video');wait_video(page);assert 'M01/M01.mp4' in calls
  page.goto(BASE+'#/s/evs/videos');page.locator('#library-mode').select_option('course');page.locator('#library-pace').select_option('blitz')
  wait_video(page);assert any('course/blitz/segment-' in key for key in calls)
  assert not storage,storage
  print('PASS',name,'R2 lesson and combined-course playback, no Supabase media requests',flush=True);browser.close()
