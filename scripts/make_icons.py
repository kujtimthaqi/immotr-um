"""
Favicons/Apple-Touch/Manifest aus wappen@3x.png (höchste Qualität).
Für kleine Grössen: nur Schild+Helm (oberer Teil), Schriftzug 'Jehli' unten fällt weg.
"""
from PIL import Image

SRC = "/app/frontend/public/brand/wappen@3x.png"
PUB = "/app/frontend/public"

im = Image.open(SRC).convert("RGBA")
w, h = im.size
print(f"Source: {w}x{h}")

# Cut off bottom ~22% (where 'Jehli' text sits) — shield+helm nur
crop_h = int(round(h * 0.78))
shield = im.crop((0, 0, w, crop_h))
# Auto-trim transparent border again
bbox = shield.getbbox()
shield = shield.crop(bbox)
print(f"Shield-only: {shield.size}")

def fit_square(src, size, bg=None):
    """Center src into a square canvas of `size`, optional bg fill."""
    src = src.copy()
    sw, sh = src.size
    scale = min(size / sw, size / sh) * 0.94  # 6% margin
    ns = (max(1, int(sw * scale)), max(1, int(sh * scale)))
    resized = src.resize(ns, Image.LANCZOS)
    if bg is None:
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    else:
        canvas = Image.new("RGBA", (size, size), bg)
    ox = (size - ns[0]) // 2
    oy = (size - ns[1]) // 2
    canvas.paste(resized, (ox, oy), resized)
    return canvas

# Standard favicons (transparent PNGs, browsers auto-composite)
for s in (16, 32, 48, 192, 512):
    icon = fit_square(shield, s, bg=None)
    icon.save(f"{PUB}/favicon-{s}.png", "PNG", optimize=True)
    print(f"  favicon-{s}.png saved")

# Apple-Touch-Icon 180px on Navy #0A1428 (no transparency for iOS home screen)
navy = (0x0A, 0x14, 0x28, 255)
apple = fit_square(shield, 180, bg=navy)
apple.convert("RGB").save(f"{PUB}/apple-touch-icon.png", "PNG", optimize=True)
print("  apple-touch-icon.png saved")

# .ico bundle 16/32/48
ico_src = fit_square(shield, 48, bg=None)
ico_src.save(f"{PUB}/favicon.ico", format="ICO", sizes=[(16,16),(32,32),(48,48)])
print("  favicon.ico saved")
