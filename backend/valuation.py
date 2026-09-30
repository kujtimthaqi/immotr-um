"""Indicative hedonic valuation (no LLM)."""
from datetime import datetime
from typing import Optional

from models import ValuationInput


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
