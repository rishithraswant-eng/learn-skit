"""Verify light defaults independently of OS and the explicit dark palette."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get('THEME_TEST_URL','http://127.0.0.1:4173/')
with sync_playwright() as p:
    for name,engine in [('chromium',p.chromium),('webkit',p.webkit)]:
        browser=engine.launch(**({'channel':'chrome'} if name=='chromium' else {}))
        for saved in [None,'system','light','dark']:
            page=browser.new_page(viewport={'width':390,'height':844},color_scheme='dark',service_workers='block')
            if saved:
                page.add_init_script('(function(){if(!sessionStorage.themeSeeded){localStorage.setItem("learn-skit-theme",'+repr(saved)+');sessionStorage.themeSeeded="1";}})()')
            page.goto(BASE)
            page.wait_for_function('window.Theme !== undefined')
            expected='dark' if saved=='dark' else 'light'
            assert page.locator('html').get_attribute('data-theme')==expected,(name,saved)
            page.emulate_media(color_scheme='light')
            page.emulate_media(color_scheme='dark')
            assert page.locator('html').get_attribute('data-theme')==expected
            page.evaluate('Theme.set("dark")')
            colors=page.evaluate('''()=>{let s=getComputedStyle(document.documentElement);return {bg:getComputedStyle(document.body).backgroundColor,text:s.getPropertyValue('--text').trim(),accent:s.getPropertyValue('--accent').trim()}}''')
            assert colors=={'bg':'rgb(28, 29, 32)','text':'#F2F0E9','accent':'#FFC928'},colors
            page.reload()
            page.wait_for_function('window.Theme !== undefined')
            assert page.locator('html').get_attribute('data-theme')=='dark'
            page.evaluate('Theme.set("system")')
            assert page.locator('html').get_attribute('data-theme')=='light'
            print('PASS',name,'saved='+str(saved),flush=True)
            page.close()
        browser.close()
