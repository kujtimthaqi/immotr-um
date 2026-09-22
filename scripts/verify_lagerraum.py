import asyncio
from playwright.async_api import async_playwright

URL = "https://immo-traeum-preview.preview.emergentagent.com"

async def check(viewport, ua, dsf, label):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(
            viewport={"width": viewport[0], "height": viewport[1]},
            user_agent=ua,
            device_scale_factor=dsf,
            has_touch=True,
            is_mobile=viewport[0] < 768,
        )
        page = await ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        await page.goto(URL, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(2500)
        await page.evaluate("document.getElementById('objekte').scrollIntoView({block:'start'})")
        await page.wait_for_timeout(1200)
        try:
            await page.click("[data-testid=objekte-tab-rental]", timeout=4000)
        except Exception as e:
            print(f"[{label}] tab click failed:", e)
        await page.wait_for_timeout(1200)
        # Scroll lagerraum card into view
        await page.evaluate("""() => {
          const cards = document.querySelectorAll('[data-testid^=listing-card-]');
          for (const c of cards) {
            const t = c.querySelector('h4');
            if (t && t.textContent.includes('Lagerraum')) { c.scrollIntoView({block:'center'}); return true; }
          }
          return false;
        }""")
        await page.wait_for_timeout(4500)
        data = await page.evaluate("""() => {
          const out = [];
          document.querySelectorAll('[data-testid^=listing-card-]').forEach(c => {
            const t = c.querySelector('h4')?.textContent?.trim() || '';
            const v = c.querySelector('video');
            out.push({
              title: t.slice(0, 40),
              currentSrc: v ? v.currentSrc.split('/').pop() : null,
              paused: v ? v.paused : null,
              time: v ? +v.currentTime.toFixed(2) : null,
              ready: v ? v.readyState : null,
              netstate: v ? v.networkState : null,
              inView: v ? (() => { const r = v.getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0; })() : null
            });
          });
          const overflow = document.documentElement.scrollWidth <= window.innerWidth + 1;
          return { cards: out, overflow_ok: overflow };
        }""")
        print(f"\n=== {label} ({viewport[0]}x{viewport[1]}, DSF={dsf}) ===")
        for c in data["cards"]:
            print(f"  {c['title']:<40} src={c['currentSrc']} paused={c['paused']} t={c['time']} rdy={c['ready']} inView={c['inView']}")
        print(f"  overflow_ok: {data['overflow_ok']}")
        print(f"  errors: {len(errors)}")
        if errors:
            for e in errors[:3]:
                print(f"    - {e[:200]}")
        await browser.close()
        return data

async def main():
    # iPhone
    await check((390, 844), "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", 3, "iPhone")
    # Android
    await check((412, 915), "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36", 2.625, "Android")
    # Desktop
    await check((1440, 900), "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36", 1, "Desktop")

asyncio.run(main())
