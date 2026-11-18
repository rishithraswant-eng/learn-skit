"""Phone layout and interaction regression checks in Chromium and WebKit."""
import json
import runpy
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = "http://127.0.0.1:4173/"
mock = runpy.run_path(str(ROOT / "scripts/browser-smoke.py"))["mock"]
results = []

with sync_playwright() as p:
    for engine, launcher in [("chromium", p.chromium), ("webkit", p.webkit)]:
        browser = launcher.launch(**({"channel": "chrome"} if engine == "chromium" else {}))
        for width, height in [(320, 568), (390, 844), (430, 932)]:
            context = browser.new_context(
                viewport={"width": width, "height": height},
                device_scale_factor=2, is_mobile=True, has_touch=True,
                service_workers="block",
            )
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.route("https://**/*", lambda route: route.abort())
            page.goto(BASE)
            page.locator(".hero-headline").wait_for()
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), (engine, width, "landing")
            assert page.locator(".hero-headline").evaluate("e => getComputedStyle(e).animationName") == "none"
            assert page.locator(".hero-atmosphere-svg [filter]").first.evaluate("e => getComputedStyle(e).filter") == "none"
            assert page.evaluate("document.fonts.check('800 20px \"Plus Jakarta Sans\"')")
            page.locator("#theme-toggle").tap()
            assert page.locator("html").get_attribute("data-theme") == "dark"
            if width == 390:
                page.screenshot(path=str(ROOT / f"private-build/mobile-{engine}-dark.png"))
            page.locator("#theme-toggle").tap()
            page.route("**/js/vendor/supabase.js", lambda route: route.fulfill(content_type="text/javascript", body=mock))
            page.reload()
            page.locator(".hero").wait_for()
            for route in [
                "#/s/evs", "#/s/skills-1",
                "#/s/skills-1/QL-SYN/cards", "#/s/skills-1/QA-TSD/notes",
                "#/s/skills-1/full-practice", "#/s/evs/videos", "#/tools/settings",
            ]:
                page.goto(BASE + route)
                page.wait_for_timeout(60)
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), (engine, width, route)
                assert page.locator("header.top").bounding_box()["height"] < 150, (engine, width, "header")
                if route.endswith("/cards"):
                    page.locator("#card-next").tap()
                    assert "2 of" in page.locator(".sess-top").inner_text()
                    page.locator("#card-prev").tap()
                    assert "1 of" in page.locator(".sess-top").inner_text()
                    nav = page.locator(".reading-nav").bounding_box()
                    assert nav["y"] >= 0 and nav["y"] + nav["height"] <= height + 1
                if route.endswith("/full-practice"):
                    page.locator("#start-full-practice").tap()
                    page.locator("[data-practice-pick]").first.tap()
                    page.locator(".practice-feedback").wait_for()
                    assert page.locator(".opt.ok").count() == 1
                    assert page.locator(".mock-toolbar").evaluate("e => getComputedStyle(e).position") != "sticky"
                    page.locator("#practice-next").tap()
                    assert "Question 2/240" in page.locator(".qmeta").first.inner_text()
                if route.endswith("/settings"):
                    assert page.locator("[name=name]").evaluate("e => parseFloat(getComputedStyle(e).fontSize)") >= 16
            assert not errors, (engine, width, errors)
            results.append({"engine": engine, "width": width, "height": height, "status": "PASS"})
            print(engine, width, "PASS", flush=True)
            context.close()
        browser.close()

(ROOT / "private-build/mobile-checks.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
print("PASS: six mobile viewport/engine combinations, touch navigation, feedback, font loading and layout.")
