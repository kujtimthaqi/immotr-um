"""Pydantic request/response models."""
import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

SHORT = 200
LONG = 5000
URL = 500
CHAT_MESSAGE_MAX = 2000
CHAT_HISTORY_MAX = 12


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ListingCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    kind: Literal["rental", "reference"] = "rental"
    title: str = Field(..., min_length=1, max_length=SHORT)
    address: str = Field(..., min_length=1, max_length=SHORT)
    zip: Optional[str] = Field(default=None, max_length=10)
    city: Optional[str] = Field(default=None, max_length=SHORT)
    net_rent: Optional[float] = Field(default=None, ge=0, le=1_000_000)
    utilities: Optional[float] = Field(default=None, ge=0, le=100_000)
    available_from: Optional[str] = Field(default=None, max_length=10)  # ISO date
    status: Literal["available", "reserved", "rented", "reference"] = "available"
    rooms: Optional[float] = Field(default=None, ge=0, le=100)
    area: Optional[float] = Field(default=None, ge=0, le=100_000)
    year: Optional[int] = Field(default=None, ge=1000, le=2200)
    pdf_url: Optional[str] = Field(default=None, max_length=URL)
    image_url: Optional[str] = Field(default=None, max_length=URL)
    video_url: Optional[str] = Field(default=None, max_length=URL)
    description: Optional[str] = Field(default=None, max_length=LONG)
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)
    highlight: bool = False
    order: int = 0


class Listing(ListingCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=_now)


class InquiryCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    company: Optional[str] = Field(default=None, max_length=SHORT)
    name: str = Field(..., min_length=1, max_length=SHORT)
    address: Optional[str] = Field(default=None, max_length=SHORT)
    zip_city: Optional[str] = Field(default=None, max_length=SHORT)
    phone: Optional[str] = Field(default=None, max_length=40)
    email: EmailStr
    topic: Optional[str] = Field(default=None, max_length=SHORT)
    listing_id: Optional[str] = Field(default=None, max_length=64)
    message: Optional[str] = Field(default=None, max_length=LONG)
    source: Optional[str] = Field(default="contact", max_length=32)
    # Honeypot: hidden in the UI, bots fill it.
    website: Optional[str] = Field(default=None, max_length=SHORT)


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
    created_at: str = Field(default_factory=_now)


class ValuationInput(BaseModel):
    property_type: Literal["wohnung", "efh", "mfh", "gewerbe"]
    zip: str = Field(..., max_length=10)
    city: Optional[str] = Field(default=None, max_length=SHORT)
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
    password: str = Field(..., max_length=SHORT)


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=CHAT_MESSAGE_MAX * 2)


class ChatBody(BaseModel):
    message: str = Field(..., min_length=1, max_length=CHAT_MESSAGE_MAX)
    history: List[ChatTurn] = Field(default_factory=list, max_length=CHAT_HISTORY_MAX)
