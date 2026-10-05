# Immo Traeum AG — Website

One-Pager für Immo Traeum AG (Immobilienmanagement Ostschweiz · Zentralschweiz · Liechtenstein).
Entwicklung und Betrieb laufen über Claude Code (vorher Emergent).

## Architektur

| Teil | Technik | Ort |
|---|---|---|
| Frontend | React 18 (CRA + craco), Tailwind, Framer Motion, React Three Fiber | `frontend/` |
| API | FastAPI (Vercel Python Function unter `/api`) | `backend/`, Einstieg `api/index.py` |
| Datenbank | MongoDB (Atlas) | `MONGO_URL` |
| KI | Anthropic Claude (Chat + Bewertungskommentar) | `backend/llm.py` |
| Hosting | Vercel, Frontend + API auf derselben Domain | `vercel.json` |

## Umgebungsvariablen (Vercel → Project → Settings → Environment Variables)

| Variable | Pflicht | Zweck |
|---|---|---|
| `MONGO_URL` | ja | MongoDB-Connection-String |
| `DB_NAME` | nein | Default `immo_traeum` |
| `ANTHROPIC_API_KEY` | für Chat/KI-Kommentar | ohne Key: Chat meldet „nicht erreichbar", Bewertung nutzt Standardtext |
| `ANTHROPIC_MODEL` | nein | Default `claude-opus-5-5` |
| `ADMIN_PASSWORD` | für `/admin` | mind. 12 Zeichen |
| `ADMIN_SESSION_SECRET` | für `/admin` | mind. 32 zufällige Zeichen (signiert das Sitzungs-Cookie) |
| `CORS_ORIGINS` | nein | nur nötig, wenn die API von einer anderen Domain aufgerufen wird |

## Sicherheit

- Admin-Login setzt ein HttpOnly/Secure/SameSite=Strict-Cookie (8 h); Schreibzugriffe brauchen zusätzlich `X-ITM-Admin: 1`.
- Rate-Limits (Mongo, TTL): Login 5/15 min, Anfragen 5/h, Chat 30/h, Bewertung 20/h pro IP.
- Honeypot-Feld in Anfrageformularen, Längenlimits auf allen Eingaben.
- Security-Header inkl. CSP in `vercel.json`, keine externen Skripte/CDNs.

## Lokal entwickeln

```bash
# Backend
python -m venv .venv && .venv/Scripts/pip install -r backend/requirements-dev.txt
cd backend && ../.venv/Scripts/uvicorn server:app --port 8001   # braucht backend/.env mit MONGO_URL etc.
../.venv/Scripts/python -m pytest                                # Tests (In-Memory-Mongo)

# Frontend (proxied /api → :8001)
cd frontend && yarn install && yarn start
```

Für lokale HTTP-Entwicklung `COOKIE_INSECURE=1` in `backend/.env` setzen, sonst wird das Admin-Cookie nicht gespeichert.
