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
from blob_store import BlobDatabase, WriteConflict  # noqa: E402

ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]


class FakeBlobBackend:
    """In-memory stand-in for VercelBlobBackend with ETag / create-only semantics."""

    def __init__(self):
        self.blobs = {}
        self.writes = 0

    async def read(self, collection):
        return self.blobs.get(collection, ("[]", None))

    async def write(self, collection, body, etag):
        current = self.blobs.get(collection)
        if (current is None and etag is not None) or (current is not None and current[1] != etag):
            raise WriteConflict(collection)
        self.writes += 1
        self.blobs[collection] = (body, f'"etag-{self.writes}"')


@pytest.fixture(params=["mongo", "blob"])
async def client(monkeypatch, request):
    database = AsyncMongoMockClient()["test"] if request.param == "mongo" else BlobDatabase(FakeBlobBackend())
    monkeypatch.setattr(server, "db", database)
    monkeypatch.setattr(server, "_initialized", False)
    transport = ASGITransport(app=server.app, client=("10.0.0.1", 1234))
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
async def admin(client):
    r = await client.post("/api/admin/login", json={"password": ADMIN_PASSWORD})
    assert r.status_code == 200
    return client
