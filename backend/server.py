import json
import logging
import os
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import llm  # noqa: E402  (reads env at import)
from blob_store import BlobDatabase, VercelBlobBackend  # noqa: E402
from models import (  # noqa: E402
    AdminLogin, ChatBody, Inquiry, InquiryCreate, Listing, ListingCreate, ValuationInput,
)
from security import (  # noqa: E402
    clear_session, enforce_rate_limit, ensure_rate_limit_index, issue_session,
    require_admin, verify_admin_password,
)
from seed import seed_listings  # noqa: E402
from valuation import compute_valuation  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

def _open_database():
    """MongoDB when MONGO_URL is set, otherwise the private Vercel Blob document store."""
    if os.environ.get("MONGO_URL"):
        return AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ.get("DB_NAME", "immo_traeum")]
    if os.environ.get("BLOB_READ_WRITE_TOKEN"):
        return BlobDatabase(VercelBlobBackend(os.environ["BLOB_READ_WRITE_TOKEN"]))
    raise RuntimeError("Set MONGO_URL (MongoDB) or BLOB_READ_WRITE_TOKEN (Vercel Blob storage)")


db = _open_database()

app = FastAPI(title="Immo Traeum AG API", docs_url=None, redoc_url=None, openapi_url=None)
api_router = APIRouter(prefix="/api")

PHONE = "044 687 71 34"
COMPANY_INFO = """
Firma: Immo Traeum AG
Adresse: Strandweg 17, 8807 Freienbach, Schweiz
Telefon: 044 687 71 34
E-Mail: info@immo-traeum.li

Regionen: Ostschweiz, Zentralschweiz, Fürstentum Liechtenstein — insbesondere zwischen Bodensee und Alpen.
Mitgliedschaften: SIV (Schweizerischer Immobilienschätzer-Verband), Casafair.

Leistungen:
- Bewerten (SIV-konform, Verkehrswertschätzung)
- Bewirtschaften (Verwaltung, Vermietung, Buchhaltung)
- Beraten (Kauf, Verkauf, Investition)
- Erbteilungen & Willensvollstreckung (diskret, unabhängige Instanz)
- Sanierungs- & Umbaubegleitung
- Steuererklärungen (mit/ohne Immobilien)
- Relocation Service (Wohnung, Bank, Versicherung, Schule, Anmeldung)
- Immobilienbeteiligungen (passives Investment)

Haltung: diskret, präzise, persönlich. Schweizer Rechtschreibung (ss statt ß).
Bei rechtlichen oder steuerlichen Detailfragen: Hinweis auf persönliches Gespräch.
"""

VALUATION_FALLBACK = (
    "Diese indikative Schätzung basiert auf hedonischen Vergleichswerten der Region und den erfassten "
    "Objektmerkmalen. Für eine verbindliche, SIV-konforme Verkehrswertschätzung empfehlen wir ein "
    "persönliches Gespräch mit unseren Schätzern."
)

_initialized = False


async def ensure_initialized() -> None:
    """Idempotent lazy init (serverless platforms may skip lifespan events)."""
    global _initialized
    if _initialized:
        return
    await ensure_rate_limit_index(db)
    await db.listings.create_index("id", unique=True)
    if await db.listings.count_documents({}) == 0:
        seed = seed_listings()
        await db.listings.insert_many([s.model_dump() for s in seed])
        logger.info("Seeded %d listings", len(seed))
    _initialized = True


async def init_dep() -> None:
    await ensure_initialized()


# ---------------- Routes ----------------
@api_router.get("/")
async def root():
    return {"message": "Immo Traeum AG API"}


@api_router.get("/health")
async def health():
    return {"ok": True, "llm": llm.is_configured()}


# ---- Listings ----
@api_router.get("/listings", response_model=List[Listing], dependencies=[Depends(init_dep)])
async def list_listings(kind: Optional[str] = None):
    q = {"kind": kind} if kind in ("rental", "reference") else {}
    docs = await db.listings.find(q, {"_id": 0}).sort("order", 1).to_list(500)
    return [Listing(**d) for d in docs]


@api_router.post("/listings", response_model=Listing, dependencies=[Depends(require_admin)])
async def create_listing(payload: ListingCreate):
    listing = Listing(**payload.model_dump())
    await db.listings.insert_one(listing.model_dump())
    return listing


@api_router.put("/listings/{listing_id}", response_model=Listing, dependencies=[Depends(require_admin)])
async def update_listing(listing_id: str, payload: ListingCreate):
    existing = await db.listings.find_one({"id": listing_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    merged = {**existing, **payload.model_dump()}
    await db.listings.update_one({"id": listing_id}, {"$set": merged})
    return Listing(**merged)


@api_router.delete("/listings/{listing_id}", dependencies=[Depends(require_admin)])
async def delete_listing(listing_id: str):
    res = await db.listings.delete_one({"id": listing_id})
    return {"deleted": res.deleted_count}


# ---- Inquiries ----
@api_router.post("/inquiries", status_code=201, dependencies=[Depends(init_dep)])
async def create_inquiry(payload: InquiryCreate, request: Request):
    await enforce_rate_limit(db, request, "inquiry")
    if payload.website:  # honeypot hit: pretend success, store nothing
        return {"ok": True}
    inq = Inquiry(**payload.model_dump(exclude={"website"}))
    await db.inquiries.insert_one(inq.model_dump())
    return {"ok": True, "id": inq.id}


@api_router.get("/inquiries", response_model=List[Inquiry], dependencies=[Depends(require_admin)])
async def list_inquiries():
    docs = await db.inquiries.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [Inquiry(**d) for d in docs]


# ---- Valuation ----
@api_router.post("/valuation", dependencies=[Depends(init_dep)])
async def valuation(inp: ValuationInput, request: Request):
    await enforce_rate_limit(db, request, "valuation")
    result = compute_valuation(inp)
    system = (
        "Du bist Immobilien-Analyst bei Immo Traeum AG. Antworte auf Deutsch (Schweizer Schreibweise mit ss). "
        "Sei seriös, knapp und diskret. Kein Marketing-Sprech. Max 3 Sätze."
    )
    prompt = (
        f"Indikative Schätzung: CHF {result['expected']:,} (Bandbreite CHF {result['min']:,} – CHF {result['max']:,}), "
        f"Region {result['region']}, {inp.property_type.upper()}, {inp.area} m², Zustand {inp.condition}/5, "
        f"Lage {inp.location_quality}/5. "
        "Erstelle einen kurzen fachlichen Kommentar für den Kunden, welche Faktoren die Bandbreite prägen."
    ).replace(",", "'")
    try:
        commentary = await llm.complete_text(system, prompt) or VALUATION_FALLBACK
    except llm.LlmUnavailable:
        commentary = VALUATION_FALLBACK
    return {**result, "commentary": commentary}


# ---- Chat (streaming SSE) ----
def _chat_messages(body: ChatBody) -> list[dict]:
    """History from the client → valid alternating user/assistant list ending with user."""
    turns = [t for t in body.history if t.content.strip()]
    while turns and turns[0].role != "user":
        turns.pop(0)
    messages: list[dict] = []
    for t in turns:
        if messages and messages[-1]["role"] == t.role:
            messages[-1]["content"] += "\n\n" + t.content
        else:
            messages.append({"role": t.role, "content": t.content})
    if messages and messages[-1]["role"] == "user":
        messages.pop()
    messages.append({"role": "user", "content": body.message})
    return messages


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@api_router.post("/chat/stream", dependencies=[Depends(init_dep)])
async def chat_stream(body: ChatBody, request: Request):
    await enforce_rate_limit(db, request, "chat")
    docs = await db.listings.find({"kind": "rental"}, {"_id": 0}).to_list(50)
    listings_info = "\n".join(
        f"- {d.get('title')} | {d.get('address')} | Status: {d.get('status')} | "
        f"Verfügbar ab: {d.get('available_from') or '—'} | Netto CHF {d.get('net_rent') or '—'}"
        for d in docs
    ) or "Aktuell keine offenen Mietobjekte hinterlegt."
    system = (
        "Du bist der digitale Berater der Immo Traeum AG. Antworte auf Deutsch (Schweizer Schreibweise mit ss). "
        "Sei diskret, präzise, persönlich – kein Marketing-Sprech. Antworte knapp (max. 4 Sätze), bei Bedarf mit "
        "nummerierten Punkten. Bei rechtlichen oder steuerlichen Detailfragen weise auf ein persönliches "
        f"Gespräch hin.\n\n{COMPANY_INFO}\n\nAktuelle Mietobjekte:\n{listings_info}\n\n"
        "Wenn der Kunde eine Bewertung wünscht, leite ihn zur Schnellbewertung im Bereich 'Bewertung'. "
        "Wenn er ein Objekt anfragt, weise auf das Anfrageformular hin."
    )
    messages = _chat_messages(body)

    async def event_generator():
        try:
            async for text in llm.stream_text(system, messages):
                yield _sse({"type": "delta", "content": text})
            yield _sse({"type": "done"})
        except llm.LlmUnavailable:
            yield _sse({"type": "error", "message": f"Im Moment nicht erreichbar. Telefon: {PHONE}"})
        except Exception:
            logger.exception("Chat stream failed")
            yield _sse({"type": "error", "message": f"Im Moment nicht erreichbar. Telefon: {PHONE}"})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---- Admin auth ----
@api_router.post("/admin/login", dependencies=[Depends(init_dep)])
async def admin_login(body: AdminLogin, request: Request, response: Response):
    await enforce_rate_limit(db, request, "login")
    if not verify_admin_password(body.password):
        raise HTTPException(status_code=401, detail="Falsches Passwort")
    issue_session(response)
    return {"ok": True}


@api_router.post("/admin/logout")
async def admin_logout(response: Response):
    clear_session(response)
    return {"ok": True}


@api_router.get("/admin/me", dependencies=[Depends(require_admin)])
async def admin_me():
    return {"ok": True}


app.include_router(api_router)

# Same-origin deployment needs no CORS. Only list extra origins explicitly (never "*").
_cors_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip() and o.strip() != "*"]
if _cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Content-Type", "X-ITM-Admin"],
    )
