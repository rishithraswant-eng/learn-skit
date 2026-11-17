"""Local browser integration checks with a fake Supabase server; no real sign-in."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
rows = json.loads((ROOT / 'private-build/content.json').read_text(encoding='utf-8'))
mock = """
window.supabase = {createClient() { return {
 auth:{onAuthStateChange(cb){setTimeout(()=>cb('INITIAL_SESSION',{user:{id:'browser-test'}}),0);},getSession:async()=>({data:{session:{user:{id:'browser-test'}}}}),signOut:async()=>({error:null})},
 storage:{from(){return {createSignedUrl:async()=>({data:{signedUrl:'http://127.0.0.1:4173/private-test-video.mp4'},error:null})}}},
 rpc:async(name)=>({data:name==='study_public_stats'?{registered_users:1,questions_answered:2}:{},error:name==='study_admin_dashboard'?{message:'Admin access required'}:null}),
 from(table){ const query={select(){return query},eq(){return query},order(){return query},range(){return query},then(resolve,reject){if(window.__offlineTest)return Promise.reject(new Error('offline')).then(resolve,reject);return Promise.resolve({data:table==='study_modules'?ROWS:[{kind:'position',item_id:'profile',payload:{onboarding_done:true}}],error:null}).then(resolve,reject)},upsert:async()=>({error:null})};return query;}
}}};
""".replace('ROWS',json.dumps(rows))
def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome')
        page = browser.new_page(viewport={'width':390,'height':844},service_workers='block')
        errors = []
        page.on('pageerror',lambda e: errors.append(str(e)))
        def intercept(route):
            url = route.request.url
            if url.endswith('/js/config.js'):
                route.fulfill(content_type='text/javascript',body='window.LEARN_SKIT_CONFIG={supabaseUrl:"https://mock.invalid",supabaseAnonKey:"anon"};')
            elif url.endswith('/js/vendor/supabase.js'):
                route.fulfill(content_type='text/javascript',body=mock)
            elif not url.startswith('http://127.0.0.1:4173'):
                route.abort()
            else:
                route.continue_()
        page.route('**/*',intercept)
        page.goto('http://127.0.0.1:4173')
        page.wait_for_selector('.hero')
        assert page.locator('header .nav a').count() == 2
        assert page.locator('footer').count() == 0
        for path,selector in [('#/s/evs','.mods'),('#/s/skills-1','.mods'),('#/s/evs/full-test','#start-full-test')]:
            page.goto('http://127.0.0.1:4173/'+path)
            page.wait_for_selector(selector)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), path+' overflows mobile'
            assert 'undefined' not in page.locator('body').inner_text(), path+' has a broken data field'
        page.locator('#start-full-test').click()
        assert page.locator('[data-cursor]').count() == 240
        assert page.evaluate("new Set(LearnSkit.state.position.mock.questionIds).size") == 240
        assert page.locator('header .nav a[aria-current="page"]').inner_text().endswith('EVS')
        page.goto('http://127.0.0.1:4173/#/s/skills-1')
        page.wait_for_selector('.module-group')
        assert page.locator('.mod').count() == 20
        assert page.locator('.module-group').all_text_contents() == ['Quantitative','Qualitative']
        for old in ['quantitative-1','qualitative-1']:
            page.goto('http://127.0.0.1:4173/#/s/'+old)
            page.wait_for_url('**/#/s/skills-1')
        page.goto('http://127.0.0.1:4173/#/predicted/evs')
        page.wait_for_url('**/#/s/evs/full-test')
        page.goto('http://127.0.0.1:4173/#/s/evs/M01/cards')
        page.wait_for_selector('.reading-answer')
        assert page.locator('.reading-answer').inner_text()
        first = page.locator('#card-prompt').inner_text()
        page.locator('#card-next').click()
        second = page.locator('#card-prompt').inner_text()
        assert second != first
        page.locator('#card-prev').click()
        assert page.locator('#card-prompt').inner_text() == first
        page.keyboard.press('ArrowRight')
        page.reload()
        page.wait_for_selector('#card-prompt')
        assert page.locator('#card-prompt').inner_text() == second
        # Keep the current card when navigating away.
        page.goto('http://127.0.0.1:4173/#/s/evs')
        page.goto('http://127.0.0.1:4173/#/s/evs/M01/cards')
        page.wait_for_selector('#card-prompt')
        assert page.locator('#card-prompt').inner_text() == second
        page.goto('http://127.0.0.1:4173/#/s/evs/M01/practice')
        page.wait_for_selector('.opt')
        page.locator('.opt').first.click()
        page.wait_for_selector('.layer.ans')
        selected_id=page.evaluate('LearnSkit.state.position["M01:practice"]')
        page.reload()
        page.wait_for_selector('.layer.ans')
        assert page.evaluate('LearnSkit.state.position["M01:practice"]')==selected_id
        assert page.locator('.opt:disabled').count()==4
        page.locator('#next').click()
        page.wait_for_selector('.stem')
        page.goto('http://127.0.0.1:4173/#/tools/search')
        page.wait_for_selector('#study-search')
        page.locator('#study-search').fill('environmental')
        page.wait_for_selector('#search-results article')
        page.locator('#search-results [data-bookmark]').first.click()
        page.goto('http://127.0.0.1:4173/#/tools/bookmarks')
        page.wait_for_selector('[data-report]')
        page.locator('[data-report]').first.click()
        page.wait_for_selector('dialog[open]')
        page.locator('dialog textarea').fill('Test report from local smoke check.')
        page.locator('dialog button[type=submit],dialog button:not([type])').last.click()
        page.get_by_role('button',name='Close',exact=True).click()
        page.goto('http://127.0.0.1:4173/#/tools/cards')
        page.locator('#start-deck').click()
        page.wait_for_selector('#deck-flip')
        page.locator('#deck-flip').click()
        page.locator('[data-rating="2"]').click()
        assert page.evaluate("Object.keys(LearnSkit.state.position).some(k=>k.startsWith('srs:'))")
        page.goto('http://127.0.0.1:4173/#/tools/mock')
        page.locator('[name=count]').fill('3')
        page.locator('#mock-form button').click()
        page.wait_for_selector('[data-pick]')
        page.locator('[data-pick="0"]').click()
        page.reload()
        page.wait_for_selector('#resume-mock')
        page.locator('#resume-mock').click()
        page.wait_for_selector('[data-pick="0"][aria-pressed=true]')
        page.on('dialog',lambda dialog:dialog.accept())
        page.locator('#mock-submit').click()
        page.wait_for_selector('.question-item')
        page.goto('http://127.0.0.1:4173/#/s/skills-1/QA-TSD/notes')
        page.wait_for_selector('.note-toc')
        assert page.locator('.note section').count()==9
        page.locator('[data-card-preview]').first.click()
        page.locator('dialog button').click()
        page.locator('#note-done').click()
        assert page.evaluate("LearnSkit.state.position['notes:QA-TSD'].done")
        page.goto('http://127.0.0.1:4173/#/tools/settings')
        page.locator('[name=theme]').select_option('dark')
        page.locator('#profile-form button').click()
        assert page.locator('html').get_attribute('data-theme')=='dark'
        page.screenshot(path=str(ROOT/'evs-cat2-content/qa/site-settings-dark.png'),full_page=True)
        page.locator('[name=theme]').select_option('light')
        page.locator('#profile-form button').click()
        page.goto('http://127.0.0.1:4173/#/tools/admin')
        page.wait_for_selector('text=This page needs the connected database and an admin role.')
        page.evaluate("SUBJECTS[0].modules[0].videos={full:'M01/M01.mp4'}")
        page.goto('http://127.0.0.1:4173/#/s/evs/M01/video')
        page.wait_for_selector('video[src]')
        assert page.locator('video').get_attribute('src').endswith('/private-test-video.mp4')
        page.evaluate("const v=document.querySelector('video');v.currentTime=42;v.dispatchEvent(new Event('timeupdate'))")
        assert page.evaluate("LearnSkit.state.position['M01:video:full']") == 42
        page.set_viewport_size({'width':1440,'height':1000})
        page.goto('http://127.0.0.1:4173/#/')
        page.wait_for_selector('.hero')
        page.wait_for_function("() => document.querySelector('#count').textContent === '200'")
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
        page.screenshot(path=str(ROOT/'evs-cat2-content/qa/site-desktop.png'),full_page=True)
        assert not errors, errors
        # With an empty project config, every route stays gated.
        page.unroute('**/*',intercept)
        page.route('https://**/*',lambda route: route.abort())
        page.route('**/js/config.js',lambda route: route.fulfill(content_type='text/javascript',body='window.LEARN_SKIT_CONFIG={};'))
        page.goto('http://127.0.0.1:4173/#/s/evs/full-test')
        page.reload()
        page.wait_for_selector('#gate-action')
        assert page.locator('#start-full-test').count() == 0
        page.set_viewport_size({'width':1191,'height':763})
        assert page.locator('.auth-panel').bounding_box()['width'] > 950
        assert page.locator('.auth-panel').bounding_box()['height'] > 500
        page.screenshot(path=str(ROOT/'evs-cat2-content/qa/site-gated-desktop.png'),full_page=True)
        page.set_viewport_size({'width':390,'height':844})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
        page.screenshot(path=str(ROOT/'evs-cat2-content/qa/site-gated-mobile.png'),full_page=True)
        browser.close()
    print('PASS: mobile/desktop, subject routes, all EVS bonus questions, cards/SRS, search, bookmarks, reporting, saved timed tests, nine-section notes, themes, admin gate, private video resume and sign-in gate. Supabase is mocked.')
    

if __name__ == "__main__": run()
