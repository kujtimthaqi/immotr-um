"""
Iteration_4: mobile videos, content-type, valuation validation (pydantic Field).
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://immo-traeum-preview.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# ---------- Mobile video assets: existence, size budget, content-type ----------
MOBILE_VIDEOS = [
    # (path, max_bytes)
    ("/media/hero-mobile.mp4",       1_200_000),
    ("/media/hero-mobile.webm",      1_200_000),
    ("/media/landhaus-mobile.mp4",   1_048_576),   # 1 MB
    ("/media/landhaus-mobile.webm",  1_200_000),
    ("/media/dachwohnung-mobile.mp4", 614_400),    # 600 KB
    ("/media/dachwohnung-mobile.webm", 700_000),
]


class TestMobileMedia:
    @pytest.mark.parametrize("path,max_bytes", MOBILE_VIDEOS)
    def test_mobile_video_exists_size(self, s, path, max_bytes):
        r = s.get(f"{BASE_URL}{path}", timeout=60, stream=True)
        assert r.status_code == 200, f"{path} -> {r.status_code}"
        cl = int(r.headers.get("content-length") or 0)
        # Only assert when Content-Length is provided; report size otherwise
        if cl:
            assert cl <= max_bytes, f"{path} size {cl} exceeds budget {max_bytes}"
        print(f"MOBILE {path} = {cl} bytes (budget {max_bytes})")

    @pytest.mark.parametrize("path,expected_ct", [
        ("/media/hero.mp4",                "video/mp4"),
        ("/media/hero.webm",               "video/webm"),
        ("/media/hero-mobile.mp4",         "video/mp4"),
        ("/media/hero-mobile.webm",        "video/webm"),
        ("/media/landhaus-mobile.mp4",     "video/mp4"),
        ("/media/landhaus-mobile.webm",    "video/webm"),
        ("/media/dachwohnung-mobile.mp4",  "video/mp4"),
        ("/media/dachwohnung-mobile.webm", "video/webm"),
        ("/media/hero-poster-1600.webp",   "image/webp"),
        ("/media/dachwohnung-800.webp",    "image/webp"),
    ])
    def test_content_type(self, s, path, expected_ct):
        r = s.head(f"{BASE_URL}{path}", timeout=30, allow_redirects=True)
        if r.status_code != 200:
            r = s.get(f"{BASE_URL}{path}", timeout=30, stream=True)
        assert r.status_code == 200, f"{path} -> {r.status_code}"
        ct = r.headers.get("content-type", "")
        assert expected_ct in ct, f"{path} content-type={ct} (want {expected_ct})"


# ---------- Valuation Pydantic validation ----------
class TestValuationValidation:
    BASE = {
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

    def _p(self, **overrides):
        p = dict(self.BASE)
        p.update(overrides)
        return p

    def test_area_too_small_rejected(self, s):
        r = s.post(f"{BASE_URL}/api/valuation", json=self._p(area=5), timeout=30)
        assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text[:400]}"

    def test_rooms_negative_rejected(self, s):
        r = s.post(f"{BASE_URL}/api/valuation", json=self._p(rooms=-1), timeout=30)
        assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text[:400]}"

    def test_year_built_too_old_rejected(self, s):
        r = s.post(f"{BASE_URL}/api/valuation", json=self._p(year_built=1600), timeout=30)
        assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text[:400]}"

    def test_valid_valuation_200(self, s):
        r = s.post(f"{BASE_URL}/api/valuation", json=self._p(area=110), timeout=90)
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        for k in ("expected", "min", "max", "factors", "commentary"):
            assert k in data, f"missing {k}"
        assert data["min"] <= data["expected"] <= data["max"]
