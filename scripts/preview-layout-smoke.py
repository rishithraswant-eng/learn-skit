"""Check landing samples stay readable across narrow and desktop layouts."""
import runpy
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
mock=runpy.run_path(str(ROOT/'scripts/browser-smoke.py'))['mock']
BASE='http://127.0.0.1:4173/'
with sync_playwright() as p:
    for name,engine in [('chromium',p.chromium),('webkit',p.webkit)]:
        browser=engine.launch(**({'channel':'chrome'} if name=='chromium' else {}))
        for width in [320,390,831,1191]:
            page=browser.new_page(viewport={'width':width,'height':763},service_workers='block',reduced_motion='reduce')
            page.route('https://**/*',lambda r:r.abort())
            page.route('**/js/vendor/supabase.js',lambda r:r.fulfill(content_type='text/javascript',body=mock))
            page.goto(BASE)
            page.locator('#stack .top .q').wait_for()
            for theme in ['light','dark']:
                page.evaluate('(theme)=>document.documentElement.dataset.theme=theme',theme)
                for subject in ['evs','skills-1']:
                    page.locator('#demoA [data-s="'+subject+'"]').click()
                    for sample in range(6):
                        metrics=page.locator('#stack .top .preview-reading-card').evaluate('''e=>{const r=e.getBoundingClientRect();return {scroll:e.scrollHeight,client:e.clientHeight,visible:[...e.children].every(c=>{const b=c.getBoundingClientRect();return b.top>=r.top&&b.bottom<=r.bottom+1}),width:document.documentElement.scrollWidth<=innerWidth+1}}''')
                        assert metrics['scroll']<=metrics['client']+1 and metrics['visible'] and metrics['width'],(name,width,theme,subject,sample,metrics)
                        page.locator('#nextCard').click()
                        page.wait_for_timeout(30)
                opts=page.locator('#demoB .opts').bounding_box()
                sol=page.locator('#demoB .sol').bounding_box()
                assert sol['y']>=opts['y']+opts['height']+24,(name,width,theme,opts,sol)
                if width in [831,1191] and theme=='dark':
                    page.locator('#demoA').screenshot(path=str(ROOT/f'private-build/preview-{name}-{width}.png'))
            print('PASS',name,width,flush=True)
            page.close()
        browser.close()
