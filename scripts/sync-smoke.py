"""Regression: bookmark removal, stranded cache replay, failure and recovery."""
import os,runpy,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get('SYNC_TEST_URL','http://127.0.0.1:4173/')
mock=runpy.run_path(str(ROOT/'scripts/browser-smoke.py'))['mock']
mock=mock.replace('upsert:async()=>({error:null})',"upsert:async(rows)=>{(window.__syncWrites||=[]).push(...rows);return {error:window.__syncFail?{code:'NETWORK_ERROR'}:rows.some(r=>r.payload==null)?{code:'23502'}:null}}")
seed={'state':{'position':{'bookmark:old':None},'box':{'old-card':3}},'pending':[['position:bookmark:old',{'user_id':'browser-test','kind':'position','item_id':'bookmark:old','payload':None}],['box:old-card',{'user_id':'browser-test','kind':'box','item_id':'old-card','payload':3}]]}
with sync_playwright() as p:
 for name,engine in [('chromium',p.chromium),('webkit',p.webkit)]:
  browser=engine.launch(**({'channel':'chrome'} if name=='chromium' else {}))
  page=browser.new_page(viewport={'width':390,'height':844},service_workers='block')
  page.add_init_script('if(!sessionStorage.syncSeeded){localStorage.setItem("learn-skit:v2:browser-test",'+json.dumps(json.dumps(seed))+');sessionStorage.syncSeeded="1"}')
  page.route('**/js/vendor/supabase.js',lambda r:r.fulfill(content_type='text/javascript',body=mock))
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE+'#/s/evs/M01/cards')
  page.locator('[data-bookmark]').wait_for()
  page.evaluate('LearnSkit.flush()')
  assert page.evaluate('LearnSkit.syncStatus.pending===0 && LearnSkit.syncStatus.error===null')
  assert page.evaluate('window.__syncWrites.some(r=>r.item_id==="bookmark:old"&&r.payload.__learn_skit_null===true)')
  button=page.locator('[data-bookmark]').first
  button.click();button.click()
  assert button.get_attribute('aria-pressed')=='false'
  page.evaluate('LearnSkit.flush()')
  assert page.evaluate('LearnSkit.syncStatus.pending===0 && LearnSkit.syncStatus.error===null')
  page.evaluate('''() => {
    const original=window.fetch;
    window.fetch=async (url,options)=>{
      if(String(url).includes('/rest/v1/study_progress')){
        window.__exitRows=JSON.parse(options.body);
        return new Response(null,{status:204});
      }
      return original(url,options);
    };
    LearnSkit.put('position','bookmark:exit-test',null);
    dispatchEvent(new Event('pagehide'));
  }''')
  page.wait_for_function('window.__exitRows?.some(row=>row.item_id==="bookmark:exit-test"&&row.payload.__learn_skit_null===true)')
  page.evaluate('LearnSkit.flush()')
  page.evaluate('window.__syncFail=true;LearnSkit.put("position","test-retry",{cursor:3});LearnSkit.flush()')
  assert page.evaluate('LearnSkit.syncStatus.pending===1 && !!LearnSkit.syncStatus.error')
  page.evaluate('window.__syncFail=false;document.dispatchEvent(new Event("visibilitychange"))')
  page.wait_for_function('LearnSkit.syncStatus.pending===0 && LearnSkit.syncStatus.error===null')
  assert 'restored' in page.locator('#toast').inner_text()
  assert not errors,errors
  print('PASS',name,'stuck-cache replay, bookmark removal and reconnect recovery',flush=True)
  browser.close()
