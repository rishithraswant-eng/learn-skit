"""Verify the reported blood-relation question is complete on both practice routes."""
import os,runpy
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get('REPORT_TEST_URL','http://127.0.0.1:4173/')
mock=runpy.run_path(str(ROOT/'scripts/browser-smoke.py'))['mock']
with sync_playwright() as p:
 for name,engine in [('chromium',p.chromium),('webkit',p.webkit)]:
  b=engine.launch(**({'channel':'chrome'} if name=='chromium' else {}));page=b.new_page(viewport={'width':390,'height':844},service_workers='block')
  page.route('**/js/vendor/supabase.js',lambda r:r.fulfill(content_type='text/javascript',body=mock))
  page.goto(BASE+'#/s/skills-1');page.locator('.mods').wait_for()
  page.evaluate('''()=>{let id='MCQ-BLOOD-007';LearnSkit.state.position['practice-run:QL-BLOOD']={id:'report-check',seed:1,order:[id],answers:{},startedAt:Date.now()};LearnSkit.state.position['QL-BLOOD:practice']=id;}''')
  page.goto(BASE+'#/s/skills-1/QL-BLOOD/practice')
  stem=page.locator('.session .stem');stem.wait_for()
  for clue in ['A#B','A@B','R#S','S@T','T#U','share both biological parents','How is R related to U?']:assert clue in stem.inner_text(),(name,clue)
  assert page.locator('.question-group').count()==0
  page.locator('.session [data-i="0"]').click();assert 'paternal grandfather' in page.locator('#layers').inner_text()
  assert page.locator('.opt.ok').count()==1
  page.evaluate('''()=>{LearnSkit.state.position['full-practice:skills-1']={id:'report-check-all',seed:1,questionIds:['MCQ-BLOOD-007'],answers:{},marked:{},cursor:0,startedAt:Date.now()}}''')
  page.goto(BASE+'#/s/skills-1/full-practice');page.locator('#resume-full-practice').click()
  assert 'R#S' in page.locator('.workspace h2').first.inner_text()
  assert page.locator('.question-group').count()==0
  page.locator('[data-practice-pick="0"]').click();assert 'paternal grandfather' in page.locator('#practice-answer-feedback').inner_text()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  print('PASS',name,'complete prompt, correct feedback, module and full-syllabus practice',flush=True);b.close()

