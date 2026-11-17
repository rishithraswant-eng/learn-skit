"""Local fixture checks for offline privacy, service-worker shell and admin UI."""
import importlib.util,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('fixture',ROOT/'scripts/browser-smoke.py')
fixture=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixture)
dashboard={'metrics':{'registered_users':1,'questions_answered':2},'users':[{'id':'fixture-user','name':'Fixture User','questions_answered':2}],
 'reports':[{'id':'test-report','item_id':'Q-M01-001','category':'Typo','details':'Fixture only','status':'open'}],
 'pages':[{'page':'#/','views':3}],'devices':[{'device':'desktop','views':3}],'sources':[{'source':'direct','views':3}],
 'funnel':{'registered':1},'retention':[],'content':[{'subject':'evs','module_id':'M01','cards':20,'core_questions':6,'bonus_questions':2,'review_status':'source_checked','open_reports':1}],'system':{'locations':'Not collected'}}
rpc="rpc:async(name)=>({data:name==='study_admin_dashboard'?"+json.dumps(dashboard)+":name==='study_admin_user'?{attempts:[{question_id:'Q-M01-001',is_correct:true}],events:[]}:name==='study_is_admin'?true:{},error:null}),"
old="rpc:async(name)=>({data:name==='study_public_stats'?{registered_users:1,questions_answered:2}:{},error:name==='study_admin_dashboard'?{message:'Admin access required'}:null}),"
mock=fixture.mock.replace(old,rpc)
assert mock!=fixture.mock
mock=mock.replace("createSignedUrl:async()=>({data:{signedUrl:'http://127.0.0.1:4173/private-test-video.mp4'},error:null})",
    "createSignedUrl:async path=>({data:{signedUrl:'http://127.0.0.1:4173/test-media/'+path},error:null}),"
    "createSignedUrls:async paths=>({data:paths.map(path=>({path,signedUrl:'http://127.0.0.1:4173/test-media/'+path})),error:null})")
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome')
    context=browser.new_context(viewport={'width':1440,'height':1000},service_workers='block')
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    def intercept(route):
        url=route.request.url
        if url.endswith('/js/config.js'):route.fulfill(content_type='text/javascript',body='window.LEARN_SKIT_CONFIG={supabaseUrl:"https://mock.invalid",supabaseAnonKey:"anon"};')
        elif url.endswith('/js/vendor/supabase.js'):route.fulfill(content_type='text/javascript',body=mock)
        elif '/test-media/course/' in url:
            file=ROOT/'evs-cat2-content/video/out'/url.split('/test-media/')[1]
            content_type={'.m3u8':'application/vnd.apple.mpegurl','.vtt':'text/vtt'}.get(file.suffix,'video/mp4')
            route.fulfill(path=str(file), content_type=content_type)
        elif not url.startswith('http://127.0.0.1:4173'):route.abort()
        else:route.continue_()
    page.route('**/*',intercept);page.goto('http://127.0.0.1:4173/#/tools/admin')
    page.wait_for_selector('[data-admin-section]')
    for section in ['users','traffic','funnel','retention','content','reports','system','overview']:
        page.locator('[data-admin-section="'+section+'"]').click()
        if section=='users':
            page.locator('[data-admin-user]').click();page.wait_for_selector('text=Recent attempts')
            page.locator('#admin-user-search').fill('absent');assert not page.locator('[data-user-row]').is_visible()
        if section=='reports':
            page.locator('[data-report-status]').select_option('resolved');page.wait_for_selector('text=Status saved.')
    page.goto('http://127.0.0.1:4173/#/s/evs/videos');page.wait_for_selector('#library-player[src]')
    assert page.locator('#library-lesson option').count()==17
    page.locator('#library-pace').select_option('blitz');page.locator('#library-speed').select_option('1.5')
    assert page.evaluate('document.querySelector("#library-player").playbackRate')==1.5
    page.locator('#library-lesson').select_option('M17')
    page.locator('#library-mode').select_option('course')
    page.wait_for_function("() => document.querySelector('#library-player').duration > 600")
    assert page.locator('#library-lesson').input_value()=='INTRO'
    source=page.locator('#library-player').get_attribute('src')
    assert source.startswith('blob:')
    page.locator('#library-lesson').select_option('M17')
    page.wait_for_function("() => document.querySelector('#library-player').currentTime > 600")
    assert page.locator('#library-player').get_attribute('src')==source
    page.evaluate("() => document.querySelector('#library-player').play()")
    page.wait_for_function("() => document.querySelector('#library-player').currentTime > 610")
    page.evaluate("() => document.querySelector('#library-player').pause()")
    page.reload()
    page.wait_for_function("() => document.querySelector('#library-player').currentTime > 600")
    assert page.locator('#library-mode').input_value()=='course'
    page.wait_for_function("() => document.querySelector('#library-lesson').value === 'M17'")
    page.locator('#library-mode').select_option('lesson')
    assert page.locator('#library-lesson').input_value()=='M17'
    assert page.locator('#library-lesson-nav').is_visible()
    for module in ['QL-RC','QL-SEAT']:
        page.goto('http://127.0.0.1:4173/#/s/skills-1/'+module+'/practice');page.wait_for_selector('.question-group')
        assert len(page.locator('.question-group').inner_text())>100
    page.goto('http://127.0.0.1:4173/#/s/evs/M01/notes');page.locator('#note-done').click()
    assert page.evaluate('LearnSkit.state.position["notes:M01"].done')
    for width in [320,2560]:
        page.set_viewport_size({'width':width,'height':1000});page.goto('http://127.0.0.1:4173/#/tools')
        page.wait_for_selector('.tool-grid');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
    # Only this same authenticated account can reuse its cached pack offline.
    assert page.evaluate('async()=>!!(await PrivateStudyCache.read("browser-test"))')
    page.evaluate('window.__offlineTest=true');context.set_offline(True)
    page.evaluate('()=>LearnSkit.retry()');page.wait_for_selector('.tool-grid')
    assert page.evaluate('SUBJECTS[0].modules[0].cards.length>0')
    page.goto('http://127.0.0.1:4173/#/tools/cards');page.locator('#start-deck').click();page.wait_for_selector('#deck-flip')
    context.set_offline(False);page.evaluate('window.__offlineTest=false')
    page.evaluate('()=>LearnSkit.signOut()');page.wait_for_selector('#gate-action')
    assert page.evaluate('async()=>!(await PrivateStudyCache.read("browser-test"))')
    assert page.evaluate('SUBJECTS.every(s=>s.modules.every(m=>!m.cards))')
    assert not errors,errors;context.close()
    # Real app shell, real unconfigured SDK, real service worker; no private fixture.
    context=browser.new_context(viewport={'width':390,'height':844});page=context.new_page()
    page.route('https://**/*',lambda route:route.abort())
    page.goto('http://127.0.0.1:4173/');page.wait_for_selector('#gate-action')
    page.evaluate('async()=>{await navigator.serviceWorker.ready; if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener("controllerchange",r,{once:true}));}')
    urls=page.evaluate('async()=>{let urls=[];for(const k of await caches.keys())for(const r of await(await caches.open(k)).keys())urls.push(r.url);return urls;}')
    assert len(urls)>=15
    assert all('/rest/' not in u and '/storage/' not in u and 'private-build' not in u for u in urls)
    context.set_offline(True);page.reload();page.wait_for_selector('#gate-action')
    assert page.locator('.auth-panel').is_visible()
    assert page.locator('.pq').count()==0
    browser.close()
print('PASS: admin fixture screens/actions, playlist, shared contexts, EVS read markers, 320/2560 layouts, private same-account offline pack, sign-out cleanup and real offline PWA shell.')
