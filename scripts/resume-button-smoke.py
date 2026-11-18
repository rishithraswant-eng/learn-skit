"""Ensure long resume labels fit inside the landing card on phones."""
import os,runpy
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get('BUTTON_TEST_URL','http://127.0.0.1:4173/')
mock=runpy.run_path(str(ROOT/'scripts/browser-smoke.py'))['mock']
with sync_playwright() as p:
    for name,engine in [('chromium',p.chromium),('webkit',p.webkit)]:
        browser=engine.launch(**({'channel':'chrome'} if name=='chromium' else {}))
        for width in [320,360,390,430,831]:
            page=browser.new_page(viewport={'width':width,'height':763},service_workers='block',reduced_motion='reduce')
            page.route('**/js/vendor/supabase.js',lambda r:r.fulfill(content_type='text/javascript',body=mock))
            page.goto(BASE)
            button=page.locator('.tile-t .row .btn.ink')
            button.wait_for()
            for label in ['Continue: Foundations of Environment','Continue: Indian Environmental Laws and Policy — Environmental Protection and Conservation']:
                button.locator('span').evaluate('(e,text)=>e.textContent=text',label)
                assert button.evaluate('''e=>{let b=e.getBoundingClientRect(),r=e.closest('.tile-t').getBoundingClientRect();return b.left>=r.left&&b.right<=r.right+1&&e.scrollWidth<=e.clientWidth+1}'''),(name,width,label)
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(name,width)
                other=page.locator('.tile-t .row .btn').nth(1).bounding_box()
                b=button.bounding_box()
                assert other['y']>=b['y']+b['height'] or other['x']>=b['x']+b['width'],(name,width,'overlap')
            print('PASS',name,width,flush=True)
            page.close()
        browser.close()
