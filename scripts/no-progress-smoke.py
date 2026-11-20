import json,runpy
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];rows=(ROOT/'private-build/content.json').read_text()
mock=runpy.run_path(str(ROOT/'scripts/browser-smoke.py'))['mock'].replace("session:{user:{id:'browser-test'}}","session:{user:{id:'browser-test'},access_token:'fixture-session'}").replace('rpc:async(name)=>({data:','rpc:async(name)=>(window.__rpcCalls.push(name),{data:').replace('from(table){','from(table){window.__tableCalls.push(table);')
with sync_playwright() as p:
 for name,engine in [('chromium',p.chromium),('webkit',p.webkit)]:
  b=engine.launch(**({'channel':'chrome'} if name=='chromium' else {}));page=b.new_page(viewport={'width':390,'height':844},service_workers='block');page.add_init_script('window.__rpcCalls=[];window.__tableCalls=[];window.__progressWrites=[];const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith("learn-skit:v2:"))window.__progressWrites.push(k);return original.call(this,k,v)}')
  page.route('**/js/vendor/supabase.js',lambda r:r.fulfill(content_type='text/javascript',body=mock))
  page.route('**/api/media-urls',lambda r:r.fulfill(content_type='application/json',body=json.dumps({'data':[{'path':key,'signedUrl':'https://test.r2.cloudflarestorage.com/'+key} for key in r.request.post_data_json['paths']]})))
  page.route('https://test.r2.cloudflarestorage.com/study-content/modules.json',lambda r:r.fulfill(content_type='application/json',body=rows,headers={'Access-Control-Allow-Origin':'*'}))
  page.goto('http://127.0.0.1:4173/#/s/evs/full-practice');page.locator('#start-full-practice').click();page.locator('[data-practice-pick]').first.click();page.locator('.practice-feedback').wait_for()
  assert page.evaluate('Object.keys(LearnSkit.state.mcq).length')>0
  page.clock.install();page.clock.run_for(65000)
  assert page.evaluate('window.__rpcCalls.length')==0,page.evaluate('window.__rpcCalls')
  assert page.evaluate('window.__tableCalls.length')==0,page.evaluate('window.__tableCalls')
  assert page.evaluate('window.__progressWrites.length')==0
  page.reload();page.locator('#start-full-practice').wait_for();assert page.locator('#resume-full-practice').count()==0
  assert page.evaluate('Object.keys(LearnSkit.state.mcq).length')==0
  print('PASS',name,'R2 course load, answer feedback, zero progress/analytics requests, zero progress storage, fresh reload',flush=True);b.close()
