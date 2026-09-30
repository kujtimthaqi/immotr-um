import llm
import server

ADMIN_HDR = {"X-ITM-Admin": "1"}
LISTING = {"title": "Test", "address": "Weg 1", "kind": "rental"}
INQUIRY = {"name": "Anna", "email": "anna@example.ch", "message": "Hallo"}


async def test_listings_are_seeded_on_first_request(client):
    r = await client.get("/api/listings")
    assert r.status_code == 200
    assert len(r.json()) >= 2


async def test_login_rejects_wrong_password(client):
    r = await client.post("/api/admin/login", json={"password": "nope"})
    assert r.status_code == 401


async def test_login_sets_httponly_cookie_and_returns_no_secret(client):
    r = await client.post("/api/admin/login", json={"password": "test-password-123456"})
    assert r.status_code == 200
    assert r.json() == {"ok": True}
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=strict" in cookie


async def test_login_is_rate_limited(client):
    codes = [
        (await client.post("/api/admin/login", json={"password": "wrong"})).status_code
        for _ in range(6)
    ]
    assert codes[:5] == [401] * 5
    assert codes[5] == 429


async def test_admin_routes_require_session(client):
    assert (await client.get("/api/inquiries")).status_code == 401
    assert (await client.post("/api/listings", json=LISTING, headers=ADMIN_HDR)).status_code == 401
    assert (await client.put("/api/listings/x", json=LISTING, headers=ADMIN_HDR)).status_code == 401
    assert (await client.delete("/api/listings/x", headers=ADMIN_HDR)).status_code == 401


async def test_legacy_password_header_no_longer_grants_access(client):
    r = await client.get("/api/inquiries", headers={"X-Admin-Password": "test-password-123456"})
    assert r.status_code == 401


async def test_admin_write_requires_csrf_header(admin):
    assert (await admin.post("/api/listings", json=LISTING)).status_code == 403


async def test_admin_crud_roundtrip(admin):
    r = await admin.post("/api/listings", json=LISTING, headers=ADMIN_HDR)
    assert r.status_code == 200
    lid = r.json()["id"]
    r = await admin.put(f"/api/listings/{lid}", json={**LISTING, "title": "Neu"}, headers=ADMIN_HDR)
    assert r.json()["title"] == "Neu"
    r = await admin.delete(f"/api/listings/{lid}", headers=ADMIN_HDR)
    assert r.json() == {"deleted": 1}


async def test_logout_clears_session(admin):
    await admin.post("/api/admin/logout")
    assert (await admin.get("/api/admin/me")).status_code == 401


async def test_inquiry_is_stored_and_visible_to_admin(admin):
    r = await admin.post("/api/inquiries", json=INQUIRY)
    assert r.status_code == 201
    rows = (await admin.get("/api/inquiries")).json()
    assert [i["name"] for i in rows] == ["Anna"]


async def test_inquiry_honeypot_is_silently_dropped(admin):
    r = await admin.post("/api/inquiries", json={**INQUIRY, "website": "http://spam"})
    assert r.status_code == 201
    assert (await admin.get("/api/inquiries")).json() == []


async def test_inquiry_is_rate_limited(client):
    codes = [(await client.post("/api/inquiries", json=INQUIRY)).status_code for _ in range(6)]
    assert codes[5] == 429


async def test_inquiry_rejects_oversized_message(client):
    r = await client.post("/api/inquiries", json={**INQUIRY, "message": "x" * 6000})
    assert r.status_code == 422


async def test_valuation_falls_back_without_llm(client):
    r = await client.post("/api/valuation", json={"property_type": "wohnung", "zip": "9400", "area": 100})
    body = r.json()
    assert r.status_code == 200
    assert body["region"] == "rorschach"
    assert body["min"] < body["expected"] < body["max"]
    assert body["commentary"] == server.VALUATION_FALLBACK


async def test_chat_stream_reports_error_without_leaking_details(client):
    r = await client.post("/api/chat/stream", json={"message": "Hallo"})
    assert r.status_code == 200
    assert '"type": "error"' in r.text
    assert "ANTHROPIC_API_KEY" not in r.text


async def test_chat_stream_relays_llm_deltas(client, monkeypatch):
    captured = {}

    async def fake_stream(system, messages):
        captured["messages"] = messages
        yield "Grüezi"

    monkeypatch.setattr(llm, "stream_text", fake_stream)
    history = [
        {"role": "assistant", "content": "Willkommen"},
        {"role": "user", "content": "Frage 1"},
        {"role": "assistant", "content": "Antwort 1"},
    ]
    r = await client.post("/api/chat/stream", json={"message": "Frage 2", "history": history})
    assert "Grüezi" in r.text
    assert [m["role"] for m in captured["messages"]] == ["user", "assistant", "user"]
    assert captured["messages"][-1]["content"] == "Frage 2"


async def test_api_docs_are_disabled(client):
    assert (await client.get("/docs")).status_code == 404
    assert (await client.get("/openapi.json")).status_code == 404
