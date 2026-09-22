"""
refine_twin.py — Post-processing pass after build_twin.py:
  1) Wassermaske absichern:
     - HSV-Maske via connected components auf grösste Nordkante-Komponente einschränken.
     - Alle Gebäude-Footprints (aus rorschach.glb, y < 3 m) + 3 m Puffer aus Wasser tilgen.
     - Bodensee-Polygon von geo.admin.ch (ch.swisstopo.swisstlm3d-gewaessernetz,
       objektart=101) rastern und AND-mit HSV-Maske.

  2) Geländehöhen swissALTI3D via https://api3.geo.admin.ch/rest/services/height:
     - 96×96 Grid Desktop (ThreadPool 16, Retry 3).
     - 48×48 Mobile aus Desktop-Grid downsamplen.
     - Wasserpixel auf Bodensee-Seehöhe (395.6 m) klemmen.
     - Ausgabe: terrain.bin (Float32, meter relativ zu Bodensee-Level) + min/max in Meta.

  3) Kontakt-AO:
     - Footprint-Raster aller Gebäude aus XZ-Projektion der Mesh-Dreiecke unterhalb y_min+2 m.
     - Gaussian σ ≈ 4 m, Multiplikator 0.75.
     - Ausgabe: ao.webp (Desktop 1024², Mobile 512²).

  4) twin-meta.json Update: terrain, ao, water_mask.

Nutzt bestehende Dateien (kein neuer Tile-Download nötig):
    /app/frontend/public/twin/rorschach.glb
    /app/frontend/public/twin/ground.webp     (+ -lite)
    /app/frontend/public/twin/twin-meta.json
    /app/frontend/public/twin/footprints.json

Data © swisstopo (Open Data).
"""
import io
import json
import math
import os
import struct
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import requests
import DracoPy
from PIL import Image, ImageDraw
from scipy.ndimage import label as cc_label, gaussian_filter, binary_dilation

# --- Config (muss zu build_twin.py passen) ---
CENTER_LAT = 47.4775
CENTER_LON = 9.4880
# LV95-Koordinate zu Center (via swisstopo Reframe, einmal gemessen).
LV95_CENTER_E = 2754463.56
LV95_CENTER_N = 1260542.67
BODENSEE_LEVEL_M = 395.6  # Seelevel-Fixum; Rasterhöhen relativ darauf

OUT_DIR = Path("/app/frontend/public/twin")
META_PATH = OUT_DIR / "twin-meta.json"
GLB_PATH = OUT_DIR / "rorschach.glb"
GROUND_DESKTOP = OUT_DIR / "ground.webp"
GROUND_MOBILE = OUT_DIR / "ground-lite.webp"
FOOTPRINTS_PATH = OUT_DIR / "footprints.json"

GRID_N_DESKTOP = 96
GRID_N_MOBILE = 48
AO_SIZE_DESKTOP = 1024
AO_SIZE_MOBILE = 512

session = requests.Session()
session.headers.update({"Accept": "*/*"})


# ------------------------------------------------------------------
# helpers: coordinate transforms
# ------------------------------------------------------------------
def latlng_to_enu(lat, lon):
    dLat = (lat - CENTER_LAT) * 111320
    dLon = (lon - CENTER_LON) * 111320 * math.cos(math.radians(CENTER_LAT))
    return (dLon, -dLat)


def enu_to_lv95(x, z):
    """ENU (X=East, Z=-North) → LV95 (E, N). Genügend genau für <2 km um Rorschach."""
    return (LV95_CENTER_E + x, LV95_CENTER_N - z)


def lv95_to_enu(e, n):
    return (e - LV95_CENTER_E, LV95_CENTER_N - n)


def ortho_bounds_enu(meta, mobile=False):
    key = "mobile" if mobile else "desktop"
    b = meta["ground"][key]["bounds"]
    xW, zN = latlng_to_enu(b["nw_lat"], b["nw_lon"])
    xE, zS = latlng_to_enu(b["se_lat"], b["se_lon"])
    return {"xW": xW, "xE": xE, "zN": zN, "zS": zS,
            "width": xE - xW, "depth": zS - zN}


# ------------------------------------------------------------------
# 1) building footprint raster from GLB
# ------------------------------------------------------------------
def parse_glb_meshes(glb_path):
    """Return list of (positions np.float32(N,3), indices np.uint32(M,)) in ENU
    (already transformed by build_twin.py)."""
    data = glb_path.read_bytes()
    gm, gv, glen = struct.unpack("<4sII", data[:12])
    assert gm == b"glTF"
    p = 12
    json_bytes = None
    bin_bytes = b""
    while p < len(data):
        clen, ctype = struct.unpack("<II", data[p:p + 8])
        p += 8
        chunk = data[p:p + clen]
        p += clen
        if ctype == 0x4E4F534A:
            json_bytes = chunk
        elif ctype == 0x004E4942:
            bin_bytes = chunk
    gltf = json.loads(json_bytes.decode("utf-8").rstrip("\x00 "))

    bvs = gltf["bufferViews"]
    out = []
    for m in gltf.get("meshes", []):
        for prim in m.get("primitives", []):
            ext = prim.get("extensions", {}).get("KHR_draco_mesh_compression")
            if not ext:
                continue
            bv = bvs[ext["bufferView"]]
            offs = bv.get("byteOffset", 0)
            length = bv["byteLength"]
            draco = bin_bytes[offs:offs + length]
            try:
                dec = DracoPy.decode(draco)
            except Exception:
                continue
            pts = np.asarray(dec.points, dtype=np.float32).reshape(-1, 3)
            idx = np.asarray(dec.faces, dtype=np.uint32).reshape(-1)
            out.append((pts, idx))
    return out


def rasterize_footprints_all(meshes, bounds_enu, size):
    """
    Rasterize XZ-Projektion ALLER Dreiecke — für AO (Gebäude-Schatten von oben).
    """
    W, H = size
    xW = bounds_enu["xW"]; zN = bounds_enu["zN"]
    dx = bounds_enu["width"]; dz = bounds_enu["depth"]
    img = Image.new("L", (W, H), 0)
    dr = ImageDraw.Draw(img)
    tri_total = 0
    for pts, idx in meshes:
        if pts.shape[0] == 0 or idx.shape[0] == 0:
            continue
        tris = idx.reshape(-1, 3).astype(np.int64)
        for tri in tris:
            x0, x1, x2 = pts[tri[0], 0], pts[tri[1], 0], pts[tri[2], 0]
            z0, z1, z2 = pts[tri[0], 2], pts[tri[1], 2], pts[tri[2], 2]
            px0 = (x0 - xW) / dx * W; py0 = (z0 - zN) / dz * H
            px1 = (x1 - xW) / dx * W; py1 = (z1 - zN) / dz * H
            px2 = (x2 - xW) / dx * W; py2 = (z2 - zN) / dz * H
            dr.polygon([(px0, py0), (px1, py1), (px2, py2)], fill=255)
        tri_total += len(tris)
    print(f"    rasterized {tri_total} tris (full XZ) into {W}x{H}")
    return np.array(img, dtype=np.uint8)


def rasterize_footprints(meshes, bounds_enu, size, slab_above_min=2.0):
    """
    Rasterize XZ-Projektion aller Bodendreiecke = pro Primitive alle Dreiecke,
    deren MIN-y ≤ (primitive_y_min + slab_above_min). Deckt Gebäudegrundfläche
    unabhängig davon ab, wo der Sockel liegt (Gebäude auf Hügel etc.).
    bounds_enu: xW,xE,zN,zS. size=(W,H). UV(0,0)=NW=(xW, zN).
    """
    W, H = size
    xW = bounds_enu["xW"]; zN = bounds_enu["zN"]
    dx = bounds_enu["width"]; dz = bounds_enu["depth"]
    img = Image.new("L", (W, H), 0)
    dr = ImageDraw.Draw(img)
    tri_total = 0
    for pts, idx in meshes:
        if pts.shape[0] == 0 or idx.shape[0] == 0:
            continue
        y_min_prim = float(pts[:, 1].min())
        y_thresh = y_min_prim + slab_above_min
        tris = idx.reshape(-1, 3).astype(np.int64)
        # vectorize: per-triangle min-y
        y_all = pts[tris, 1]
        tri_min_y = y_all.min(axis=1)
        keep = tri_min_y <= y_thresh
        kept = tris[keep]
        for tri in kept:
            x0, x1, x2 = pts[tri[0], 0], pts[tri[1], 0], pts[tri[2], 0]
            z0, z1, z2 = pts[tri[0], 2], pts[tri[1], 2], pts[tri[2], 2]
            px0 = (x0 - xW) / dx * W; py0 = (z0 - zN) / dz * H
            px1 = (x1 - xW) / dx * W; py1 = (z1 - zN) / dz * H
            px2 = (x2 - xW) / dx * W; py2 = (z2 - zN) / dz * H
            dr.polygon([(px0, py0), (px1, py1), (px2, py2)], fill=255)
        tri_total += int(keep.sum())
        # print(f"    primitive y_min={y_min_prim:.2f} → kept {int(keep.sum())} of {len(tris)} tris")
    print(f"    rasterized {tri_total} slab triangles into {W}x{H}")
    return np.array(img, dtype=np.uint8)


# ------------------------------------------------------------------
# 2) Bodensee polygon fetch + raster
# ------------------------------------------------------------------
def fetch_lake_polygon(bounds_enu):
    """
    Query all lake polygons (objektart=101) via envelope identify.
    Return list of polygons in ENU coordinates: each polygon = list of (x, z).
    (MultiPolygon-Ringe werden flach ausgerollt.)
    """
    e0, n0 = enu_to_lv95(bounds_enu["xW"], bounds_enu["zN"])
    e1, n1 = enu_to_lv95(bounds_enu["xE"], bounds_enu["zS"])
    e_min, e_max = min(e0, e1), max(e0, e1)
    n_min, n_max = min(n0, n1), max(n0, n1)
    # Puffer 300 m
    pad = 300
    geom = f"{e_min - pad},{n_min - pad},{e_max + pad},{n_max + pad}"
    map_ext = geom
    url = ("https://api3.geo.admin.ch/rest/services/all/MapServer/identify?"
           f"geometry={geom}&geometryType=esriGeometryEnvelope"
           f"&layers=all:ch.swisstopo.swisstlm3d-gewaessernetz&tolerance=0"
           f"&mapExtent={map_ext}&imageDisplay=1000,1000,96&sr=2056"
           "&returnGeometry=true&geometryFormat=geojson")
    r = session.get(url, timeout=25)
    r.raise_for_status()
    results = r.json().get("results", [])
    polys_lv95 = []
    for x in results:
        props = x.get("properties", {})
        # 101 = Stehendes Gewässer
        if str(props.get("objektart", "")) != "101":
            continue
        g = x.get("geometry", {})
        if g.get("type") == "Polygon":
            for ring in g["coordinates"]:
                polys_lv95.append(ring)
        elif g.get("type") == "MultiPolygon":
            for poly in g["coordinates"]:
                for ring in poly:
                    polys_lv95.append(ring)
    # Konvertiere zu ENU
    polys_enu = []
    for ring in polys_lv95:
        polys_enu.append([lv95_to_enu(pt[0], pt[1]) for pt in ring])
    total_verts = sum(len(p) for p in polys_enu)
    print(f"    fetched {len(polys_enu)} lake polygons ({total_verts} vertices) in bbox")
    return polys_enu


def rasterize_polygons(polygons_enu, bounds_enu, size):
    W, H = size
    xW = bounds_enu["xW"]; zN = bounds_enu["zN"]
    dx = bounds_enu["width"]; dz = bounds_enu["depth"]
    img = Image.new("L", (W, H), 0)
    dr = ImageDraw.Draw(img)
    for poly in polygons_enu:
        px = [((x - xW) / dx * W, (z - zN) / dz * H) for (x, z) in poly]
        if len(px) < 3:
            continue
        dr.polygon(px, fill=255)
    return np.array(img, dtype=np.uint8)


# ------------------------------------------------------------------
# 3) height grid via geo.admin height API
# ------------------------------------------------------------------
def fetch_height(e, n):
    url = f"https://api3.geo.admin.ch/rest/services/height?easting={e:.2f}&northing={n:.2f}&sr=2056"
    for attempt in range(3):
        try:
            r = session.get(url, timeout=15)
            r.raise_for_status()
            return float(r.json()["height"])
        except Exception:
            time.sleep(0.25 * (attempt + 1))
    return None


def build_height_grid(bounds_enu, N):
    """
    N×N grid in ENU-Koordinaten. Reihenfolge:
      grid[j, i] mit i=X (west→east), j=Z (north→south).
    UV mapping (nach Ortho): u=i/(N-1), v=j/(N-1).
    """
    xs = np.linspace(bounds_enu["xW"], bounds_enu["xE"], N)
    zs = np.linspace(bounds_enu["zN"], bounds_enu["zS"], N)
    points = []
    for j, z in enumerate(zs):
        for i, x in enumerate(xs):
            e, n = enu_to_lv95(x, z)
            points.append((i, j, e, n))

    heights = np.full((N, N), np.nan, dtype=np.float32)
    failures = 0

    def _work(pt):
        i, j, e, n = pt
        h = fetch_height(e, n)
        return (i, j, h)

    t0 = time.time()
    with ThreadPoolExecutor(max_workers=16) as pool:
        for k, (i, j, h) in enumerate(pool.map(_work, points)):
            if h is None:
                # noqa: neighbour fallback if any
                failures_local = 1
                heights[j, i] = np.nan
            else:
                heights[j, i] = h
            if (k + 1) % 500 == 0:
                dt = time.time() - t0
                print(f"    {k+1}/{len(points)} heights fetched in {dt:.1f}s")

    # Fill NaN by mean of neighbours (rare)
    nan_count = int(np.isnan(heights).sum())
    if nan_count:
        idx = np.argwhere(np.isnan(heights))
        for j, i in idx:
            neigh = []
            for dj in (-1, 0, 1):
                for di in (-1, 0, 1):
                    jj, ii = j + dj, i + di
                    if 0 <= jj < N and 0 <= ii < N and not np.isnan(heights[jj, ii]):
                        neigh.append(heights[jj, ii])
            heights[j, i] = float(np.mean(neigh)) if neigh else BODENSEE_LEVEL_M
        print(f"    filled {nan_count} NaN cells via neighbours")

    dt = time.time() - t0
    print(f"    grid {N}x{N}: min={heights.min():.1f} m, max={heights.max():.1f} m, "
          f"mean={heights.mean():.1f} m, took {dt:.1f}s")
    return heights


# ------------------------------------------------------------------
# main
# ------------------------------------------------------------------
def main():
    meta = json.loads(META_PATH.read_text())
    footprints_meta = json.loads(FOOTPRINTS_PATH.read_text())

    print("[1/4] Parsing rorschach.glb for footprint raster…")
    meshes = parse_glb_meshes(GLB_PATH)
    total_verts = sum(p.shape[0] for p, _ in meshes)
    total_tris = sum(i.shape[0] // 3 for _, i in meshes)
    print(f"    {len(meshes)} primitives, {total_verts:,} verts, {total_tris:,} tris")

    print("\n[2/4] Fetching Bodensee polygon…")
    bounds_desktop = ortho_bounds_enu(meta, mobile=False)
    lake_polys = fetch_lake_polygon(bounds_desktop)
    if not lake_polys:
        print("    ⚠️  keine Seepolygone gefunden — fahre nur mit HSV-Maske fort")

    # ------------------------------------------------------------------
    # WASSERMASKE (Desktop + Mobile)
    # ------------------------------------------------------------------
    print("\n[3/4] Water mask hardening…")
    for variant, ground_path, mask_out, size_fp, size_ao in [
        ("desktop", GROUND_DESKTOP, OUT_DIR / "water-mask.webp", 1024, AO_SIZE_DESKTOP),
        ("mobile",  GROUND_MOBILE,  OUT_DIR / "water-mask-lite.webp", 512, AO_SIZE_MOBILE),
    ]:
        print(f"  → {variant}")
        bounds = ortho_bounds_enu(meta, mobile=(variant == "mobile"))
        img = Image.open(ground_path).convert("RGB")
        arr = np.array(img).astype(np.float32)
        h, w = arr.shape[:2]
        r_, g_, b_ = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
        v = (r_ + g_ + b_) / 3.0
        # HSV-artige Schwelle wie build_twin.py
        hsv_mask = (v < 95) & (b_ > r_ * 0.9) & (b_ + g_ > r_ * 1.5) & (r_ < 100)

        # Rasterize footprints (per-primitive slab), 3 m Puffer und subtrahiere
        fp_raster = rasterize_footprints(meshes, bounds, (w, h), slab_above_min=2.0)
        # 3 m Puffer in Pixeln: pixel_size_m = width_m / w
        pix_m = bounds["width"] / w
        dil_pix = max(1, int(round(3.0 / pix_m)))
        fp_bool = binary_dilation(fp_raster > 0, iterations=dil_pix)
        hsv_mask = hsv_mask & (~fp_bool)

        # Zusammenhängende Komponenten: behalte die grösste, welche den Nordrand berührt
        labeled, ncomp = cc_label(hsv_mask)
        best_label = 0
        best_size = 0
        for cid in range(1, ncomp + 1):
            comp = (labeled == cid)
            if comp[0, :].any():  # berührt Nordrand (Zeile 0)
                sz = int(comp.sum())
                if sz > best_size:
                    best_size = sz
                    best_label = cid
        if best_label == 0:
            print(f"    ⚠️  keine Nord-Komponente in HSV-Maske gefunden — nutze grösste Komponente")
            for cid in range(1, ncomp + 1):
                sz = int((labeled == cid).sum())
                if sz > best_size:
                    best_size = sz
                    best_label = cid
        hsv_water = (labeled == best_label) if best_label else np.zeros_like(hsv_mask)
        print(f"    HSV connected components: {ncomp}, kept label {best_label} ({best_size} px)")

        # Lake-Polygon AND
        if lake_polys:
            lake_raster = rasterize_polygons(lake_polys, bounds, (w, h))
            lake_bool = lake_raster > 0
            combined = hsv_water & lake_bool
            print(f"    lake polygon coverage {100 * lake_bool.mean():.1f}% ; "
                  f"HSV∩lake = {100 * combined.mean():.1f}% water")
            water = combined
        else:
            water = hsv_water

        # Sicherheit: nochmals Footprints subtrahieren (falls Uferbau in Lake-Poly)
        water = water & (~fp_bool)

        # Weicher Rand → gaussian σ ≈ 2 px
        soft = gaussian_filter(water.astype(np.float32), sigma=2.0)
        soft = np.clip(soft * 1.15, 0, 1)

        # → target size
        m_img = Image.fromarray((soft * 255).astype(np.uint8), "L")
        aspect = h / w
        target_w = size_fp
        target_h = max(1, int(round(size_fp * aspect)))
        if target_h > size_fp:
            target_h = size_fp
            target_w = max(1, int(round(size_fp / aspect)))
        m_img = m_img.resize((target_w, target_h), Image.LANCZOS)
        tmp = mask_out.with_suffix(".tmp.png")
        m_img.save(tmp, "PNG", optimize=True)
        subprocess.run(["cwebp", "-lossless", "-m", "6", str(tmp), "-o", str(mask_out)],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        tmp.unlink()
        print(f"    ✓ {mask_out.name}: {target_w}x{target_h}, "
              f"{mask_out.stat().st_size/1024:.0f} KB, water={100*(np.array(m_img)>128).mean():.1f}%")

        meta["water_mask"][variant] = {"file": mask_out.name, "size": [target_w, target_h]}

        # ------------------------------------------------------------------
        # AO bake (aus voller XZ-Projektion aller Dreiecke)
        # ------------------------------------------------------------------
        ao_path = OUT_DIR / ("ao.webp" if variant == "desktop" else "ao-lite.webp")
        # Nur einmal die volle Gebäude-Silhouette rendern (bei kleinerer Auflösung → schneller)
        ao_aspect_h = max(1, int(round(size_ao * aspect)))
        if ao_aspect_h > size_ao:
            ao_aspect_h = size_ao
        ao_raster = rasterize_footprints_all(meshes, bounds, (size_ao, ao_aspect_h))
        ao_arr = ao_raster.astype(np.float32) / 255.0
        # Gaussian σ ≈ 4 m in Pixeln (an AO-Auflösung angepasst)
        pix_m_ao = bounds["width"] / size_ao
        sigma_px = 4.0 / pix_m_ao
        ao_blur = gaussian_filter(ao_arr, sigma=sigma_px)
        # Multiplikator 0.75: 1 - 0.75 * blur
        ao_mult = 1.0 - 0.75 * np.clip(ao_blur, 0, 1)
        ao_mult = np.clip(ao_mult, 0, 1)
        ao_out = Image.fromarray((ao_mult * 255).astype(np.uint8), "L")
        tmp_png = ao_path.with_suffix(".tmp.png")
        ao_out.save(tmp_png, "PNG", optimize=True)
        subprocess.run(["cwebp", "-q", "90", "-m", "6", str(tmp_png), "-o", str(ao_path)],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        tmp_png.unlink()
        print(f"    ✓ {ao_path.name}: {size_ao}x{ao_aspect_h}, "
              f"{ao_path.stat().st_size/1024:.0f} KB, σ={sigma_px:.1f}px, "
              f"min={ao_mult.min():.2f}, mean={ao_mult.mean():.2f}")
        meta.setdefault("ao", {})[variant] = {"file": ao_path.name, "size": [size_ao, ao_aspect_h]}

    # ------------------------------------------------------------------
    # TERRAIN GRID
    # ------------------------------------------------------------------
    print("\n[4/4] SwissALTI3D height grid…")
    bounds = ortho_bounds_enu(meta, mobile=False)
    print(f"    Desktop grid {GRID_N_DESKTOP}×{GRID_N_DESKTOP}, "
          f"span {bounds['width']:.0f}×{bounds['depth']:.0f} m")

    cache_path = OUT_DIR / "terrain-abs.cache.npy"
    if cache_path.exists() and "--refetch-terrain" not in sys.argv:
        grid_hi = np.load(cache_path).astype(np.float32)
        print(f"    reused cached heights from {cache_path.name} "
              f"(shape={grid_hi.shape}, min={grid_hi.min():.1f}, max={grid_hi.max():.1f})")
    else:
        grid_hi = build_height_grid(bounds, GRID_N_DESKTOP)
        np.save(cache_path, grid_hi.astype(np.float32))

    # Wasserpixel klemmen: identify via UV → water mask
    # Rebuild water mask boolean at grid resolution
    mask_img = Image.open(OUT_DIR / "water-mask.webp").convert("L")
    mask_img = mask_img.resize((GRID_N_DESKTOP, GRID_N_DESKTOP), Image.LANCZOS)
    water_at_grid = (np.array(mask_img) > 128)
    clamp_n = int(water_at_grid.sum())
    grid_hi = np.where(water_at_grid, BODENSEE_LEVEL_M, grid_hi).astype(np.float32)
    print(f"    clamped {clamp_n} water pixels to {BODENSEE_LEVEL_M} m")

    # Relativ zu Bodensee-Level speichern → in Shader direkt addierbar
    # Vertikal spiegeln, damit Zeile 0 = SÜD (matches DataTexture UV: v=0 unten=south).
    grid_rel = (grid_hi - BODENSEE_LEVEL_M).astype(np.float32)
    grid_rel_flip = np.flipud(grid_rel).copy()

    # Downsample to mobile 48×48
    step = GRID_N_DESKTOP // GRID_N_MOBILE  # 2
    grid_lo_flip = grid_rel_flip[::step, ::step].copy()
    print(f"    mobile downsample: {GRID_N_MOBILE}×{GRID_N_MOBILE}, "
          f"min={grid_lo_flip.min():.2f} m, max={grid_lo_flip.max():.2f} m")

    # Ausgabe: Float32 little-endian binär
    (OUT_DIR / "terrain.bin").write_bytes(grid_rel_flip.astype("<f4").tobytes())
    (OUT_DIR / "terrain-lite.bin").write_bytes(grid_lo_flip.astype("<f4").tobytes())
    print(f"    ✓ terrain.bin ({grid_rel_flip.nbytes/1024:.1f} KB), "
          f"terrain-lite.bin ({grid_lo_flip.nbytes/1024:.1f} KB)")

    tmin = float(grid_rel_flip.min())
    tmax = float(grid_rel_flip.max())
    meta["terrain"] = {
        "desktop": {
            "file": "terrain.bin",
            "grid": GRID_N_DESKTOP,
            "min": tmin,
            "max": tmax,
        },
        "mobile": {
            "file": "terrain-lite.bin",
            "grid": GRID_N_MOBILE,
            "min": float(grid_lo_flip.min()),
            "max": float(grid_lo_flip.max()),
        },
        "level_m": BODENSEE_LEVEL_M,
    }
    meta["attribution"] = "Luftbild · Höhenmodell · Gebäude © swisstopo"

    # ------------------------------------------------------------------
    # Sockel-Report für Zielgebäude + 10 Stichproben
    # ------------------------------------------------------------------
    print("\n[Report] Sockel-Differenzen an Zielgebäuden:")
    for t in footprints_meta["targets"]:
        cx, cz = t["centroid"]
        # sample terrain at centroid (original orientation: grid_rel row 0 = north)
        u = (cx - bounds["xW"]) / bounds["width"]
        v = (cz - bounds["zN"]) / bounds["depth"]
        u = max(0, min(0.9999, u))
        v = max(0, min(0.9999, v))
        i = int(u * (GRID_N_DESKTOP - 1))
        j = int(v * (GRID_N_DESKTOP - 1))
        terrain_display = float(grid_rel[j, i])
        y_base = float(t["y_min"])
        delta = y_base - terrain_display
        print(f"  {t['name']:16s} terrain_z={terrain_display:+6.2f} m  "
              f"y_min_bldg={y_base:+6.2f} m  Δ={delta:+6.2f} m")

    print("\n[Report] 10 Stichproben (ENU→Höhe rel. Bodensee):")
    rng = np.random.default_rng(42)
    for _ in range(10):
        i = int(rng.integers(0, GRID_N_DESKTOP))
        j = int(rng.integers(0, GRID_N_DESKTOP))
        x = bounds["xW"] + i / (GRID_N_DESKTOP - 1) * bounds["width"]
        z = bounds["zN"] + j / (GRID_N_DESKTOP - 1) * bounds["depth"]
        h_rel = float(grid_rel[j, i])
        h_abs = h_rel + BODENSEE_LEVEL_M
        wet = "water" if water_at_grid[j, i] else "land"
        print(f"  ({x:+7.1f}, {z:+7.1f}) → {h_abs:6.2f} m abs / {h_rel:+5.2f} m rel  [{wet}]")

    META_PATH.write_text(json.dumps(meta, indent=2))
    print(f"\n✓ wrote {META_PATH}")
    print("Done.")


if __name__ == "__main__":
    sys.exit(main() or 0)
