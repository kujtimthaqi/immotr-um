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

## Update (Feb 2026 — Higgsfield Pro assets)
- New assets in `/app/frontend/public/media/`:
  - `hero.mp4` (1.7 MB) + `hero.webm` (1.3 MB) — 10 s aerial drone push-in with gold parcel
  - `hero-poster-{800,1600}.{webp,avif}` — first-frame poster, LCP target
  - `dachwohnung.mp4` (679 KB) + `dachwohnung.webm` (508 KB) — 5 s interior flythrough
  - `dachwohnung-{800,1600}.{webp,avif}` — interior still
  - `landhaus-{800,1600}.{webp,avif}` — reference Arezen
  - `lagerraum-{800,1600}.{webp,avif}` — vault cellar
  - `relocation-{800,1600}.{webp,avif}` — key + lake view (4:5)
  - `erbe-{800,1600}.{webp,avif}` — desk with family album (4:5)
  - `invest-{800,1600}.{webp,avif}` — white architecture model with gold lines
- Hero.jsx: `<picture>` poster with `fetchpriority="high"` + AVIF/WebP srcset; video crossfades in on `canplay`, only when viewport ≥ 768 px, no reduced-motion, tab visible. Ken-Burns downgraded to subtle (5 %). SVG parcel replaced with corner brackets + vertical hairline + animated scan line (avoids collision with gold parcel already burned into the video).
- Objekte / ListingPicture: hover triggers `dachwohnung.webm/mp4` crossfade; card thumbnail width upsized to 32/40 (128/160 px).
- Relocation.jsx: split cards get parallax background images with navy bottom-gradient + gold hairlines in `mix-blend-screen`.
- Beteiligungen.jsx: `invest-1600` visual (16:7) with gold-glow border above the stats grid.
- Backend Listing model gained `video_url` field. Seed: Dachwohnung `video_url=/media/dachwohnung.mp4`; Lagerraum `image_url=/media/lagerraum-800.webp`.

## Update 3 (Feb 2026 — 2k/4k asset upscale + landhaus video + Crest scaffolding)
- All PNGs replaced with higher-res upscales. WebP+AVIF now at **800/1600/2400** widths; hero-poster additionally at **3200**.
- New `landhaus.mp4` (1.6 MB) + `landhaus.webm` (1.6 MB), 10 s Drohnen-Orbit, 1280 wide, faststart, no audio.
- Backend Listing seed: Landhaus Arezen now has `video_url=/media/landhaus.mp4` + `highlight=true`.
- Objekte:
  - Neuer **Referenz-Feature-Karte** oberhalb des Grids: 4:3, Poster+Video (autoplay muted loop), lazy per IntersectionObserver, mobile/reduced-motion nur Poster.
  - Im 3D-Viewer: wenn Arezen in der rechten Liste gehovered wird (`hoverIdx = -1`, ausserhalb Rorschach), erscheint statt Kamerafahrt ein Glass-Overlay mit dem Landhaus-Video.
  - `ListingPicture` srcset erweitert um 2400w.
- Hero-Poster srcset erweitert um 2400w und 3200w (AVIF + WebP).
- **Crest-Komponente vorbereitet** (`/app/frontend/src/components/Crest.jsx`): lädt `/brand/wappen.png` nur wenn Datei existiert UND Content-Type mit `image/` beginnt (SPA-Catch-All-safe). Positioniert in Header (32-36 px, mit Fallback-Haus-Icon wenn Crest fehlt), Hero (44 px, Champagne-Glow), Trust (84-120 px + "Immo Traeum AG" Siegeltext), Footer (56 px @ 60 % Deckkraft). Aktuell alle unsichtbar — sobald der Kunde `wappen.png` liefert, erscheinen sie automatisch. Favicon/Apple-Icon werden ebenfalls erst getauscht, wenn die Datei da ist.

## Waiting on customer
- Familienwappen als PNG/SVG (die alte Homepage hatte keins — nur einen Wortmarken-GIF, kein heraldischer Schild).
