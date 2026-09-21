# Immo Traeum AG — PRD

## Problem statement (original)
Baue die neue Homepage (One-Pager) für Immo Traeum AG – Schweizer/Liechtensteiner Immobilienmanagement.
Kein Login nötig, aber Admin unter `/admin` (Passwort via ENV `ADMIN_PASSWORD`). Sprache: Deutsch (Schweizer Schreibweise "ss").
Design: High-End PropTech (Niveau VistaView / cinematic). Navy #0A1428 + Champagne-Gold #C9A96E, Fraunces + Inter, Glass, Filmkorn, Vignette, Reveal-Animationen, Section-Counter "01/08".

## Architecture
- Frontend: React 18.3.1 + JSX, Tailwind, Framer Motion, React Three Fiber v8, three-stdlib OrbitControls, Lenis Smooth Scroll, shadcn/ui (sonner for toasts).
- Backend: FastAPI + Motor (async Mongo). `/api` prefix; admin protected via header `X-Admin-Password`.
- LLM: Emergent Universal Key → Anthropic `claude-sonnet-4-6` (streaming) for `/api/chat/stream` and `/api/valuation` commentary.
- Media: Higgsfield hero + reference photos converted to WebP + AVIF at 800/1600/2400 px (cwebp/avifenc). PNGs removed. Hero uses `<picture>` with fetchpriority="high".

## Personas
- Eigentümer / Erben (bewerten, Erbteilung, Willensvollstreckung)
- Mieter (Objekte, Anfrage, Relocation)
- Investoren (Beteiligungen, Whitepaper)
- Firmen (Relocation Service für Mitarbeitende)

## Implemented (Feb 2026, initial ship)
- 8 Sektionen: Hero (Ken-Burns + Gold-Parcel SVG + Labels + Stat-Leiste), Leistungen (Bento 6), Objekte (R3F Digital Twin + Live-Verfügbarkeit + Anfrage-Modal), Bewertung (3-Step Wizard + Ergebnis-Panel + LLM-Kommentar), Relocation & Erbschaften (Split), Beteiligungen (Stats + Whitepaper), Trust (SIV/Casafair + Werte + Timeline), Kontakt (Formular + Adresse).
- Floating AI-Chat (SSE Streaming, Quick-Replies, System-Prompt mit Live-Listings).
- Admin `/admin` (Passwort-Login, CRUD Mietobjekte/Referenzen, Anfragen-Liste).
- Impressum / Datenschutz Platzhalter.
- SEO Meta + OpenGraph + JSON-LD RealEstateAgent.
- Dark-Default + Light Toggle (Hero bleibt in Light-Mode dark für Cinematic-Effekt).
- prefers-reduced-motion respektiert; 3D-Viewer lazy + IntersectionObserver.
- Regression: Alle "15+ Jahre"-Erfahrungsclaims entfernt; Marktzahlen mit Quellenhinweis "Bundesamt für Statistik (gerundet)".
- Images: 4-5 MB PNGs → 51-341 KB AVIF/WebP (bis zu 90 % kleiner), Hero `<picture>` mit AVIF- und WebP-srcset.

## Verified (testing_agent iteration_1)
- Backend 19/19 pytest bestanden (Media 200er, Listings, Valuation LLM, Inquiries, Admin Auth, Chat SSE, No-15-Jahre Regression).
- Frontend: alle 8 Sektionen laden ohne Runtime-Error (R3F/drei Fix via React 18 downgrade + three-stdlib), Hero `<picture>` mit AVIF+WebP+fetchpriority, Bewertungs-Wizard komplett bis Ergebnis, Kontakt-Formular persistiert, Admin-Login funktioniert (Passwort validiert), Dark↔Light Toggle wirkt.

## Backlog (P1 / P2)
- P1: Light-Mode Feinschliff in Kontakt/Leistungen (Body-Text-Kontrast in einzelnen Glass-Karten prüfen).
- P1: R3F Digital Twin: echtes Rorschach-Ortho-Layout statt prozedural (GeoJSON-Import).
- P2: `/media/hero.mp4` optional aus Cloudflare Stream binden.
- P2: Admin-Passwort per Bcrypt-Hash + Rate-Limit auf `/api/admin/login`.
- P2: E-Mail-Weiterleitung eingehender Anfragen (Resend).
- P2: OG-Image Optimierung (dedizierte 1200×630 Version).
- P2: i18n (DE/EN/IT) für Cross-Border Kunden.

## Credentials
- Admin Passwort (env): `ADMIN_PASSWORD` in `/app/backend/.env` (24-stellig zufällig).
- LLM: `EMERGENT_LLM_KEY` in `/app/backend/.env`.
