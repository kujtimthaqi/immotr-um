"""
build_twin.py — Einmal-Bake des swisstopo swissBUILDINGS3D-Tilesets zu einem
optimierten GLB für Rorschach.

- Walk tileset.json hierarchy (recursive) und filtere Kacheln deren
  `region` bounding volume den Rorschach-Ausschnitt schneidet.
- Download der ausgewählten .b3dm-Kacheln, Extraktion des eingebetteten glTF,
  Draco-Decode der Meshes, Transform in lokales ENU-System (Y-Up) um Rorschach-Zentrum.
- Merge in EIN glTF/GLB (Materialien vereinheitlicht, Texturen weggelassen).
- Ausgabe:
    /app/frontend/public/twin/rorschach.glb        (Desktop-Version)
    /app/frontend/public/twin/rorschach-lite.glb   (Mobile, aggressiver simplified)

Usage:
    python3 scripts/build_twin.py

Data © swisstopo (Open Data — https://www.geo.admin.ch/en/general-terms-of-use-fsdi).
"""
import io
import json
import math
import os
import struct
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urljoin

import numpy as np
import requests
import DracoPy
import pygltflib
from pygltflib import (
    GLTF2, Asset, Scene, Node, Mesh, Primitive, Attributes,
    Buffer, BufferView, Accessor, Material, PbrMetallicRoughness,
    ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER, UNSIGNED_INT, FLOAT, SCALAR, VEC3,
)

# --- Config ---
BASE_URL = "https://3d.geo.admin.ch/ch.swisstopo.swissbuildings3d.3d/v1/"
ROOT_TILESET = "tileset.json"

# Rorschach 1.2 x 1.0 km bbox um (47.4775 N, 9.4880 E)
CENTER_LAT = 47.4775
CENTER_LON = 9.4880
HALF_LAT = 0.5 / 111.32   # ≈ 0.5km N/S → 0.00449°
HALF_LON = 0.6 / (111.32 * math.cos(math.radians(CENTER_LAT)))  # ≈ 0.6km E/W → 0.00795°

BBOX_MIN_LAT = math.radians(CENTER_LAT - HALF_LAT)
BBOX_MAX_LAT = math.radians(CENTER_LAT + HALF_LAT)
BBOX_MIN_LON = math.radians(CENTER_LON - HALF_LON)
BBOX_MAX_LON = math.radians(CENTER_LON + HALF_LON)

OUT_DIR = Path("/app/frontend/public/twin")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# WGS84 ellipsoid constants
A = 6378137.0
F = 1.0 / 298.257223563
E2 = F * (2.0 - F)

# Rorschach ECEF center (used for translation)
def geodetic_to_ecef(lat_rad, lon_rad, h=0.0):
    sin_lat, cos_lat = math.sin(lat_rad), math.cos(lat_rad)
    N = A / math.sqrt(1.0 - E2 * sin_lat * sin_lat)
    x = (N + h) * cos_lat * math.cos(lon_rad)
    y = (N + h) * cos_lat * math.sin(lon_rad)
    z = (N * (1.0 - E2) + h) * sin_lat
    return np.array([x, y, z], dtype=np.float64)

CENTER_LAT_RAD = math.radians(CENTER_LAT)
CENTER_LON_RAD = math.radians(CENTER_LON)
ECEF_CENTER = geodetic_to_ecef(CENTER_LAT_RAD, CENTER_LON_RAD, 400.0)

# ENU rotation matrix at (lat0, lon0):
# rows: [E, N, U]
# E =  [-sin(lon), cos(lon), 0]
# N =  [-sin(lat)cos(lon), -sin(lat)sin(lon), cos(lat)]
# U =  [ cos(lat)cos(lon),  cos(lat)sin(lon), sin(lat)]
sl, cl = math.sin(CENTER_LON_RAD), math.cos(CENTER_LON_RAD)
sf, cf = math.sin(CENTER_LAT_RAD), math.cos(CENTER_LAT_RAD)
R_ECEF_TO_ENU = np.array([
    [-sl,           cl,          0],
    [-sf*cl,       -sf*sl,       cf],
    [ cf*cl,        cf*sl,       sf],
], dtype=np.float64)
# three.js Y-up: X=East, Y=Up, Z=-North → so we map ENU (E,N,U) → (E, U, -N)

# --- Session ---
session = requests.Session()
session.headers.update({"Accept": "*/*"})

def http_get(url, retries=3):
    for i in range(retries):
        try:
            r = session.get(url, timeout=20)
            r.raise_for_status()
            return r.content
        except Exception as e:
            if i == retries - 1:
                raise
            time.sleep(0.5 * (i + 1))

# --- Tileset walker ---
def region_intersects(region):
    """region = [west, south, east, north, min_h, max_h] in radians/meters."""
    w, s, e, n, _, _ = region
    if e < BBOX_MIN_LON or w > BBOX_MAX_LON:
        return False
    if n < BBOX_MIN_LAT or s > BBOX_MAX_LAT:
        return False
    return True

def collect_b3dm_uris(node, base_uri):
    """Recursively walk tileset; return list of (absolute_b3dm_url) for tiles that intersect our bbox."""
    out = []
    bv = node.get("boundingVolume", {})
    region = bv.get("region")
    if region and not region_intersects(region):
        return out  # Prune

    content = node.get("content", {})
    uri = content.get("uri", "")
    if uri:
        abs_uri = urljoin(base_uri, uri)
        if uri.endswith(".b3dm"):
            out.append(abs_uri)
        elif uri.endswith(".json"):
            # nested tileset
            print(f"    → recurse into nested {abs_uri.split('/')[-1]}", flush=True)
            try:
                nested_bytes = http_get(abs_uri)
                nested = json.loads(nested_bytes)
                out.extend(collect_b3dm_uris(nested["root"], abs_uri))
            except Exception as ex:
                print(f"      failed: {ex}")

    for child in node.get("children", []):
        out.extend(collect_b3dm_uris(child, base_uri))
    return out

# --- B3DM parser ---
def parse_b3dm(data):
    """Return (rtc_center: np.array(3), glb_bytes)."""
    magic, ver, blen, ftjb, ftbb, btjb, btbb = struct.unpack("<4sIIIIII", data[:28])
    assert magic == b"b3dm", f"not b3dm: {magic}"
    ft_json = json.loads(data[28:28+ftjb].decode("utf-8")) if ftjb else {}
    rtc = ft_json.get("RTC_CENTER") or [0, 0, 0]
    off = 28 + ftjb + ftbb + btjb + btbb
    glb = data[off:blen]
    return np.array(rtc, dtype=np.float64), glb

# --- GLB draco → positions/indices ---
def extract_meshes_from_glb(glb_bytes):
    """
    Return list of dicts: {positions: (N,3) np.float32, indices: (M,) np.uint32, node_matrix: (4,4) or None}.
    Only handles: KHR_draco_mesh_compression, one primitive per mesh assumed.
    """
    gm, gv, glen = struct.unpack("<4sII", glb_bytes[:12])
    assert gm == b"glTF"
    p = 12
    # Read chunks
    json_bytes = None
    bin_bytes = b""
    while p < len(glb_bytes):
        clen, ctype = struct.unpack("<II", glb_bytes[p:p+8])
        p += 8
        chunk = glb_bytes[p:p+clen]
        p += clen
        if ctype == 0x4E4F534A:  # "JSON"
            json_bytes = chunk
        elif ctype == 0x004E4942:  # "BIN\0"
            bin_bytes = chunk
    gltf = json.loads(json_bytes.decode("utf-8").rstrip("\x00 "))

    buffer_views = gltf.get("bufferViews", [])
    nodes = gltf.get("nodes", [])

    # Node matrix by traversing scene
    def node_matrix(node):
        M = np.eye(4)
        if "matrix" in node:
            M = np.array(node["matrix"], dtype=np.float64).reshape(4,4).T  # column-major
        else:
            T = np.eye(4)
            R = np.eye(4)
            S = np.eye(4)
            if "translation" in node:
                T[:3, 3] = node["translation"]
            if "rotation" in node:
                x, y, z, w = node["rotation"]
                # quaternion to rotation
                xx, yy, zz = x*x, y*y, z*z
                xy, xz, yz = x*y, x*z, y*z
                wx, wy, wz = w*x, w*y, w*z
                R[:3, :3] = np.array([
                    [1-2*(yy+zz), 2*(xy-wz),   2*(xz+wy)],
                    [2*(xy+wz),   1-2*(xx+zz), 2*(yz-wx)],
                    [2*(xz-wy),   2*(yz+wx),   1-2*(xx+yy)],
                ])
            if "scale" in node:
                S[0,0], S[1,1], S[2,2] = node["scale"]
            M = T @ R @ S
        return M

    results = []
    # Iterate all nodes with a mesh reference (batched buildings)
    meshes = gltf.get("meshes", [])
    for node in nodes:
        mi = node.get("mesh")
        if mi is None:
            continue
        M = node_matrix(node)
        for prim in meshes[mi].get("primitives", []):
            ext = prim.get("extensions", {}).get("KHR_draco_mesh_compression")
            if not ext:
                continue
            bv_idx = ext["bufferView"]
            bv = buffer_views[bv_idx]
            offs = bv.get("byteOffset", 0)
            length = bv["byteLength"]
            draco_bytes = bin_bytes[offs:offs+length]
            try:
                dec = DracoPy.decode(draco_bytes)
            except Exception as ex:
                # some tiles may fail, skip
                continue
            pts = np.asarray(dec.points, dtype=np.float32).reshape(-1, 3)
            idx = np.asarray(dec.faces, dtype=np.uint32).reshape(-1)
            results.append({"positions": pts, "indices": idx, "matrix": M})
    return results

# glTF Y-up → Z-up rotation (Rotation +90° um X): (x, y, z) → (x, -z, y)
# 3D Tiles 1.0 wendet dies NACH der NodeMatrix und VOR RTC_CENTER an.
M_YUP2ZUP = np.array([
    [1, 0,  0],
    [0, 0, -1],
    [0, 1,  0],
], dtype=np.float64)

# --- ECEF+node → ENU transform ---
def transform_positions(pts, node_mat, rtc):
    """
    3D Tiles 1.0 Pipeline:
      ECEF = RTC + M_yup2zup · (NodeMatrix · p_local)
    Wir wenden dann noch ECEF→ENU@Rorschach an und mappen zu three.js Y-up.
    """
    N = pts.shape[0]
    pts4 = np.hstack([pts.astype(np.float64), np.ones((N, 1))])  # (N,4)
    # 1) NodeMatrix (T·R·S) auf lokale Punkte
    node_local = (node_mat @ pts4.T).T[:, :3]  # (N,3)
    # 2) Y-up → Z-up
    zup = (M_YUP2ZUP @ node_local.T).T  # (N,3)
    # 3) + RTC_CENTER → ECEF
    ecef = zup + rtc
    # 4) ECEF → ENU@Rorschach
    delta = ecef - ECEF_CENTER
    enu = (R_ECEF_TO_ENU @ delta.T).T  # (N,3) [E, N, U]
    # 5) three.js Y-up: X=E, Y=U, Z=-N
    yup = np.column_stack([enu[:, 0], enu[:, 2], -enu[:, 1]]).astype(np.float32)
    return yup

# --- Main pipeline ---
# Ziel-Adressen in ENU-Metern (relativ CENTER_LAT/LON)
def latlng_to_enu(lat, lon):
    dLat = (lat - CENTER_LAT) * 111320
    dLon = (lon - CENTER_LON) * 111320 * math.cos(math.radians(CENTER_LAT))
    return (dLon, -dLat)  # (E, -N) in three.js Y-up: X=East, Z=-North

# Ziel-Adressen inkl. LV95-Koordinaten aus swisstopo SearchServer (origins=address).
# Aus diesen holen wir das ECHTE Gebäude-Footprint-Polygon (ch.kantone.cadastralwebmap-farbe),
# was uns eindeutige Identifikation via Point-in-Polygon erlaubt.
TARGETS = [
    # (node_name, addr_lat, addr_lon, lv95_e, lv95_n)
    ("obj_trischli16",  47.47791290, 9.48858452, 2754506.5,  1260589.625),
    ("obj_reitbahn39",  47.47550964, 9.48709869, 2754401.5,  1260319.75),
    ("obj_geren9",      47.47812271, 9.48763084, 2754434.0,  1260611.125),
]
# Fallback-Radius, falls kein Polygon-Treffer (Toleranz für schmale Mesh-Splitter am Rand).
TARGET_FALLBACK_M = 8.0

def _reframe_lv95_to_wgs84(e, n, alt=400.0):
    """LV95 → WGS84 via swisstopo Reframe REST-Service. Returns (lat, lon).
    Retries auf transiente 502-Fehler; Fallback = einfache Approximation."""
    url = f"https://geodesy.geo.admin.ch/reframe/lv95towgs84?easting={e}&northing={n}&altitude={alt}&format=json"
    last_exc = None
    for attempt in range(5):
        try:
            r = session.get(url, timeout=15)
            r.raise_for_status()
            j = r.json()
            return float(j["northing"]), float(j["easting"])
        except Exception as ex:
            last_exc = ex
            time.sleep(0.5 * (attempt + 1))
    # Fallback: 6-parameter approximation (Rorschach-nah gut genug für Polygonpunkte)
    # LV95 → WGS84 näherungsweise
    y = (e - 2600000) / 1000000
    x = (n - 1200000) / 1000000
    lon_approx = 2.6779094 + 4.728982*y + 0.791484*y*x + 0.1306*y*x*x - 0.0436*y**3
    lat_approx = 16.9023892 + 3.238272*x - 0.270978*y*y - 0.002528*x*x - 0.0447*y*y*x - 0.0140*x**3
    lon = lon_approx * 100 / 36
    lat = lat_approx * 100 / 36
    print(f"    ⚠️ reframe fallback used ({last_exc})")
    return lat, lon

def _polygon_area_2d(poly):
    a = 0.0
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        a += x1 * y2 - x2 * y1
    return abs(a) / 2

def _pip_2d(pt, poly):
    x, y = pt
    n = len(poly)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-9) + xi):
            inside = not inside
        j = i
    return inside

def fetch_building_footprints():
    """
    Für jede TARGETS-Adresse:
      1. Cadastral-Layer bei LV95-Adresspunkt identifizieren.
      2. Smallest containing polygon wählen (= tatsächliches Gebäude).
      3. Alle Ringpunkte via Reframe nach WGS84, dann nach ENU (X=E, Z=-N).
    Returns: list of dict {name, poly_enu[(x,z), ...], centroid_enu, addr_enu, addr_ll}.
    """
    result = []
    for name, alat, alon, ax, ay in TARGETS:
        print(f"  → {name}: identify cadastral @ LV95=({ax},{ay})")
        bbox = f"{ax-30},{ay-30},{ax+30},{ay+30}"
        url = (
            "https://api3.geo.admin.ch/rest/services/all/MapServer/identify?"
            f"geometry={ax},{ay}&geometryType=esriGeometryPoint"
            f"&layers=all:ch.kantone.cadastralwebmap-farbe&tolerance=20"
            f"&mapExtent={bbox}&imageDisplay=100,100,96&sr=2056"
            "&returnGeometry=true&geometryFormat=geojson"
        )
        r = session.get(url, timeout=20)
        r.raise_for_status()
        hits = r.json().get("results", [])
        polys = []
        for h in hits:
            g = h.get("geometry", {})
            if g.get("type") != "Polygon":
                continue
            rings = g.get("coordinates", [])
            if rings:
                polys.append(rings[0])
        containing = [p for p in polys if _pip_2d((ax, ay), p)]
        winner = None
        if containing:
            winner = min(containing, key=_polygon_area_2d)
        else:
            # kein containing polygon → nimm nächstgelegenes
            if polys:
                def _cdist(p):
                    cx = sum(v[0] for v in p) / len(p)
                    cy = sum(v[1] for v in p) / len(p)
                    return math.hypot(cx - ax, cy - ay)
                winner = min(polys, key=_cdist)
        if winner is None:
            print(f"    ⚠️  no polygon found — will use fallback radius only")
            addr_enu = latlng_to_enu(alat, alon)
            result.append({
                "name": name, "poly_enu": [], "centroid_enu": addr_enu,
                "addr_enu": addr_enu, "addr_ll": (alat, alon),
            })
            continue
        # Reframe alle Ringpunkte
        poly_enu = []
        for px, py in winner:
            plat, plon = _reframe_lv95_to_wgs84(px, py)
            poly_enu.append(latlng_to_enu(plat, plon))
        cx_enu = sum(v[0] for v in poly_enu) / len(poly_enu)
        cz_enu = sum(v[1] for v in poly_enu) / len(poly_enu)
        addr_enu = latlng_to_enu(alat, alon)
        area = _polygon_area_2d(winner)
        d_addr_center = math.hypot(cx_enu - addr_enu[0], cz_enu - addr_enu[1])
        print(f"    ✓ polygon area={area:.0f} m², {len(poly_enu)} verts, "
              f"centroid ENU=({cx_enu:.1f},{cz_enu:.1f}), "
              f"Δaddr↔center={d_addr_center:.2f} m")
        result.append({
            "name": name, "poly_enu": poly_enu,
            "centroid_enu": (cx_enu, cz_enu),
            "addr_enu": addr_enu,
            "addr_ll": (alat, alon),
        })
    return result

# gefüllt in main() vor Tile-Decoding
TARGET_FOOTPRINTS = []

def find_target_for_center(cx, cz):
    """
    Genaue Zuordnung: bevorzuge Polygon-Treffer.
    1) Enthält irgendein Footprint (cx,cz)? → Index dieses Footprints.
    2) Fallback: nächster Adresspunkt mit Distanz < TARGET_FALLBACK_M.
    """
    for i, t in enumerate(TARGET_FOOTPRINTS):
        if t["poly_enu"] and _pip_2d((cx, cz), t["poly_enu"]):
            return i
    # Fallback (nur enger Radius, um Splitter am Gebäuderand einzufangen)
    best_i, best_d = None, TARGET_FALLBACK_M
    for i, t in enumerate(TARGET_FOOTPRINTS):
        tx, tz = t["centroid_enu"]
        d = math.hypot(cx - tx, cz - tz)
        if d < best_d:
            best_d, best_i = d, i
    return best_i

def main():
    print(f"Bounding box: lat [{CENTER_LAT - HALF_LAT:.5f}, {CENTER_LAT + HALF_LAT:.5f}] "
          f"lon [{CENTER_LON - HALF_LON:.5f}, {CENTER_LON + HALF_LON:.5f}]")
    print(f"ECEF center: {ECEF_CENTER}")

    print("\n[0/4] Fetching exact building footprints via cadastral layer…")
    global TARGET_FOOTPRINTS
    TARGET_FOOTPRINTS = fetch_building_footprints()

    print("\n[1/4] Walking tileset hierarchy…")
    root_bytes = http_get(urljoin(BASE_URL, ROOT_TILESET))
    root = json.loads(root_bytes)
    b3dm_urls = collect_b3dm_uris(root["root"], urljoin(BASE_URL, ROOT_TILESET))
    b3dm_urls = list(dict.fromkeys(b3dm_urls))  # dedupe
    print(f"  → {len(b3dm_urls)} b3dm tiles intersect Rorschach bbox")

    if not b3dm_urls:
        print("ERROR: no tiles found for bbox — check coordinates.")
        return 1

    print("\n[2/4] Downloading + decoding b3dm tiles…")
    bg_positions, bg_indices = [], []
    target_positions = [[] for _ in TARGETS]
    target_indices = [[] for _ in TARGETS]
    bg_offset = 0
    target_offsets = [0, 0, 0]
    stats = {"downloaded": 0, "meshes": 0, "vertices": 0, "faces": 0, "failed": 0,
             "target_hits": [0, 0, 0]}

    # Precompute footprint XZ-bboxes for quick reject
    footprint_bboxes = []
    for t in TARGET_FOOTPRINTS:
        if t["poly_enu"]:
            xs = [v[0] for v in t["poly_enu"]]
            zs = [v[1] for v in t["poly_enu"]]
            # pad by TARGET_FALLBACK_M
            footprint_bboxes.append((
                min(xs) - TARGET_FALLBACK_M, max(xs) + TARGET_FALLBACK_M,
                min(zs) - TARGET_FALLBACK_M, max(zs) + TARGET_FALLBACK_M,
            ))
        else:
            footprint_bboxes.append(None)

    def split_mesh_by_targets(pts, faces):
        """
        pts: (N,3) float32, faces: (M,) uint32 (triangle indices).
        Return dict: -1 (bg) or 0..len(TARGETS)-1 → (sub_pts (K,3), sub_faces (L,))
        Assignment: for each triangle, majority vote on 3 vertices;
        vertex assignment = smallest polygon that CONTAINS (x,z),
        else target within TARGET_FALLBACK_M around polygon, else -1.
        """
        N = pts.shape[0]
        # 1) per-vertex label
        vlabels = np.full(N, -1, dtype=np.int8)
        for i, t in enumerate(TARGET_FOOTPRINTS):
            bb = footprint_bboxes[i]
            if bb is None:
                continue
            xmin, xmax, zmin, zmax = bb
            # Coarse XZ-bbox mask
            in_bb = (pts[:, 0] >= xmin) & (pts[:, 0] <= xmax) & \
                    (pts[:, 2] >= zmin) & (pts[:, 2] <= zmax)
            if not in_bb.any():
                continue
            idxs = np.where(in_bb)[0]
            poly = t["poly_enu"]
            cx, cz = t["centroid_enu"]
            for vi in idxs:
                if vlabels[vi] != -1:
                    continue
                x, z = float(pts[vi, 0]), float(pts[vi, 2])
                if _pip_2d((x, z), poly):
                    vlabels[vi] = i
                else:
                    # fallback: within tight radius of centroid
                    if math.hypot(x - cx, z - cz) < TARGET_FALLBACK_M:
                        vlabels[vi] = i
        # 2) per-triangle label = majority vote (or -1 if tied against bg)
        tri = faces.reshape(-1, 3)
        l0 = vlabels[tri[:, 0]]
        l1 = vlabels[tri[:, 1]]
        l2 = vlabels[tri[:, 2]]
        # For each triangle, if all 3 same → that label, else if 2 same → that label, else -1
        agree01 = l0 == l1
        agree12 = l1 == l2
        agree02 = l0 == l2
        tri_labels = np.full(tri.shape[0], -1, dtype=np.int8)
        # majority = 2+ agree
        for i in range(len(TARGETS)):
            mask = ((l0 == i) & (l1 == i)) | ((l1 == i) & (l2 == i)) | ((l0 == i) & (l2 == i))
            tri_labels[mask] = i
        # Split
        out = {}
        # Background = all triangles with label -1
        bg_mask = tri_labels == -1
        if bg_mask.any():
            faces_bg = tri[bg_mask].reshape(-1).astype(np.uint32)
            # Compact: only keep referenced vertices
            uniq, inv = np.unique(faces_bg, return_inverse=True)
            out[-1] = (pts[uniq].astype(np.float32), inv.astype(np.uint32))
        for i in range(len(TARGETS)):
            m = tri_labels == i
            if m.any():
                faces_t = tri[m].reshape(-1).astype(np.uint32)
                uniq, inv = np.unique(faces_t, return_inverse=True)
                out[i] = (pts[uniq].astype(np.float32), inv.astype(np.uint32))
        return out

    def fetch(u):
        try:
            return u, http_get(u)
        except Exception:
            return u, None

    with ThreadPoolExecutor(max_workers=10) as pool:
        for i, (u, data) in enumerate(pool.map(fetch, b3dm_urls)):
            if data is None:
                stats["failed"] += 1
                continue
            stats["downloaded"] += 1
            try:
                rtc, glb = parse_b3dm(data)
                meshes = extract_meshes_from_glb(glb)
                for m in meshes:
                    pts = transform_positions(m["positions"], m["matrix"], rtc)
                    idx = m["indices"]
                    # Per-triangle split by target polygon
                    parts = split_mesh_by_targets(pts, idx)
                    for label, (sub_pts, sub_idx) in parts.items():
                        if label == -1:
                            bg_positions.append(sub_pts)
                            bg_indices.append(sub_idx + bg_offset)
                            bg_offset += sub_pts.shape[0]
                        else:
                            target_positions[label].append(sub_pts)
                            target_indices[label].append(sub_idx + target_offsets[label])
                            target_offsets[label] += sub_pts.shape[0]
                            stats["target_hits"][label] += 1
                    stats["meshes"] += 1
                    stats["vertices"] += pts.shape[0]
                    stats["faces"] += idx.shape[0] // 3
            except Exception:
                stats["failed"] += 1
            if (i + 1) % 25 == 0:
                print(f"  {i+1}/{len(b3dm_urls)} tiles, verts so far: {stats['vertices']}", flush=True)

    print(f"\n  Stats: {stats}")
    # Compute per-target height ranges from actual mesh vertices (AFTER y-shift)
    target_heights = []
    for i, t in enumerate(TARGET_FOOTPRINTS):
        n = stats["target_hits"][i]
        if n and target_positions[i]:
            all_pts = np.concatenate(target_positions[i], axis=0)
            cx = float(all_pts[:, 0].mean())
            cz = float(all_pts[:, 2].mean())
            ax, az = t["addr_enu"]
            d = math.hypot(cx - ax, cz - az)
            target_heights.append({
                "y_min_raw": float(all_pts[:, 1].min()),
                "y_max_raw": float(all_pts[:, 1].max()),
            })
            print(f"  ✓ {t['name']:16s}: {n} mesh chunks, "
                  f"assembled center=({cx:.1f},{cz:.1f}), "
                  f"Δaddr={d:.2f} m, height=[{all_pts[:,1].min():.1f},{all_pts[:,1].max():.1f}]")
        else:
            target_heights.append({"y_min_raw": 0.0, "y_max_raw": 15.0})
            print(f"  ⚠️  {t['name']:16s}: 0 hits!")

    if not bg_positions and not any(target_positions):
        print("ERROR: no meshes extracted.")
        return 1

    def concat_group(pts_list, idx_list):
        if not pts_list:
            return None, None
        return np.concatenate(pts_list, axis=0), np.concatenate(idx_list, axis=0)

    bg_pos, bg_idx = concat_group(bg_positions, bg_indices)
    target_data = [concat_group(target_positions[i], target_indices[i]) for i in range(len(TARGETS))]

    # Y-shift: use overall min-y so ground is at y=0
    all_ys = [bg_pos[:, 1].min()] if bg_pos is not None else []
    for tp, _ in target_data:
        if tp is not None:
            all_ys.append(tp[:, 1].min())
    y_shift = float(min(all_ys)) if all_ys else 0.0
    if bg_pos is not None:
        bg_pos[:, 1] -= y_shift
    for k in range(len(target_data)):
        tp, ti = target_data[k]
        if tp is not None:
            tp[:, 1] -= y_shift
            target_data[k] = (tp, ti)

    print(f"  Background: {bg_pos.shape[0] if bg_pos is not None else 0:,} verts, target_hits={stats['target_hits']} (y-shift={y_shift:.1f}m)")

    # Sanity: prune vertices outside our ENU bbox (some tiles may extend further)
    # Not strictly needed; keep

    print("\n[3/4] Writing GLBs (with Draco compression, multi-primitive)…")
    # Group primitives: 0=background, 1..N=target buildings
    primitives_desktop = []
    primitives_lite = []

    if bg_pos is not None:
        bg_d_pts, bg_d_idx = decimate_naive(bg_pos, bg_idx, cell=0.5)
        bg_l_pts, bg_l_idx = decimate_naive(bg_pos, bg_idx, cell=2.0)
        primitives_desktop.append(("background", bg_d_pts, bg_d_idx))
        primitives_lite.append(("background", bg_l_pts, bg_l_idx))

    for i, tinfo in enumerate(TARGETS):
        name = tinfo[0]
        tp, ti = target_data[i]
        if tp is None:
            continue
        # Keep target meshes near-lossless (no aggressive decimation) for clean highlight
        t_d_pts, t_d_idx = decimate_naive(tp, ti, cell=0.3)
        t_l_pts, t_l_idx = decimate_naive(tp, ti, cell=1.0)
        primitives_desktop.append((name, t_d_pts, t_d_idx))
        primitives_lite.append((name, t_l_pts, t_l_idx))

    print(f"  Desktop primitives: {[(n, p.shape[0]) for n, p, _ in primitives_desktop]}")
    print(f"  Lite primitives:    {[(n, p.shape[0]) for n, p, _ in primitives_lite]}")

    write_glb_draco_multi(OUT_DIR / "rorschach.glb", primitives_desktop, quantization_bits=14, compression_level=7)
    write_glb_draco_multi(OUT_DIR / "rorschach-lite.glb", primitives_lite, quantization_bits=11, compression_level=10)

    # Export footprints.json — polygon rings in ENU (y-shifted) + heights per target,
    # used by frontend to draw gold extruded contour lines.
    footprints_out = []
    for i, t in enumerate(TARGET_FOOTPRINTS):
        h = target_heights[i]
        y_min = h["y_min_raw"] - y_shift  # apply same shift as mesh positions
        y_max = h["y_max_raw"] - y_shift
        footprints_out.append({
            "name": t["name"],
            "polygon": [[float(x), float(z)] for (x, z) in t["poly_enu"]],
            "centroid": [float(t["centroid_enu"][0]), float(t["centroid_enu"][1])],
            "y_min": float(y_min),
            "y_max": float(y_max),
        })
    with open(OUT_DIR / "footprints.json", "w") as f:
        json.dump({"targets": footprints_out}, f, indent=2)
    print(f"  wrote {OUT_DIR}/footprints.json ({len(footprints_out)} targets)")

    print("\n[4/4] Done.")
    print(f"  {OUT_DIR}/rorschach.glb size: {(OUT_DIR/'rorschach.glb').stat().st_size:,} bytes")
    print(f"  {OUT_DIR}/rorschach-lite.glb size: {(OUT_DIR/'rorschach-lite.glb').stat().st_size:,} bytes")
    return 0

def decimate_naive(positions, indices, cell=1.0):
    """
    Quantize vertices to a grid of `cell` meters; collapse duplicate cells,
    remap indices. Removes degenerate triangles. Fast but rough — good enough
    for a background city silhouette.
    """
    q = np.round(positions / cell).astype(np.int32)
    # Encode into unique keys
    keys = q[:, 0].astype(np.int64) * 10**12 + q[:, 1].astype(np.int64) * 10**6 + q[:, 2].astype(np.int64)
    # np.unique returns (unique_values, indices, inverse) — in that order.
    unique_keys, first_idx, inverse = np.unique(keys, return_index=True, return_inverse=True)
    new_positions = positions[first_idx].astype(np.float32)
    new_indices = inverse[indices].astype(np.uint32)
    # Remove degenerate faces
    faces = new_indices.reshape(-1, 3)
    good = (faces[:, 0] != faces[:, 1]) & (faces[:, 1] != faces[:, 2]) & (faces[:, 0] != faces[:, 2])
    new_indices = faces[good].reshape(-1).astype(np.uint32)
    return new_positions, new_indices

def write_glb_draco_multi(path, primitives, quantization_bits=14, compression_level=7):
    """
    Write a GLB with multiple named primitives, each with its own Draco buffer.
    primitives: list of (name, positions np.float32(N,3), indices np.uint32(M,)).
    Each primitive becomes an individually-loadable mesh under the scene root — the
    client can then override materials or apply highlight effects per-name.
    """
    def pad4(b):
        r = len(b) % 4
        return b + (b"\x00" * (4 - r) if r else b"")

    # 1) Draco-encode each primitive; concatenate their buffers.
    draco_blobs = []
    accessors = []
    bufferviews = []
    prim_defs = []
    materials = []
    nodes = []
    offset = 0
    for name, positions, indices in primitives:
        blob = DracoPy.encode(
            points=positions.astype(np.float32),
            faces=indices.astype(np.uint32),
            quantization_bits=quantization_bits,
            compression_level=compression_level,
        )
        blob_padded = pad4(blob)
        bv_idx = len(bufferviews)
        bufferviews.append({"buffer": 0, "byteOffset": offset, "byteLength": len(blob)})
        offset += len(blob_padded)

        pos_min = positions.min(axis=0).tolist()
        pos_max = positions.max(axis=0).tolist()
        acc_pos = len(accessors)
        accessors.append({
            "componentType": 5126, "count": positions.shape[0],
            "type": "VEC3", "min": pos_min, "max": pos_max,
        })
        acc_idx = len(accessors)
        accessors.append({
            "componentType": 5125, "count": indices.shape[0],
            "type": "SCALAR",
        })
        is_target = name.startswith("obj_")
        mat_idx = len(materials)
        materials.append({
            "name": f"mat_{name}",
            "pbrMetallicRoughness": {
                # Targets bekommen initial das gleiche off-white; Client tauscht Material.
                "baseColorFactor": [0.905, 0.912, 0.933, 1.0] if not is_target else [0.95, 0.93, 0.90, 1.0],
                "metallicFactor": 0.05,
                "roughnessFactor": 0.85,
            },
        })
        mesh_idx = len(prim_defs)
        prim_defs.append({
            "name": name,
            "primitives": [{
                "attributes": {"POSITION": acc_pos},
                "indices": acc_idx,
                "material": mat_idx,
                "mode": 4,
                "extensions": {
                    "KHR_draco_mesh_compression": {
                        "bufferView": bv_idx,
                        "attributes": {"POSITION": 0},
                    }
                },
            }],
        })
        nodes.append({"name": name, "mesh": mesh_idx})
        draco_blobs.append(blob_padded)

    bin_data = b"".join(draco_blobs)
    gltf = {
        "asset": {"generator": "immo-traeum build_twin.py multi", "version": "2.0"},
        "extensionsUsed": ["KHR_draco_mesh_compression"],
        "extensionsRequired": ["KHR_draco_mesh_compression"],
        "scene": 0,
        "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes,
        "meshes": prim_defs,
        "materials": materials,
        "buffers": [{"byteLength": len(bin_data)}],
        "bufferViews": bufferviews,
        "accessors": accessors,
    }

    json_bytes = json.dumps(gltf).encode("utf-8")
    r = len(json_bytes) % 4
    if r:
        json_bytes += b" " * (4 - r)

    total_len = 12 + 8 + len(json_bytes) + 8 + len(bin_data)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total_len))
        f.write(struct.pack("<II", len(json_bytes), 0x4E4F534A))
        f.write(json_bytes)
        f.write(struct.pack("<II", len(bin_data), 0x004E4942))
        f.write(bin_data)
    size = os.path.getsize(path)
    print(f"  wrote {path}  ({size:,} bytes, {len(primitives)} prims)")

def write_glb_draco(path, positions, indices, quantization_bits=14, compression_level=7):
    """
    Write a GLB with KHR_draco_mesh_compression only (no uncompressed fallback).
    Since we mark the extension as `extensionsRequired`, loaders that don't
    support Draco (rare in 2026) will refuse — that's acceptable for our use case.
    """
    # Draco-encode
    draco_bytes = DracoPy.encode(
        points=positions.astype(np.float32),
        faces=indices.astype(np.uint32),
        quantization_bits=quantization_bits,
        compression_level=compression_level,
    )
    print(f"  draco compressed: {len(draco_bytes):,} bytes")

    def pad4(b):
        r = len(b) % 4
        return b + (b"\x00" * (4 - r) if r else b"")

    draco_padded = pad4(draco_bytes)
    bin_data = draco_padded

    pos_min = positions.min(axis=0).tolist()
    pos_max = positions.max(axis=0).tolist()

    # Even Draco-compressed primitives need accessors for POSITION and indices as
    # "empty" (no bufferView), providing min/max/count metadata for renderers.
    gltf = {
        "asset": {"generator": "immo-traeum build_twin.py", "version": "2.0"},
        "extensionsUsed": ["KHR_draco_mesh_compression"],
        "extensionsRequired": ["KHR_draco_mesh_compression"],
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "Rorschach"}],
        "meshes": [{
            "primitives": [{
                "attributes": {"POSITION": 0},
                "indices": 1,
                "material": 0,
                "mode": 4,
                "extensions": {
                    "KHR_draco_mesh_compression": {
                        "bufferView": 0,
                        "attributes": {"POSITION": 0},
                    }
                },
            }],
        }],
        "materials": [{
            "name": "Buildings",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.905, 0.912, 0.933, 1.0],
                "metallicFactor": 0.05,
                "roughnessFactor": 0.85,
            },
        }],
        "buffers": [{"byteLength": len(bin_data)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": len(draco_bytes)},
        ],
        "accessors": [
            {
                "componentType": 5126, "count": positions.shape[0],
                "type": "VEC3", "min": pos_min, "max": pos_max,
            },
            {
                "componentType": 5125, "count": indices.shape[0],
                "type": "SCALAR",
            },
        ],
    }

    json_bytes = json.dumps(gltf).encode("utf-8")
    r = len(json_bytes) % 4
    if r:
        json_bytes += b" " * (4 - r)

    total_len = 12 + 8 + len(json_bytes) + 8 + len(bin_data)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total_len))
        f.write(struct.pack("<II", len(json_bytes), 0x4E4F534A))
        f.write(json_bytes)
        f.write(struct.pack("<II", len(bin_data), 0x004E4942))
        f.write(bin_data)
    size = os.path.getsize(path)
    print(f"  wrote {path}  ({size:,} bytes)")

def write_glb(path, positions, indices):
    """Write a minimal GLB with positions + indices, single mesh, one material."""
    # Pack binary buffer
    pos_bytes = positions.astype(np.float32).tobytes()
    idx_bytes = indices.astype(np.uint32).tobytes()

    # Pad each chunk to 4-byte boundary
    def pad4(b):
        r = len(b) % 4
        return b + (b"\x00" * (4 - r) if r else b"")
    pos_padded = pad4(pos_bytes)
    idx_padded = pad4(idx_bytes)
    bin_data = pos_padded + idx_padded

    pos_min = positions.min(axis=0).tolist()
    pos_max = positions.max(axis=0).tolist()

    gltf = {
        "asset": {"generator": "immo-traeum build_twin.py", "version": "2.0"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "Rorschach"}],
        "meshes": [{
            "primitives": [{
                "attributes": {"POSITION": 0},
                "indices": 1,
                "material": 0,
                "mode": 4,
            }],
        }],
        "materials": [{
            "name": "Buildings",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.905, 0.912, 0.933, 1.0],
                "metallicFactor": 0.05,
                "roughnessFactor": 0.85,
            },
        }],
        "buffers": [{"byteLength": len(bin_data)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": len(pos_bytes), "target": 34962},
            {"buffer": 0, "byteOffset": len(pos_padded), "byteLength": len(idx_bytes), "target": 34963},
        ],
        "accessors": [
            {
                "bufferView": 0, "componentType": 5126, "count": positions.shape[0],
                "type": "VEC3", "min": pos_min, "max": pos_max,
            },
            {
                "bufferView": 1, "componentType": 5125, "count": indices.shape[0],
                "type": "SCALAR",
            },
        ],
    }

    json_bytes = json.dumps(gltf).encode("utf-8")
    # pad json chunk to 4-byte with spaces
    r = len(json_bytes) % 4
    if r:
        json_bytes += b" " * (4 - r)

    total_len = 12 + 8 + len(json_bytes) + 8 + len(bin_data)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total_len))
        f.write(struct.pack("<II", len(json_bytes), 0x4E4F534A))
        f.write(json_bytes)
        f.write(struct.pack("<II", len(bin_data), 0x004E4942))
        f.write(bin_data)
    print(f"  wrote {path}")

if __name__ == "__main__":
    sys.exit(main())
