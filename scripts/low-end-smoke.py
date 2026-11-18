"""Check practice responsiveness and fallback APIs on constrained phone profiles."""
import json
import runpy
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
mock = runpy.run_path(str(ROOT / "scripts/browser-smoke.py"))["mock"]
base = "http://127.0.0.1:4173/"
results = []
legacy = """
Object.hasOwn = undefined;
Array.prototype.at = undefined;
Array.prototype.findLast = undefined;
Object.defineProperty(crypto, 'randomUUID', {value:undefined,configurable:true,writable:true});
Object.defineProperty(navigator, 'hardwareConcurrency', {get:()=>2});
Object.defineProperty(navigator, 'deviceMemory', {get:()=>2});
"""

with sync_playwright() as p:
    for name, engine in [("chromium", p.chromium), ("webkit", p.webkit)]:
        browser = engine.launch(**({"channel": "chrome"} if name == "chromium" else {}))
        page = browser.new_page(
            viewport={"width": 360, "height": 640},
            is_mobile=True, has_touch=True, service_workers="block",
        )
        page.add_init_script(legacy)
        page.set_default_timeout(10000)
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        if name == "chromium":
            session = page.context.new_cdp_session(page)
            session.send("Emulation.setCPUThrottlingRate", {"rate": 6})
        page.route("https://**/*", lambda route: route.abort())
        page.route("**/js/vendor/supabase.js", lambda route: route.fulfill(content_type="text/javascript", body=mock))
        page.goto(base + "#/s/skills-1/full-practice")
        page.locator("#start-full-practice").click()
        assert page.locator("html").evaluate("e=>e.classList.contains('reduced-effects')")
        assert page.locator("[data-practice-cursor]").count() == 20
        measurement = page.evaluate("""async () => {
            let writes=0, characters=0;
            const original=Storage.prototype.setItem;
            Storage.prototype.setItem=function(key,value){
                writes++; characters+=value.length; return original.call(this,key,value);
            };
            const before=document.querySelectorAll('*').length;
            const start=performance.now();
            document.querySelector('[data-practice-pick]').dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}));
            const handler=performance.now()-start;
            await new Promise(resolve=>requestAnimationFrame(resolve));
            Storage.prototype.setItem=original;
            return {handler_ms:handler,storage_writes:writes,serialized_chars:characters,nodes:before};
        }""")
        page.locator(".practice-feedback").wait_for()
        selected = page.evaluate("LearnSkit.state.position['full-practice:skills-1'].answers")
        page.locator("#practice-jump input").fill("240")
        page.locator("#practice-jump button[type=submit]").click()
        assert "Question 240/240" in page.locator(".qmeta").first.inner_text()
        page.locator("[data-question-page='-20']").click()
        assert "Question 201/240" in page.locator(".qmeta").first.inner_text()
        page.reload()
        page.locator("#resume-full-practice").click()
        assert "Question 201/240" in page.locator(".qmeta").first.inner_text()
        assert page.evaluate("LearnSkit.state.position['full-practice:skills-1'].answers") == selected
        page.goto(base + "#/tools/search")
        page.locator("#study-search").fill("environment")
        page.locator("#search-results article").first.wait_for()
        page.goto(base + "#/s/skills-1/QL-SYN/cards")
        page.locator("#card-next").click()
        page.reload()
        page.locator("#card-prompt").wait_for()
        assert "2 of" in page.locator(".sess-top").inner_text()
        page.goto(base + "#/s/evs/videos")
        page.locator("#library-mode").wait_for()
        assert page.evaluate("typeof Object.hasOwn === 'function' && typeof [].findLast === 'function' && typeof crypto.randomUUID === 'function'")
        assert not errors, errors
        results.append({"engine": name, **measurement, "status": "PASS"})
        print(name, json.dumps(measurement), "PASS", flush=True)
        browser.close()
(ROOT / "private-build/low-end-checks.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
