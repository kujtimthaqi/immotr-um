import asyncio
from playwright.async_api import async_playwright

URL = "https://immo-traeum-preview.preview.emergentagent.com"

async def probe(viewport, ua, dsf, label, theme="dark"):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--use-gl=swiftshader"])
        ctx = await browser.new_context(
            viewport={"width": viewport[0], "height": viewport[1]},
            user_agent=ua,
            device_scale_factor=dsf,
            has_touch=viewport[0] < 768,
            is_mobile=viewport[0] < 768,
        )
        page = await ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(("perr", str(e)[:200])))
        page.on("console", lambda m: (m.type == "error") and "webglcontextlost" not in m.text.lower() and errors.append(("cerr", m.text[:200])))

        transfer = {"total": 0, "twin_glb": 0, "swisstopo": 0, "draco_wasm": 0}
        def on_resp(r):
            try:
                cl = int(r.headers.get("content-length") or 0)
                transfer["total"] += cl
                if "/twin/rorschach" in r.url and r.url.endswith(".glb"):
                    transfer["twin_glb"] += cl
                if "3d.geo.admin.ch" in r.url:
                    transfer["swisstopo"] += cl
                if "gstatic.com/draco" in r.url:
                    transfer["draco_wasm"] += cl
            except Exception:
                pass
        page.on("response", on_resp)

        await page.goto(URL, wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_timeout(1500)

        if theme == "light":
            await page.click("[data-testid=theme-toggle]")
            await page.wait_for_timeout(500)

        await page.evaluate("document.getElementById('objekte').scrollIntoView({block:'start'})")
        await page.wait_for_timeout(1500)
        # Wait for GLB + draco decode
        await page.wait_for_timeout(5000)

        # Canvas check
        info = await page.evaluate("""() => {
          const c = document.querySelector('#objekte canvas');
          const rt = document.querySelector('[data-testid=real-digital-twin]');
          const attr = document.querySelector('[data-testid=swisstopo-attribution]');
          return {
            canvas: c ? { w: Math.round(c.getBoundingClientRect().width), h: Math.round(c.getBoundingClientRect().height), ta: getComputedStyle(c).touchAction } : null,
            real: !!rt,
            attribution: !!attr,
          };
        }""")

        # FPS
        fps = await page.evaluate("""async () => {
          return await new Promise(res => {
            let f = 0; const s = performance.now(); const T = 1500;
            const loop = () => {
              f++;
              if (performance.now() - s < T) requestAnimationFrame(loop);
              else res(Math.round(f * 1000 / (performance.now() - s)));
            };
            requestAnimationFrame(loop);
          });
        }""")

        overflow_ok = await page.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth + 1")
        scroll_ok = None
        if viewport[0] < 768:
            b = await page.evaluate("() => window.scrollY")
            await page.evaluate("window.scrollBy(0, 300)")
            await page.wait_for_timeout(300)
            a = await page.evaluate("() => window.scrollY")
            scroll_ok = a > b

        print(f"\n=== {label} · {viewport[0]}x{viewport[1]} · DSF={dsf} · {theme} ===")
        print(f"  canvas: {info['canvas']}")
        print(f"  real_twin: {info['real']}  attribution: {info['attribution']}")
        print(f"  transfer_total_KB: {transfer['total']//1024}")
        print(f"  twin_glb_KB: {transfer['twin_glb']//1024}   swisstopo_live_KB: {transfer['swisstopo']//1024}   draco_wasm_KB: {transfer['draco_wasm']//1024}")
        print(f"  FPS: {fps}")
        print(f"  overflow_ok: {overflow_ok}  scroll_ok: {scroll_ok}")
        print(f"  errors: {len(errors)}")
        for t, m in errors[:5]:
            print(f"    [{t}] {m}")
        await browser.close()
        return {
            "label": label, "theme": theme, "vp": f"{viewport[0]}x{viewport[1]}",
            "fps": fps, "twin_KB": transfer["twin_glb"]//1024,
            "err": len(errors), "overflow_ok": overflow_ok, "scroll_ok": scroll_ok,
            "attribution": info["attribution"],
        }

async def main():
    ua_ios = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"
    ua_and = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/121.0.0.0 Mobile Safari/537.36"
    ua_dt = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36"

    r1 = await probe((1440, 900), ua_dt, 1, "Desktop", "dark")
    r2 = await probe((1440, 900), ua_dt, 1, "Desktop", "light")
    r3 = await probe((390, 844), ua_ios, 3, "iPhone", "dark")
    r4 = await probe((390, 844), ua_ios, 3, "iPhone", "light")
    r5 = await probe((412, 915), ua_and, 2.625, "Android", "dark")
    r6 = await probe((412, 915), ua_and, 2.625, "Android", "light")
    print("\n==== SUMMARY ====")
    print(f"  {'label':<10} {'vp':<10} {'theme':<7} {'FPS':>5} {'twinKB':>7} {'err':>4} {'overflow_ok':>12} {'scroll_ok':>10} {'attrib':>7}")
    for r in (r1, r2, r3, r4, r5, r6):
        print(f"  {r['label']:<10} {r['vp']:<10} {r['theme']:<7} {r['fps']:>5} {r['twin_KB']:>7} {r['err']:>4} {str(r['overflow_ok']):>12} {str(r['scroll_ok']):>10} {str(r['attribution']):>7}")

asyncio.run(main())
