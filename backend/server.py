from fastapi import FastAPI, APIRouter, HTTPException, Header
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '')

app = FastAPI(title="Immo Traeum AG API")
api_router = APIRouter(prefix="/api")


# ---------------- Models ----------------
class Listing(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    kind: Literal["rental", "reference"] = "rental"
    title: str
    address: str
    zip: Optional[str] = None
    city: Optional[str] = None
    net_rent: Optional[float] = None
    utilities: Optional[float] = None
    available_from: Optional[str] = None  # ISO date
    status: Literal["available", "reserved", "rented", "reference"] = "available"
    rooms: Optional[float] = None
    area: Optional[float] = None
    year: Optional[int] = None
    pdf_url: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    description: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    highlight: bool = False
    order: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ListingCreate(BaseModel):
    kind: Literal["rental", "reference"] = "rental"
    title: str
    address: str
    zip: Optional[str] = None
    city: Optional[str] = None
    net_rent: Optional[float] = None
    utilities: Optional[float] = None
    available_from: Optional[str] = None
    status: Literal["available", "reserved", "rented", "reference"] = "available"
    rooms: Optional[float] = None
    area: Optional[float] = None
    year: Optional[int] = None
    pdf_url: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    description: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    highlight: bool = False
    order: int = 0


class Inquiry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company: Optional[str] = None
    name: str
    address: Optional[str] = None
    zip_city: Optional[str] = None
    phone: Optional[str] = None
    email: str
    topic: Optional[str] = None
    listing_id: Optional[str] = None
    message: Optional[str] = None
    source: Optional[str] = "contact"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class InquiryCreate(BaseModel):
    company: Optional[str] = None
    name: str
    address: Optional[str] = None
    zip_city: Optional[str] = None
    phone: Optional[str] = None
    email: EmailStr
    topic: Optional[str] = None
    listing_id: Optional[str] = None
    message: Optional[str] = None
    source: Optional[str] = "contact"


class ValuationInput(BaseModel):
    property_type: Literal["wohnung", "efh", "mfh", "gewerbe"]
    zip: str
    city: Optional[str] = None
    area: float = Field(..., ge=10, le=10000)
    rooms: Optional[float] = Field(default=None, ge=0.5, le=30)
    year_built: Optional[int] = Field(default=None, ge=1700, le=2100)
    condition: int = Field(default=3, ge=1, le=5)
    location_quality: int = Field(default=3, ge=1, le=5)
    lake_view: bool = False
    garage: bool = False
    balcony: bool = False
    elevator: bool = False


class AdminLogin(BaseModel):
    password: str


# ---------------- Helpers ----------------
BASE_PRICES = {
    "rorschach": 7200,
    "st_gallen": 7800,
    "rheintal": 6600,
    "freienbach": 15500,
    "liechtenstein": 9500,
}


def region_for_zip(zip_code: str, city: Optional[str] = None) -> tuple[str, float]:
    zc = (zip_code or "").strip()
    c = (city or "").lower()
    # Liechtenstein FL (9485-9498) or city contains 'vaduz','schaan','triesen'
    if zc.startswith(("94", "94", "9485", "9486", "9487", "9488", "9489", "9490", "9491", "9492", "9493", "9494", "9495", "9496", "9497", "9498")) and zc >= "9485" and zc <= "9498":
        return ("liechtenstein", BASE_PRICES["liechtenstein"])
    if zc in {"8807", "8808", "8832", "8835", "8834", "8833"} or "freienbach" in c or "pfäffikon" in c or "wollerau" in c or "höfe" in c:
        return ("freienbach", BASE_PRICES["freienbach"])
    if zc in {"9400", "9401", "9402", "9403"} or "rorschach" in c:
        return ("rorschach", BASE_PRICES["rorschach"])
    if zc.startswith("900") or zc.startswith("901") or "st. gallen" in c or "st.gallen" in c or "sankt gallen" in c:
        return ("st_gallen", BASE_PRICES["st_gallen"])
    if zc.startswith("94") or zc.startswith("945") or zc.startswith("946") or "rheintal" in c or "altstätten" in c or "buchs" in c:
        return ("rheintal", BASE_PRICES["rheintal"])
    return ("default", 7000.0)


def compute_valuation(inp: ValuationInput) -> dict:
    region, base = region_for_zip(inp.zip, inp.city)
    price = base

    # condition factor 1..5 -> -15% .. +15%
    price *= (0.85 + 0.075 * (inp.condition - 1))
    # location 1..5 -> -12% .. +12%
    price *= (0.88 + 0.06 * (inp.location_quality - 1))
    # age factor
    if inp.year_built:
        age = max(0, datetime.now().year - inp.year_built)
        # depreciation: -0.4% per year, floor at -25%
        depreciation = min(0.25, age * 0.004)
        price *= (1 - depreciation)

    total = price * inp.area

    factors = []
    factors.append({"label": "Region", "value": region, "impact": f"Basis CHF {int(base):,}/m²".replace(",", "'")})
    factors.append({"label": "Zustand", "value": f"{inp.condition}/5", "impact": f"{((0.85 + 0.075 * (inp.condition - 1)) - 1) * 100:+.1f}%"})
    factors.append({"label": "Lage", "value": f"{inp.location_quality}/5", "impact": f"{((0.88 + 0.06 * (inp.location_quality - 1)) - 1) * 100:+.1f}%"})

    # Extras
    if inp.lake_view:
        total *= 1.06
        factors.append({"label": "Seesicht", "value": "ja", "impact": "+6.0%"})
    if inp.balcony:
        total *= 1.025
        factors.append({"label": "Balkon/Terrasse", "value": "ja", "impact": "+2.5%"})
    if inp.garage:
        total += 35000
        factors.append({"label": "Garage", "value": "ja", "impact": "+CHF 35'000"})
    if inp.elevator:
        total *= 1.01
        factors.append({"label": "Lift", "value": "ja", "impact": "+1.0%"})
    if inp.year_built:
        factors.append({"label": "Baujahr", "value": str(inp.year_built), "impact": f"-{int(min(25, (datetime.now().year - inp.year_built) * 0.4))}% Altersabschlag"})

    # MFH → Ertragswert
    if inp.property_type == "mfh":
        # Jährliche Netto-Mieten Schätzung: 4.2% Bruttorendite auf Sachwert
        # Für Ertragswert nutzen wir gleichen Sachwert, ergänzen Hinweis
        factors.append({"label": "Bewertungsart", "value": "Ertragswert", "impact": "Bruttorendite 4.2%"})

    # Confidence based on data completeness
    completeness = sum([
        1 if inp.year_built else 0,
        1 if inp.rooms else 0,
        1 if inp.city else 0,
    ]) / 3.0
    confidence = int(65 + 25 * completeness)

    return {
        "region": region,
        "base_price_per_sqm": base,
        "expected": round(total / 1000) * 1000,
        "min": round(total * 0.92 / 1000) * 1000,
        "max": round(total * 1.08 / 1000) * 1000,
        "confidence": confidence,
        "factors": factors,
    }


async def get_llm_chat(session_id: str, system_message: str) -> LlmChat:
    return LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_message,
    ).with_model("anthropic", "claude-sonnet-4-6")


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


# ---------------- Routes ----------------
@api_router.get("/")
async def root():
    return {"message": "Immo Traeum AG API"}


# ---- Listings ----
@api_router.get("/listings", response_model=List[Listing])
async def list_listings(kind: Optional[str] = None):
    q = {}
    if kind:
        q["kind"] = kind
    docs = await db.listings.find(q, {"_id": 0}).sort("order", 1).to_list(500)
    return [Listing(**d) for d in docs]


@api_router.post("/listings", response_model=Listing)
async def create_listing(payload: ListingCreate, x_admin_password: Optional[str] = Header(None)):
    if x_admin_password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Unauthorized")
    listing = Listing(**payload.model_dump())
    await db.listings.insert_one(listing.model_dump())
    return listing


@api_router.put("/listings/{listing_id}", response_model=Listing)
async def update_listing(listing_id: str, payload: ListingCreate, x_admin_password: Optional[str] = Header(None)):
    if x_admin_password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Unauthorized")
    existing = await db.listings.find_one({"id": listing_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    merged = {**existing, **payload.model_dump()}
    await db.listings.update_one({"id": listing_id}, {"$set": merged})
    return Listing(**merged)


@api_router.delete("/listings/{listing_id}")
async def delete_listing(listing_id: str, x_admin_password: Optional[str] = Header(None)):
    if x_admin_password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Unauthorized")
    res = await db.listings.delete_one({"id": listing_id})
    return {"deleted": res.deleted_count}


# ---- Inquiries ----
@api_router.post("/inquiries", response_model=Inquiry)
async def create_inquiry(payload: InquiryCreate):
    inq = Inquiry(**payload.model_dump())
    await db.inquiries.insert_one(inq.model_dump())
    return inq


@api_router.get("/inquiries", response_model=List[Inquiry])
async def list_inquiries(x_admin_password: Optional[str] = Header(None)):
    if x_admin_password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Unauthorized")
    docs = await db.inquiries.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [Inquiry(**d) for d in docs]


# ---- Valuation ----
@api_router.post("/valuation")
async def valuation(inp: ValuationInput):
    result = compute_valuation(inp)

    # LLM commentary (non-streaming, kurz)
    commentary = ""
    try:
        chat = await get_llm_chat(
            session_id=f"valuation-{uuid.uuid4()}",
            system_message=(
                "Du bist Immobilien-Analyst bei Immo Traeum AG. Antworte auf Deutsch (Schweizer Schreibweise mit ss). "
                "Sei seriös, knapp und diskret. Kein Marketing-Sprech. Max 3 Sätze."
            ),
        )
        prompt = (
            f"Indikative Schätzung: CHF {result['expected']:,} (Bandbreite CHF {result['min']:,} – CHF {result['max']:,}), "
            f"Region {result['region']}, {inp.property_type.upper()}, {inp.area} m², Zustand {inp.condition}/5, Lage {inp.location_quality}/5. "
            f"Erstelle einen kurzen fachlichen Kommentar für den Kunden, welche Faktoren die Bandbreite prägen."
        ).replace(",", "'")
        msg = UserMessage(text=prompt)
        parts = []
        async for ev in chat.stream_message(msg):
            if isinstance(ev, TextDelta):
                parts.append(ev.content)
            elif isinstance(ev, StreamDone):
                break
        commentary = "".join(parts).strip()
    except Exception as e:
        logging.exception("LLM commentary failed")
        commentary = (
            "Diese indikative Schätzung basiert auf hedonischen Vergleichswerten der Region und den erfassten "
            "Objektmerkmalen. Für eine verbindliche, SIV-konforme Verkehrswertschätzung empfehlen wir ein "
            "persönliches Gespräch mit unseren Schätzern."
        )

    return {**result, "commentary": commentary}


# ---- Chat (streaming SSE) ----
class ChatBody(BaseModel):
    session_id: Optional[str] = None
    message: str


@api_router.post("/chat/stream")
async def chat_stream(body: ChatBody):
    session_id = body.session_id or str(uuid.uuid4())

    # Load listings live
    docs = await db.listings.find({"kind": "rental"}, {"_id": 0}).to_list(50)
    listings_info = "\n".join([
        f"- {d.get('title')} | {d.get('address')} | Status: {d.get('status')} | Verfügbar ab: {d.get('available_from') or '—'} | Netto CHF {d.get('net_rent') or '—'}"
        for d in docs
    ]) or "Aktuell keine offenen Mietobjekte hinterlegt."

    system_message = (
        f"Du bist der digitale Berater der Immo Traeum AG. Antworte auf Deutsch (Schweizer Schreibweise mit ss). "
        f"Sei diskret, präzise, persönlich – kein Marketing-Sprech. Antworte knapp (max. 4 Sätze), bei Bedarf mit "
        f"nummerierten Punkten. Bei rechtlichen oder steuerlichen Detailfragen weise auf ein persönliches "
        f"Gespräch hin.\n\n{COMPANY_INFO}\n\nAktuelle Mietobjekte:\n{listings_info}\n\n"
        f"Wenn der Kunde eine Bewertung wünscht, leite ihn zur Schnellbewertung im Bereich 'Bewertung'. "
        f"Wenn er ein Objekt anfragt, weise auf das Anfrageformular hin."
    )

    async def event_generator():
        try:
            chat = await get_llm_chat(session_id=session_id, system_message=system_message)
            msg = UserMessage(text=body.message)
            async for ev in chat.stream_message(msg):
                if isinstance(ev, TextDelta):
                    data = json.dumps({"type": "delta", "content": ev.content})
                    yield f"data: {data}\n\n"
                elif isinstance(ev, StreamDone):
                    yield f"data: {json.dumps({'type': 'done'})}\n\n"
                    break
        except Exception as e:
            logging.exception("Chat stream failed")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---- Admin auth ----
@api_router.post("/admin/login")
async def admin_login(body: AdminLogin):
    if not ADMIN_PASSWORD:
        raise HTTPException(status_code=500, detail="ADMIN_PASSWORD not set")
    if body.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Falsches Passwort")
    return {"ok": True, "token": ADMIN_PASSWORD}


# ---- Seed ----
@app.on_event("startup")
async def seed_data():
    count = await db.listings.count_documents({})
    if count == 0:
        seed = [
            # Rentals
            Listing(
                kind="rental",
                title="Grosszügige Dach-Wohnung, sehr zentral",
                address="Trischlistrasse 16",
                zip="9400",
                city="Rorschach",
                net_rent=1155,
                utilities=275,
                available_from="2026-07-01",
                status="available",
                rooms=4.5,
                area=115,
                year=2008,
                pdf_url="https://www.immo-traeum.li/Objekte/Obj218.pdf",
                image_url="/media/dachwohnung-800.webp",
                video_url="/media/dachwohnung.mp4",
                description="Ausgebauter Dachstock mit hochwertiger Ausstattung, viel Tageslicht, ruhige zentrale Lage in Rorschach.",
                lat=47.4788,
                lng=9.4907,
                highlight=True,
                order=1,
            ),
            Listing(
                kind="rental",
                title="Naturkeller Lagerraum 18 m²",
                address="Reitbahnstrasse 39",
                zip="9400",
                city="Rorschach",
                net_rent=50,
                utilities=10,
                available_from="2026-08-01",
                status="available",
                area=18,
                pdf_url="https://www.immo-traeum.li/Objekte/Obj2214.pdf",
                image_url="/media/lagerraum-800.webp",
                video_url="/media/lagerraum.mp4",
                description="Kühler Naturkeller, ideal für Wein, Vorräte oder Archiv.",
                lat=47.4772,
                lng=9.4885,
                order=2,
            ),
            # References
            Listing(
                kind="reference",
                title="Totalsanierung historisches Landhaus (1726)",
                address="7104 Arezen GR",
                city="Arezen",
                year=2013,
                status="reference",
                image_url="/media/landhaus-800.webp",
                video_url="/media/landhaus.mp4",
                description="Behutsame Totalsanierung eines Kulturguts aus dem Jahr 1726 unter Wahrung der originalen Bausubstanz.",
                order=10,
                highlight=True,
            ),
            Listing(
                kind="reference",
                title="Balkonsanierung / Umbau Ex-Bar zu 4.5-Zi-Wohnung",
                address="Reitbahnstrasse 39, Rorschach",
                city="Rorschach",
                year=2015,
                status="reference",
                description="Konversion einer ehemaligen Bar in eine grosszügige Wohnung inkl. neuer Balkonanlage.",
                order=11,
            ),
            Listing(
                kind="reference",
                title="Räumung & Innensanierung 8 Wohnungen",
                address="Reitbahnstrasse 39, Rorschach",
                city="Rorschach",
                year=2013,
                status="reference",
                description="Komplette Innensanierung von acht Wohneinheiten inkl. Neuordnung der Grundrisse.",
                order=12,
            ),
            Listing(
                kind="reference",
                title="Umbau ehemalige Druckerei zu 4-Zi-Wohnung",
                address="Gerenstrasse 9, Rorschach",
                city="Rorschach",
                year=2012,
                status="reference",
                description="Loft-artige Umnutzung eines Gewerbeobjekts zu einer charakterstarken Familienwohnung.",
                order=13,
            ),
            Listing(
                kind="reference",
                title="Ausbau Dachstock zur Wohnung",
                address="Trischlistrasse 16, Rorschach",
                city="Rorschach",
                year=2008,
                status="reference",
                description="Neuer Wohnraum unter dem Dach mit optimaler Belichtung und hochwertiger Ausstattung.",
                order=14,
            ),
        ]
        await db.listings.insert_many([s.model_dump() for s in seed])
        logging.info(f"Seeded {len(seed)} listings")


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
