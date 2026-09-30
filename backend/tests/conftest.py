import os
import sys
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ["ADMIN_PASSWORD"] = "test-password-123456"
os.environ["ADMIN_SESSION_SECRET"] = "s" * 40
os.environ["COOKIE_INSECURE"] = "1"
os.environ.pop("ANTHROPIC_API_KEY", None)

import server  # noqa: E402

ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]


@pytest.fixture
async def client(monkeypatch):
    monkeypatch.setattr(server, "db", AsyncMongoMockClient()["test"])
    monkeypatch.setattr(server, "_initialized", False)
    transport = ASGITransport(app=server.app, client=("10.0.0.1", 1234))
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
async def admin(client):
    r = await client.post("/api/admin/login", json={"password": ADMIN_PASSWORD})
    assert r.status_code == 200
    return client
