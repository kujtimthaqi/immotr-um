"""Mongo-compatible document store on Vercel Blob (used when no MONGO_URL is configured).

Each collection is one private JSON blob (`db/<collection>.json`). Every operation
loads the collection into an in-memory mongomock collection (so query semantics and
unique indexes are exactly Mongo's) and writes back with an `x-if-match` ETag
precondition. A concurrent change makes the write fail with 412 and the whole
operation is retried on fresh data (optimistic concurrency).

Sized for a small business: each operation reads the whole collection.
"""
import asyncio
import logging
import random
from datetime import timezone
from typing import Any, Callable, Optional

import httpx
import mongomock
from bson import json_util
from bson.json_util import RELAXED_JSON_OPTIONS, JSONOptions

logger = logging.getLogger(__name__)

BLOB_API_URL = "https://vercel.com/api/blob/"
BLOB_API_VERSION = "11"
MAX_ATTEMPTS = 8
LOAD_OPTIONS = JSONOptions(tz_aware=True, tzinfo=timezone.utc)


class WriteConflict(Exception):
    """The blob changed since it was read (or was created concurrently)."""


class VercelBlobBackend:
    """Minimal private-blob client: read with ETag, create-only or conditional write."""

    def __init__(self, token: str, prefix: str = "db/"):
        self._token = token
        self._prefix = prefix
        # token format: vercel_blob_rw_<storeId>_<secret>
        parts = token.split("_")
        self._store_url = f"https://{parts[3]}.private.blob.vercel-storage.com/" if len(parts) > 3 else ""

    def _path(self, collection: str) -> str:
        return f"{self._prefix}{collection}.json"

    async def read(self, collection: str) -> tuple[str, Optional[str]]:
        # Uncompressed on purpose: a compressed response (bodies over ~1 KB) carries a weak
        # ETag (W/"…"), which the conditional write never matches -> endless 412 conflicts.
        headers = {"authorization": f"Bearer {self._token}", "accept-encoding": "identity"}
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            response = await client.get(f"{self._store_url}{self._path(collection)}", params={"cache": "0"},
                                        headers=headers)
        if response.status_code == 404:
            return "[]", None
        response.raise_for_status()
        return response.text, strong_etag(response.headers.get("etag"))

    async def write(self, collection: str, body: str, etag: Optional[str]) -> None:
        headers = {
            "authorization": f"Bearer {self._token}",
            "x-api-version": BLOB_API_VERSION,
            "x-vercel-blob-access": "private",
            "x-add-random-suffix": "0",
            "x-content-type": "application/json",
            # no ETag yet -> create-only, so two first writers cannot both succeed
            "x-allow-overwrite": "1" if etag else "0",
        }
        if etag:
            headers["x-if-match"] = etag
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.put(BLOB_API_URL, params={"pathname": self._path(collection)},
                                        content=body.encode("utf-8"), headers=headers)
        if response.status_code == 412 or (response.status_code == 400 and _is_conflict(response.text, etag)):
            raise WriteConflict(collection)
        response.raise_for_status()


def strong_etag(etag: Optional[str]) -> Optional[str]:
    """Drop a weak-validator prefix; the opaque tag is the same blob version."""
    if etag and etag.startswith("W/"):
        return etag[2:]
    return etag


def _is_conflict(body: str, etag: Optional[str]) -> bool:
    """Blob reports lost races as 400: a concurrent create, or a concurrent conditional write."""
    if "conflicting operation" in body:
        return True
    return etag is None and "already exists" in body


def _dump(docs: list[dict]) -> str:
    return json_util.dumps([{k: v for k, v in d.items() if k != "_id" or isinstance(v, str)} for d in docs],
                           json_options=RELAXED_JSON_OPTIONS)


def _load(body: str) -> list[dict]:
    return json_util.loads(body, json_options=LOAD_OPTIONS)


class BlobDatabase:
    def __init__(self, backend):
        self._backend = backend
        self._unique: dict[str, list[list[tuple[str, int]]]] = {}
        self._collections: dict[str, "BlobCollection"] = {}

    def register_unique(self, name: str, keys: list[tuple[str, int]]) -> None:
        existing = self._unique.setdefault(name, [])
        if keys not in existing:
            existing.append(keys)

    async def snapshot(self, name: str):
        """Load the collection into a fresh in-memory mongomock collection."""
        body, etag = await self._backend.read(name)
        collection = mongomock.MongoClient(tz_aware=True)["snapshot"][name]
        for keys in self._unique.get(name, []):
            collection.create_index(keys, unique=True)
        docs = _load(body)
        if docs:
            collection.insert_many(docs)
        return collection, etag

    async def persist(self, name: str, collection, etag: Optional[str]) -> None:
        await self._backend.write(name, _dump(list(collection.find({}))), etag)

    def __getattr__(self, name: str) -> "BlobCollection":
        if name.startswith("_"):
            raise AttributeError(name)
        return self[name]

    def __getitem__(self, name: str) -> "BlobCollection":
        if name not in self._collections:
            self._collections[name] = BlobCollection(self, name)
        return self._collections[name]


class BlobCursor:
    def __init__(self, coll: "BlobCollection", query: dict, projection: Optional[dict]):
        self._coll, self._query, self._projection = coll, query, projection
        self._sort: list[tuple[str, int]] = []
        self._skip = 0
        self._limit = 0

    def sort(self, key, direction: int = 1) -> "BlobCursor":
        self._sort = list(key) if isinstance(key, list) else [(key, direction)]
        return self

    def skip(self, count: int) -> "BlobCursor":
        self._skip = count
        return self

    def limit(self, count: int) -> "BlobCursor":
        self._limit = count
        return self

    async def to_list(self, length: Optional[int] = None) -> list[dict]:
        collection, _ = await self._coll.database.snapshot(self._coll.name)
        cursor = collection.find(self._query, self._projection)
        if self._sort:
            cursor = cursor.sort(self._sort)
        if self._skip:
            cursor = cursor.skip(self._skip)
        limits = [n for n in (self._limit, length) if n]
        if limits:
            cursor = cursor.limit(min(limits))
        return list(cursor)

    def __aiter__(self):
        async def generator():
            for doc in await self.to_list():
                yield doc
        return generator()


class BlobCollection:
    """The subset of Motor's collection API the application uses."""

    def __init__(self, database: BlobDatabase, name: str):
        self.database = database
        self.name = name

    async def _write(self, operation: Callable[[Any], tuple[Any, bool]]):
        """Run `operation(collection) -> (result, changed)` with optimistic retries."""
        for attempt in range(MAX_ATTEMPTS):
            collection, etag = await self.database.snapshot(self.name)
            result, changed = operation(collection)
            if not changed:
                return result
            try:
                await self.database.persist(self.name, collection, etag)
                return result
            except WriteConflict:
                logger.info("Write conflict on %s (attempt %s), retrying", self.name, attempt + 1)
                await asyncio.sleep(0.05 * (attempt + 1) + random.random() * 0.05)
        raise RuntimeError(f"Konnte {self.name} nach {MAX_ATTEMPTS} Versuchen nicht speichern")

    async def create_index(self, keys, unique: bool = False, **_: Any) -> str:
        normalized = [(keys, 1)] if isinstance(keys, str) else list(keys)
        if unique:
            self.database.register_unique(self.name, normalized)
        return "_".join(f"{k}_{d}" for k, d in normalized)

    async def insert_one(self, document: dict):
        return await self._write(lambda c: (c.insert_one(document), True))

    async def insert_many(self, documents: list[dict]):
        return await self._write(lambda c: (c.insert_many(documents), bool(documents)))

    async def delete_many(self, query: dict):
        def run(c):
            result = c.delete_many(query)
            return result, result.deleted_count > 0
        return await self._write(run)

    async def update_one(self, query: dict, update: dict):
        def run(c):
            result = c.update_one(query, update)
            return result, result.modified_count > 0
        return await self._write(run)

    async def update_many(self, query: dict, update: dict):
        def run(c):
            result = c.update_many(query, update)
            return result, result.modified_count > 0
        return await self._write(run)

    async def find_one_and_update(self, query: dict, update: dict, **kwargs: Any):
        def run(c):
            before = c.find_one_and_update(query, update, **kwargs)
            return before, before is not None
        return await self._write(run)

    async def delete_one(self, query: dict):
        def run(c):
            result = c.delete_one(query)
            return result, result.deleted_count > 0
        return await self._write(run)

    async def find_one(self, query: Optional[dict] = None, projection: Optional[dict] = None):
        collection, _ = await self.database.snapshot(self.name)
        return collection.find_one(query or {}, projection)

    def find(self, query: Optional[dict] = None, projection: Optional[dict] = None) -> BlobCursor:
        return BlobCursor(self, query or {}, projection)

    async def count_documents(self, query: dict) -> int:
        collection, _ = await self.database.snapshot(self.name)
        return collection.count_documents(query)
