import asyncio
from playwright.async_api import async_playwright

URL = "https://immo-traeum-preview.preview.emergentagent.com"

async def probe(viewport, ua, dsf, label, theme, screenshot_path):
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=["--use-gl=swiftshader"])
        c = await b.new_context(
            viewport={"width": viewport[0], "height": viewport[1]},
            user_agent=ua,
            device_scale_factor=dsf,
            has_touch=viewport[0] < 768,
            is_mobile=viewport[0] < 768,
        )
        pg = await c.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(("perr", str(e)[:200])))
        pg.on("console", lambda m: errs.append((m.type, m.text[:200])) if m.type == "error" else None)

        ext_requests = []
        def on_req(r):
            u = r.url
            # Detect any external non-app fetches (should have only own origin + no gstatic)
            if "gstatic.com" in u or "cesium" in u or "geo.admin.ch" in u:
                ext_requests.append(u)
        pg.on("request", on_req)

        await pg.goto(URL, wait_until="domcontentloaded", timeout=45000)
        await pg.wait_for_timeout(1500)

        if theme == "light":
            await pg.click("[data-testid=theme-toggle]")
            await pg.wait_for_timeout(500)

        # Scroll to Objekte
        await pg.evaluate("document.getElementById('objekte').scrollIntoView({block:'start'})")
        await pg.wait_for_timeout(1500)
        # Wait for GLB decode
        await pg.wait_for_timeout(6000)

        # Inspect scene: mesh count, cameras
        stats = await pg.evaluate("""() => {
          function getR3F(canvas) {
            // fiber attaches state via __r3f
            return canvas?.__r3f?.fiber?.getState?.() || canvas?.__r3f?.store?.getState?.() || canvas?.__r3f?.state;
          }
          const c = document.querySelector('#objekte canvas');
          if (!c) return { error: 'no canvas' };
          const state = getR3F(c);
          if (!state) return { error: 'no r3f state', canvas: !!c };
          const scene = state.scene;
          let meshes = 0, materials = new Set(), triangles = 0;
          scene?.traverse?.((o) => {
            if (o.isMesh) {
              meshes++;
              if (o.material) materials.add(o.material.uuid);
              const idx = o.geometry?.getIndex?.();
              if (idx) triangles += idx.count / 3;
              else if (o.geometry?.attributes?.position) triangles += o.geometry.attributes.position.count / 3;
            }
          });
          const cam = state.camera;
          const attrib = document.querySelector('[data-testid=swisstopo-attribution]');
          const real = document.querySelector('[data-testid=real-digital-twin]');
          return {
            meshes, distinct_materials: materials.size, triangles: Math.round(triangles),
            camera: cam ? { x: +cam.position.x.toFixed(1), y: +cam.position.y.toFixed(1), z: +cam.position.z.toFixed(1) } : null,
            attribution: !!attrib, real: !!real,
            canvas: { w: Math.round(c.getBoundingClientRect().width), h: Math.round(c.getBoundingClientRect().height), ta: getComputedStyle(c).touchAction },
          };
        }""")

        # Trigger a "click" (hover on a card) → CameraRig should move
        cam_before = stats.get("camera")
        try:
            await pg.click("[data-testid^=listing-card-]:first-of-type", timeout=3000, force=True)
        except Exception:
            # Simulate hover with mouseenter
            await pg.evaluate("""() => {
              const c = document.querySelector('[data-testid^=listing-card-]');
              if (c) c.dispatchEvent(new MouseEvent('mouseenter', {bubbles:true}));
            }""")
        await pg.wait_for_timeout(2500)
        cam_after = await pg.evaluate("""() => {
          const c = document.querySelector('#objekte canvas');
          const st = c?.__r3f?.store?.getState?.() || c?.__r3f?.state;
          const cam = st?.camera;
          return cam ? { x: +cam.position.x.toFixed(1), y: +cam.position.y.toFixed(1), z: +cam.position.z.toFixed(1) } : null;
        }""")

        # Body overflow
        overflow = await pg.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth + 1")

        # Overlap: check chat + attribution + canvas
        overlap = await pg.evaluate("""() => {
          function rect(el) { return el?.getBoundingClientRect(); }
          const canvas = document.querySelector('#objekte canvas');
          const attribution = document.querySelector('[data-testid=swisstopo-attribution]');
          const cards = document.querySelectorAll('[data-testid^=listing-card-]');
          if (!canvas) return { error: 'no canvas' };
          const cr = rect(canvas);
          // Cards should be beside/below canvas — check no intersection area > 100
          let overlaps = 0;
          cards.forEach(el => {
            const r = rect(el);
            if (!r) return;
            const ix = Math.max(0, Math.min(cr.right, r.right) - Math.max(cr.left, r.left));
            const iy = Math.max(0, Math.min(cr.bottom, r.bottom) - Math.max(cr.top, r.top));
            if (ix * iy > 100) overlaps++;
          });
          return { overlaps };
        }""")

        # Mobile scroll
        scroll_ok = None
        if viewport[0] < 768:
            b0 = await pg.evaluate("() => window.scrollY")
            await pg.evaluate("window.scrollBy(0, 300)")
            await pg.wait_for_timeout(300)
            a0 = await pg.evaluate("() => window.scrollY")
            scroll_ok = a0 > b0

        # Take a screenshot for visual evidence
        await pg.screenshot(path=screenshot_path, type="jpeg", quality=45, full_page=False)

        print(f"\n=== {label} · {viewport[0]}x{viewport[1]} · {theme} ===")
        print(f"  meshes: {stats.get('meshes')}  triangles: {stats.get('triangles')}  materials: {stats.get('distinct_materials')}")
        print(f"  camera_before: {cam_before}  camera_after: {cam_after}  moved: {cam_before != cam_after}")
        print(f"  attribution: {stats.get('attribution')}  real_twin: {stats.get('real')}  canvas: {stats.get('canvas')}")
        print(f"  overlap_check: {overlap}  overflow_ok: {overflow}  scroll_ok: {scroll_ok}")
        print(f"  external_requests_to_cdns: {len(ext_requests)}")
        for u in ext_requests[:3]:
            print(f"    - {u}")
        print(f"  console_errors: {len(errs)}")
        for t, m in errs[:3]:
            print(f"    [{t}] {m}")
        print(f"  screenshot: {screenshot_path}")
        await b.close()

async def main():
    ua_ios = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"
    ua_and = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/121.0.0.0 Mobile Safari/537.36"
    ua_dt = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36"

    import os
    os.makedirs("/app/screenshots", exist_ok=True)
    await probe((1440, 900), ua_dt, 1, "Desktop", "dark",  "/app/screenshots/twin_desktop_dark.jpg")
    await probe((1440, 900), ua_dt, 1, "Desktop", "light", "/app/screenshots/twin_desktop_light.jpg")
    await probe((390, 844), ua_ios, 3, "iPhone", "dark",  "/app/screenshots/twin_iphone_dark.jpg")
    await probe((412, 915), ua_and, 2.625, "Android", "dark", "/app/screenshots/twin_android_dark.jpg")

asyncio.run(main())
