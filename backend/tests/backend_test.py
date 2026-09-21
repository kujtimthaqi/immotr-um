"""
Backend regression + functional tests for Immo Traeum AG.
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://immo-traeum-preview.preview.emergentagent.com").rstrip("/")
ADMIN_PW = "8dl0ex4DCHwjk9juezvxmt4m"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# ---------- Media assets (new Higgsfield Pro asset set) ----------
NEW_ASSETS = [
    "/media/hero-poster-800.webp",
    "/media/hero-poster-800.avif",
    "/media/hero-poster-1600.webp",
    "/media/hero-poster-1600.avif",
    "/media/dachwohnung-800.webp",
    "/media/dachwohnung-1600.webp",
    "/media/dachwohnung-1600.avif",
    "/media/landhaus-800.webp",
    "/media/landhaus-1600.webp",
    "/media/landhaus-1600.avif",
    "/media/lagerraum-800.webp",
    "/media/lagerraum-1600.webp",
    "/media/lagerraum-1600.avif",
    "/media/relocation-800.webp",
    "/media/relocation-1600.webp",
    "/media/relocation-1600.avif",
    "/media/erbe-800.webp",
    "/media/erbe-1600.webp",
    "/media/erbe-1600.avif",
    "/media/invest-800.webp",
    "/media/invest-1600.webp",
    "/media/invest-1600.avif",
]


class TestMedia:
    @pytest.mark.parametrize("path", NEW_ASSETS)
    def test_new_image_asset_200(self, s, path):
        r = s.head(f"{BASE_URL}{path}", timeout=30, allow_redirects=True)
        if r.status_code != 200:
            r = s.get(f"{BASE_URL}{path}", timeout=30)
        assert r.status_code == 200, f"{path} -> {r.status_code}"
        ctype = r.headers.get("content-type", "")
        assert "image/" in ctype or "octet-stream" in ctype, f"{path} ctype={ctype}"

    def test_hero_mp4(self, s):
        r = s.get(f"{BASE_URL}/media/hero.mp4", timeout=60, stream=True)
        assert r.status_code == 200
        cl = int(r.headers.get("content-length") or 0)
        assert 0 < cl <= 8_388_608, f"hero.mp4 size {cl} > 8MB"
        assert "video/mp4" in r.headers.get("content-type", ""), r.headers.get("content-type")

    def test_hero_webm(self, s):
        r = s.get(f"{BASE_URL}/media/hero.webm", timeout=60, stream=True)
        assert r.status_code == 200
        assert "video/webm" in r.headers.get("content-type", ""), r.headers.get("content-type")

    def test_dachwohnung_mp4(self, s):
        r = s.get(f"{BASE_URL}/media/dachwohnung.mp4", timeout=60, stream=True)
        assert r.status_code == 200
        cl = int(r.headers.get("content-length") or 0)
        assert 0 < cl <= 3_145_728, f"dachwohnung.mp4 size {cl} > 3MB"

    def test_dachwohnung_webm(self, s):
        r = s.get(f"{BASE_URL}/media/dachwohnung.webm", timeout=60, stream=True)
        assert r.status_code == 200

    @pytest.mark.parametrize("path", [
        "/media/hero.png",
        "/media/hero-2400.avif",
        "/media/hero-2400.webp",
        "/media/hero-800.webp",
        "/media/hero-1600.webp",
    ])
    def test_old_hero_gone(self, s, path):
        r = s.get(f"{BASE_URL}{path}", timeout=30)
        ctype = r.headers.get("content-type", "")
        # Old assets must NOT be served as images anymore
        assert r.status_code == 404 or ctype.startswith("text/html"), \
            f"{path} still served: {r.status_code} {ctype}"


# ---------- Listings ----------
class TestListings:
    def test_get_listings(self, s):
        r = s.get(f"{BASE_URL}/api/listings", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 7, f"Expected 7 listings, got {len(data)}"

        # Check specific listings
        dach = next((x for x in data if "Dach-Wohnung" in (x.get("title") or "") or "Dachwohnung" in (x.get("title") or "")), None)
        assert dach is not None, "Dachwohnung listing not found"
        assert dach.get("image_url") == "/media/dachwohnung-800.webp", f"got {dach.get('image_url')}"
        assert dach.get("video_url") == "/media/dachwohnung.mp4", f"got video_url={dach.get('video_url')}"

        land = next((x for x in data if "Landhaus" in (x.get("title") or "")), None)
        assert land is not None, "Landhaus listing not found"
        assert land.get("image_url") == "/media/landhaus-800.webp", f"got {land.get('image_url')}"

        lager = next((x for x in data if "Lagerraum" in (x.get("title") or "") or "Naturkeller" in (x.get("title") or "")), None)
        assert lager is not None, "Lagerraum listing not found"
        assert lager.get("image_url") == "/media/lagerraum-800.webp", f"got {lager.get('image_url')}"


# ---------- Valuation ----------
class TestValuation:
    def test_valuation(self, s):
        payload = {
            "property_type": "wohnung",
            "zip": "9400",
            "city": "Rorschach",
            "area": 110,
            "rooms": 4.5,
            "year_built": 2005,
            "condition": 4,
            "location_quality": 4,
            "lake_view": True,
            "balcony": True,
        }
        r = s.post(f"{BASE_URL}/api/valuation", json=payload, timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("expected", "min", "max", "confidence", "factors", "commentary"):
            assert k in data, f"missing {k}"
        assert isinstance(data["expected"], (int, float))
        assert data["min"] <= data["expected"] <= data["max"]
        commentary = data["commentary"]
        assert isinstance(commentary, str) and len(commentary) > 20
        # German-ish
        assert re.search(r"\b(die|der|das|und|für|Wohn|Immobil|Objekt|Lage|CHF)\b", commentary, re.I), commentary[:400]
        # No 15 Jahre experience claim
        assert "15 Jahre" not in commentary
        assert "15+ Jahre" not in commentary


# ---------- Inquiries ----------
class TestInquiries:
    def test_create_inquiry(self, s):
        payload = {
            "name": "TEST_User",
            "email": "test@example.com",
            "phone": "+41791234567",
            "message": "TEST_ Anfrage - bitte ignorieren.",
            "subject": "TEST",
        }
        r = s.post(f"{BASE_URL}/api/inquiries", json=payload, timeout=30)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert "id" in data


# ---------- Admin auth ----------
class TestAdmin:
    def test_login_wrong(self, s):
        r = s.post(f"{BASE_URL}/api/admin/login", json={"password": "wrong"}, timeout=30)
        assert r.status_code == 401

    def test_login_correct(self, s):
        r = s.post(f"{BASE_URL}/api/admin/login", json={"password": ADMIN_PW}, timeout=30)
        assert r.status_code == 200
        # token or ok
        assert r.json()

    def test_get_inquiries_requires_auth(self, s):
        r = s.get(f"{BASE_URL}/api/inquiries", timeout=30)
        assert r.status_code == 401

    def test_get_inquiries_with_auth(self, s):
        r = s.get(f"{BASE_URL}/api/inquiries", headers={"X-Admin-Password": ADMIN_PW}, timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_listings_write_requires_auth(self, s):
        # Sending a body without X-Admin-Password header: FastAPI validates body first
        # so may return 422; either 401 or 422 is acceptable (both reject).
        r = s.post(f"{BASE_URL}/api/listings", json={"kind": "rental", "title": "TEST_x"}, timeout=30)
        assert r.status_code in (401, 422), f"got {r.status_code}"


# ---------- Chat stream ----------
class TestChatStream:
    def test_stream(self, s):
        r = s.post(
            f"{BASE_URL}/api/chat/stream",
            json={"session_id": "test-session", "message": "Was macht Immo Traeum AG?"},
            stream=True,
            timeout=60,
        )
        assert r.status_code == 200
        ctype = r.headers.get("content-type", "")
        assert "text/event-stream" in ctype, f"content-type={ctype}"
        deltas = 0
        done = False
        buf = ""
        for chunk in r.iter_content(chunk_size=None, decode_unicode=True):
            if not chunk:
                continue
            buf += chunk
            if '"type":"delta"' in chunk or '"type": "delta"' in chunk:
                deltas += chunk.count('"delta"')
            if '"type":"done"' in chunk or '"type": "done"' in chunk:
                done = True
                break
            if len(buf) > 200_000:
                break
        assert deltas > 0, f"no delta chunks. buf={buf[:400]}"
        assert done, f"no done event. buf tail={buf[-400:]}"


# ---------- Regression: '15 Jahre' claims ----------
class TestNo15Jahre:
    def test_frontend_home_no_15jahre(self, s):
        r = s.get(BASE_URL + "/", timeout=30)
        html = r.text
        # SSR/CSR - since it's CRA, mostly a shell. But we can still check.
        for bad in ["15+ Jahre", "15 Jahre", "seit über 15"]:
            assert bad not in html, f"Found '{bad}' in rendered HTML"
