import asyncio
from playwright.async_api import async_playwright
URL = "https://immo-traeum-preview.preview.emergentagent.com"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--use-gl=swiftshader"])
        ctx = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await ctx.new_page()
        matches = []
        def on_req(r):
            u = r.url
            if "twin" in u or "rorschach" in u or "draco" in u or ".glb" in u:
                matches.append(("REQ", u))
        def on_resp(r):
            u = r.url
            if "twin" in u or "rorschach" in u or "draco" in u or ".glb" in u:
                cl = r.headers.get("content-length", "?")
                matches.append(("RESP", r.status, cl, u))
        page.on("request", on_req)
        page.on("response", on_resp)
        errs = []
        page.on("pageerror", lambda e: errs.append(("PERR", str(e)[:400])))
        page.on("console", lambda m: errs.append((m.type.upper(), m.text[:400])) if m.type in ("error","warning") else None)
        await page.goto(URL, wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_timeout(1500)
        await page.evaluate("document.getElementById('objekte').scrollIntoView({block:'center'})")
        await page.wait_for_timeout(8000)
        print("=== TWIN/RORSCHACH/DRACO REQUESTS ===")
        for m in matches:
            print(" ", m)
        print(f"\n=== ERRORS/WARNINGS ({len(errs)}) ===")
        for t, m in errs[:12]:
            print(f"  [{t}] {m}")
        # Scene mesh count
        state = await page.evaluate("""() => {
          const c = document.querySelector('#objekge canvas') || document.querySelector('#objekte canvas');
          // We can't easily access r3f scene from outside; look for canvas dims + timing marker
          return { canvas_present: !!c };
        }""")
        print(f"\ncanvas: {state}")
        await browser.close()

asyncio.run(main())
