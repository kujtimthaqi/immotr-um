import asyncio
from playwright.async_api import async_playwright

URL = "https://immo-traeum-preview.preview.emergentagent.com"

async def probe(viewport, ua, dsf, label, wait_seconds=12):
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

        console_errs = []
        page.on("pageerror", lambda e: console_errs.append(("pageerror", str(e)[:250])))
        page.on("console", lambda m: console_errs.append((m.type, m.text[:250])) if m.type in ("error", "warning") else None)

        transfer = {"total": 0, "swisstopo": 0, "count_swisstopo": 0, "b3dm": 0, "count_b3dm": 0}
        def on_resp(resp):
            try:
                cl = resp.headers.get("content-length") or "0"
                sz = int(cl)
                transfer["total"] += sz
                url = resp.url
                if "3d.geo.admin.ch" in url:
                    transfer["swisstopo"] += sz
                    transfer["count_swisstopo"] += 1
                    if url.endswith(".b3dm") or "/data/" in url:
                        transfer["b3dm"] += sz
                        transfer["count_b3dm"] += 1
            except Exception:
                pass
        page.on("response", on_resp)

        await page.goto(URL, wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_timeout(1500)
        # Scroll to Objekte
        await page.evaluate("document.getElementById('objekte').scrollIntoView({block:'start'})")
        await page.wait_for_timeout(1500)
        # Ensure canvas exists
        canvas_info = await page.evaluate("""() => {
          const c = document.querySelector('#objekte canvas');
          if (!c) return null;
          const r = c.getBoundingClientRect();
          return { w: r.width, h: r.height, ta: getComputedStyle(c).touchAction };
        }""")
        # Trigger scroll-into-view + wait for tiles
        await page.wait_for_timeout(wait_seconds * 1000)

        # FPS measurement
        fps = await page.evaluate(f"""async () => {{
          return await new Promise(resolve => {{
            let frames = 0;
            const start = performance.now();
            const T = 2000;
            function loop() {{
              frames++;
              if (performance.now() - start < T) requestAnimationFrame(loop);
              else resolve({{ fps: Math.round(frames * 1000 / (performance.now() - start)) }});
            }}
            requestAnimationFrame(loop);
          }});
        }}""")

        # Verify attribution + testid
        attr = await page.evaluate("""() => {
          const a = document.querySelector('[data-testid=swisstopo-attribution]');
          const rt = document.querySelector('[data-testid=real-digital-twin]');
          return { attribution: !!a, real_twin_root: !!rt };
        }""")

        # Body overflow
        overflow_ok = await page.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth + 1")

        # Vertical scroll works on mobile? (relevant for canvas)
        scroll_ok = None
        if viewport[0] < 768:
            before = await page.evaluate("() => window.scrollY")
            await page.evaluate("window.scrollBy(0, 400)")
            await page.wait_for_timeout(400)
            after = await page.evaluate("() => window.scrollY")
            scroll_ok = after > before

        errs = [e for e in console_errs if e[0] == "pageerror" or (e[0] == "error" and "webglcontextlost" not in e[1].lower())]

        print(f"\n=== {label} ({viewport[0]}x{viewport[1]}, DSF={dsf}) ===")
        print(f"  canvas: {canvas_info}")
        print(f"  attribution: {attr}")
        print(f"  transfer_total_KB: {transfer['total']//1024}")
        print(f"  swisstopo_KB: {transfer['swisstopo']//1024} ({transfer['count_swisstopo']} req)")
        print(f"  b3dm_or_data_KB: {transfer['b3dm']//1024} ({transfer['count_b3dm']} req)")
        print(f"  FPS: {fps.get('fps')}")
        print(f"  overflow_ok: {overflow_ok}, scroll_ok: {scroll_ok}")
        print(f"  errors ({len(errs)}):")
        for t, m in errs[:5]:
            print(f"    [{t}] {m}")
        await browser.close()
        return {
            "label": label, "viewport": viewport, "fps": fps.get("fps"),
            "swisstopo_KB": transfer["swisstopo"]//1024,
            "swisstopo_count": transfer["count_swisstopo"],
            "canvas": canvas_info, "attribution": attr,
            "errors": len(errs), "overflow_ok": overflow_ok, "scroll_ok": scroll_ok,
        }

async def main():
    r_desktop = await probe((1440, 900), "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36", 1, "Desktop", 14)
    r_iphone = await probe((390, 844), "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", 3, "iPhone", 14)
    r_android = await probe((412, 915), "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/121.0.0.0 Mobile Safari/537.36", 2.625, "Android", 14)
    print("\n==== SUMMARY ====")
    for r in (r_desktop, r_iphone, r_android):
        print(f"  {r['label']:<10} FPS={r['fps']:>3}  swissKB={r['swisstopo_KB']:>5} ({r['swisstopo_count']} req)  err={r['errors']}  overflow_ok={r['overflow_ok']}")

asyncio.run(main())
