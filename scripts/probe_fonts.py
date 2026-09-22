import asyncio, urllib.parse
from playwright.async_api import async_playwright

URL = "https://immo-traeum-preview.preview.emergentagent.com"

async def probe(viewport, ua, dsf, label, theme, screenshot):
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=["--use-gl=swiftshader"])
        c = await b.new_context(
            viewport={"width": viewport[0], "height": viewport[1]},
            user_agent=ua, device_scale_factor=dsf,
            has_touch=viewport[0] < 768, is_mobile=viewport[0] < 768,
        )
        pg = await c.new_page()

        errs = []
        pg.on("pageerror", lambda e: errs.append(("perr", str(e)[:200])))
        pg.on("console", lambda m: (m.type == "error") and errs.append(("cerr", m.text[:200])))

        ext_hosts = {}
        own_origin = urllib.parse.urlparse(URL).netloc
        def on_req(r):
            host = urllib.parse.urlparse(r.url).netloc
            if host and host != own_origin:
                ext_hosts.setdefault(host, []).append(r.url[:120])
        pg.on("request", on_req)

        await pg.goto(URL, wait_until="domcontentloaded", timeout=45000)
        await pg.wait_for_timeout(1500)
        if theme == "light":
            await pg.click("[data-testid=theme-toggle]")
            await pg.wait_for_timeout(400)
        # Scroll through page
        for sect in ("#hero", "#leistungen", "#objekte"):
            await pg.evaluate(f"document.querySelector('{sect}')?.scrollIntoView({{block:'start'}})")
            await pg.wait_for_timeout(2500)

        # Check that font is applied to headline
        font_info = await pg.evaluate("""() => {
          const h = document.querySelector('h1');
          if (!h) return null;
          const cs = getComputedStyle(h);
          return { family: cs.fontFamily, weight: cs.fontWeight, size: cs.fontSize };
        }""")

        overflow_ok = await pg.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth + 1")

        # Screenshot at hero
        await pg.evaluate("document.getElementById('hero')?.scrollIntoView({block:'start'})")
        await pg.wait_for_timeout(500)
        await pg.screenshot(path=screenshot, quality=50, type="jpeg")

        print(f"\n=== {label} · {viewport[0]}x{viewport[1]} · {theme} ===")
        print(f"  h1 font: {font_info}")
        print(f"  overflow_ok: {overflow_ok}   errors: {len(errs)}")
        print(f"  external hosts: {len(ext_hosts)}")
        for h, urls in ext_hosts.items():
            print(f"    {h}: {len(urls)} req(s)")
            for u in urls[:2]:
                print(f"      - {u}")
        await b.close()

async def main():
    ua_dt = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36"
    ua_ios = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"
    import os
    os.makedirs("/app/screenshots", exist_ok=True)
    await probe((1440, 900), ua_dt, 1, "Desktop", "dark",  "/app/screenshots/font_desktop_dark.jpg")
    await probe((1440, 900), ua_dt, 1, "Desktop", "light", "/app/screenshots/font_desktop_light.jpg")
    await probe((390, 844), ua_ios, 3, "iPhone", "dark",  "/app/screenshots/font_iphone_dark.jpg")

asyncio.run(main())
