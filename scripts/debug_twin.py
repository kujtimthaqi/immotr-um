import asyncio
from playwright.async_api import async_playwright
URL = "https://immo-traeum-preview.preview.emergentagent.com"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--use-gl=swiftshader"])
        ctx = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await ctx.new_page()
        all_reqs = []
        def on_resp(r):
            if "3d.geo.admin.ch" in r.url or "swisstopo" in r.url:
                cl = r.headers.get("content-length", "?")
                all_reqs.append((r.status, cl, r.url[-100:]))
        page.on("response", on_resp)
        errors = []
        page.on("pageerror", lambda e: errors.append(("perr", str(e)[:400])))
        page.on("console", lambda m: errors.append((m.type, m.text[:400])))
        await page.goto(URL, wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_timeout(1500)
        await page.evaluate("document.getElementById('objekte').scrollIntoView({block:'center'})")
        await page.wait_for_timeout(20000)  # 20s
        # After tiles-should-load, inspect tileset
        state = await page.evaluate("""() => {
          const c = document.querySelector('#objekte canvas');
          const g = c?.__r3f?.state?.scene;
          let meshes = 0, groups = 0;
          if (g) g.traverse(o => { if (o.isMesh) meshes++; if (o.isGroup) groups++; });
          return { meshes, groups };
        }""")
        print(f"\nScene: {state}")
        print(f"\nSwisstopo requests ({len(all_reqs)}):")
        for st, cl, u in all_reqs:
            print(f"  [{st}] {cl} bytes  ...{u}")
        print(f"\nConsole ({len(errors)}):")
        for t, m in errors[:15]:
            if t in ("perr", "error", "warning"):
                print(f"  [{t}] {m}")
        await browser.close()

asyncio.run(main())
