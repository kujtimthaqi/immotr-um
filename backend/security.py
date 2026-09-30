"""Admin session auth and rate limiting.

Admin login issues a short-lived signed JWT in an HttpOnly, Secure, SameSite=Strict
cookie. Mutating admin requests must also carry the X-ITM-Admin header, which forces
a CORS preflight and blocks cross-site form posts.

Rate limits live in MongoDB (TTL-indexed) so they hold across serverless instances.
"""
import hashlib
import hmac
import os
import time
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, Request, Response
from pymongo import ReturnDocument

ADMIN_COOKIE = "itm_admin"
ADMIN_HEADER = "x-itm-admin"
SESSION_TTL_SECONDS = 8 * 60 * 60
JWT_ALG = "HS256"
MIN_SECRET_LENGTH = 32
MIN_PASSWORD_LENGTH = 12


def _session_secret() -> str:
    secret = os.environ.get("ADMIN_SESSION_SECRET", "")
    if len(secret) < MIN_SECRET_LENGTH:
        raise HTTPException(status_code=503, detail="Admin nicht konfiguriert")
    return secret


def verify_admin_password(candidate: str) -> bool:
    expected = os.environ.get("ADMIN_PASSWORD", "")
    if len(expected) < MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=503, detail="Admin nicht konfiguriert")
    return hmac.compare_digest(candidate.encode(), expected.encode())


def issue_session(response: Response) -> None:
    now = int(time.time())
    token = jwt.encode(
        {"sub": "admin", "iat": now, "exp": now + SESSION_TTL_SECONDS},
        _session_secret(),
        algorithm=JWT_ALG,
    )
    response.set_cookie(
        ADMIN_COOKIE,
        token,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        secure=os.environ.get("COOKIE_INSECURE") != "1",
        samesite="strict",
        path="/api",
    )


def clear_session(response: Response) -> None:
    response.delete_cookie(ADMIN_COOKIE, path="/api")


def require_admin(request: Request) -> None:
    """FastAPI dependency: valid session cookie, plus CSRF header on writes."""
    token = request.cookies.get(ADMIN_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        jwt.decode(token, _session_secret(), algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if request.method not in ("GET", "HEAD") and request.headers.get(ADMIN_HEADER) != "1":
        raise HTTPException(status_code=403, detail="Forbidden")


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _hash_ip(ip: str) -> str:
    salt = os.environ.get("ADMIN_SESSION_SECRET", "itm")
    return hashlib.sha256(f"{salt}:{ip}".encode()).hexdigest()[:32]


# bucket -> (max requests, window seconds)
RATE_LIMITS = {
    "login": (5, 15 * 60),
    "inquiry": (5, 60 * 60),
    "chat": (30, 60 * 60),
    "valuation": (20, 60 * 60),
}


async def ensure_rate_limit_index(db) -> None:
    await db.rate_limits.create_index("expires_at", expireAfterSeconds=0)


async def enforce_rate_limit(db, request: Request, bucket: str) -> None:
    limit, window = RATE_LIMITS[bucket]
    window_start = int(time.time()) // window
    key = f"{bucket}:{_hash_ip(client_ip(request))}:{window_start}"
    expires = datetime.now(timezone.utc) + timedelta(seconds=window)
    doc = await db.rate_limits.find_one_and_update(
        {"_id": key},
        {"$inc": {"count": 1}, "$setOnInsert": {"expires_at": expires}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    if doc and doc.get("count", 0) > limit:
        raise HTTPException(
            status_code=429,
            detail="Zu viele Anfragen. Bitte später erneut versuchen.",
        )
