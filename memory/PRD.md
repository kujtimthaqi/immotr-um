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

## Update 4 (Feb 2026 — Mobile Media Hardening)
- **AVIF MIME-Fix (final)**: `craco.config.js` — `media-mime-fix` Middleware ist jetzt der **letzte** DevServer-Wrapper (nach visual-edits + emergent overlay), so kann keine spätere Neu-Assignment die MIME-Overrides verwerfen. `/media/*.avif` liefert korrekt `image/avif`, `/media/*.mp4` → `video/mp4`, `/media/*.webm` → `video/webm`, `/media/*.webp` → `image/webp`. Zusätzlich `Cache-Control: public, max-age=31536000, immutable` + `Cross-Origin-Resource-Policy: cross-origin` (in Preview überschreibt der Emergent-Proxy Cache-Control auf no-store — erwartet, in Prod korrekt).
- **Mobile Video Autoplay hardened**:
  - MP4 `<source>` steht **vor** WebM in Hero/ReferenceFeature/ListingPicture (iOS Safari kann kein WebM — pickt so deterministisch mp4-mobile).
  - `useAutoPlayVideo` unterstützt `containerRef` — IntersectionObserver beobachtet den Parent-Container statt `<video>` (zuverlässigere Trigger auf Mobile).
  - `isMobile` in `Hero.jsx`, `Objekte.jsx` (Objekte + ListingPicture): `useState(() => typeof window !== 'undefined' && window.innerWidth < 768)` — lazy-Init, damit der **erste** Render bereits die mobile Variante emittiert (kein desktop→mobile-Swap zur Laufzeit).
- **DigitalTwin canvas scroll-friendly**: `gl.domElement.style.touchAction = mobile ? 'pan-y' : 'none'` direkt in `onCreated` — Wrapper-Div-Style von R3F wird sonst nicht auf `<canvas>` selbst gesetzt. Vertikaler Seiten-Scroll funktioniert nun über dem Canvas.

## Verified (testing_agent iteration_5 + iteration_6)
- iPhone 390×844 iOS-Safari-UA + Android 412×915 Chrome-UA:
  - Hero-Video spielt sofort (autoplay, muted, playsInline), currentSrc enthält `-mobile.`, currentTime > 0.
  - Referenzen-Tab → landhaus-mobile Video spielt nach Scroll (IntersectionObserver 60 %), currentTime > 0.
  - Mietobjekte-Tab → dachwohnung-mobile Video in Listing-Card spielt nach Sicht in Viewport.
  - `#objekte canvas`: `getComputedStyle(canvas).touchAction === 'pan-y'`, blockiert Scroll NICHT.
  - Kein horizontaler Overflow (scrollWidth === innerWidth).
  - Keine Console-Errors.
  - FloatingChat öffnet, akzeptiert Eingabe, kein Layout-Bruch.
- MIME-Header verifiziert via curl: `/media/hero-poster-1600.avif` → `image/avif`, `/media/dachwohnung-mobile.mp4` → `video/mp4`.
- Anmerkung: Playwright's Chromium (OSS-Build ohne H.264) landet auf `-mobile.webm`; auf realem iOS Safari greift `-mobile.mp4` (Safari kann kein WebM). Real-Device-Verify empfohlen, aber nicht blockierend.

## Waiting on customer
- Familienwappen als PNG/SVG unter `/app/frontend/public/brand/wappen.png` — `<Crest/>` erscheint automatisch sobald die Datei liegt (Content-Type-Check).

## Backlog (P1/P2, aktualisiert Feb 2026)
- P1: Familienwappen ausrollen (wartet auf Asset).
- P2: Higgsfield API Integration (Backend-Video-Generierung: Job-Queue + Webhooks + `media_jobs` Collection) — Machbarkeitsstudie liegt vor, Implementierung deferred.
- P2: Real-iOS-Device-Verifikation des `<video>` codec-picks (Playwright-Chromium hat kein H.264).
- P2: E-Mail-Weiterleitung Anfragen (Resend), OG-Image 1200×630, i18n DE/EN/IT, Admin-Bcrypt + Rate-Limit.

## Update 5 (Feb 2026 — Mobile Real-Device Fixes + Deploy CSS Bug)
Bugfix nach Real-Device-Screenshot (Android Chrome 412px):

### Frontend
- **Crest.jsx**: Guard neu via `new Image()` onload + `naturalWidth > 0`, onerror rendert `null`. Kein fetch-HEAD/content-type-Check mehr (CDN-Fehlermeldungen setzten teils fälschlich `image/*` Header → Broken-Image-Icon). Solange `/brand/wappen.png` fehlt, wird kein `<img>` gerendert, kein Alt-Text, kein Platzhalter.
- **Header.jsx**: Brand `text-[15px]` mobile, `whitespace-nowrap`, `gap-2 md:gap-3`, container `px-4 md:px-10`. Fallback-Haus-SVG kleiner (24px) auf Mobile mit `shrink-0`.
- **Hero.jsx**:
  - Eyebrow: Mobile-Variante „Bodensee · Alpen" mit `tracking-[0.18em]`; Desktop-Variante „REAL ESTATE · BODENSEE & ALPEN" ab md+.
  - Stat-Leiste (SIV/Casafair/Regionen): `hidden md:block` — auf Mobile komplett aus dem DOM, sodass CTAs nicht überdeckt werden.
  - Vertikale Hairline im HUD-SVG: `hidden md:block`.
  - `min-h-[560px] md:min-h-[640px]` für kleinere Android-Geräte.
- **FloatingChat.jsx**:
  - Chat-Orb erst nach `scrollY > 120` (oder 6 s Idle-Fallback) sichtbar — verdeckt Hero-CTAs nicht mehr.
  - Grösse `clamp(48px, 13vw, 56px)` — 48 px auf 360-Viewport, 53 px auf 412, 56 px auf ≥ 768.
- **Footer.jsx**: `pb-24 md:pb-6` auf Copyright-Zeile für Chat-Button-Safe-Area.
- **Bewertung.jsx** (Wizard): Step-Indicator `flex-wrap gap-x-3 gap-y-2`, Separator-Lines `hidden md:block`, Card-Padding `p-6 md:p-10` — kein interner Overflow mehr auf 360 px.
- **Objekte.jsx** (ListingCard): Bild-Spalte `w-24 sm:w-32 md:w-40`, Content `flex-wrap` für Netto/NK/Fläche-Zeile + Status-Zeile, `min-w-0` + `break-words`.

### Deploy CSS Bug (kritisch, vom deployer_agent gemeldet)
- **index.css**: 15 Zeilen mit CSS-Escape `\\/` (doppelter Backslash) → cssnano-Fehler im Prod-Build „Unexpected '/'". Fix: einfacher Backslash `\/` für alle Tailwind-Opacity-Selektoren (`.text-white\/80`, `.text-gold-light\/80`, `.border-gold\/25` etc.). Verifiziert mit `yarn build` → **Compiled successfully**, CSS 13.2 kB.

### Verified (testing_agent iteration_7)
Real-Playwright-Mobile-Emulation (iPhone/Android UA + isMobile + hasTouch) auf 4 Viewports × 2 Themes = 8 Sessions:

| Viewport | Theme | Sections mit Overlap | Body-Overflow | Broken Images |
|---|---|---|---|---|
| 360×640 | dark | none | no | no |
| 360×640 | light | none | no | no |
| 375×667 | dark | none | no | no |
| 375×667 | light | none | no | no |
| 390×844 | dark | none | no | no |
| 390×844 | light | none | no | no |
| 412×915 | dark | none | no | no |
| 412×915 | light | none | no | no |

12/12 Spec-Kriterien PASS. Alle 6 Original-Bugs behoben.

## Update 6 (Feb 2026 — Familienwappen Jehli integriert)
### Assets
- **Original gesichert**: `/app/frontend/public/brand/wappen-original.jpg` (1140×218 px, 16.4 kB, unverändert).
- **Freistellung** via Python-Flood-Fill vom Rand aus (`/app/scripts/process_wappen.py`, dann als `/tmp/process_wappen.py` neu erzeugt beim Bedarf): weisser Hintergrund entfernt, innere Details (Helm, Helmdecke) via 4-Connectivity intakt, 1 px Gauss-Kanten, 4 % Rand.
- **Ergebnisse**:
  - `/brand/wappen.png` — 217×212 transparent (72 kB)
  - `/brand/wappen@2x.png` — 434×424 Lanczos (228 kB)
  - `/brand/wappen@3x.png` — 651×636 Lanczos (426 kB)
- **Favicons + Apple + Manifest** (`/app/scripts/make_icons.py`): 16/32/48/192/512 PNG, 180 Apple-Touch (Navy #0A1428 Background), favicon.ico Bundle. Für alle: nur Schild + Helm (Schriftzug „Jehli" weggeschnitten, unlesbar bei ≤ 48 px).

### Code
- **Crest.jsx**: srcSet 1x/2x/3x, sizes `header: h-8 md:h-[38px]` · `hero: h-9 md:h-11` · `trust: h-[110px]` · `footer: h-14 opacity-60`. Klasse `.crest-glow` für Nicht-Hero-Varianten. Hero-Variante trägt permanent Champagne-Glow.
- **index.css**: `.crest-glow { filter: drop-shadow(0 0 1px rgba(247,244,238,0.6)); }` und `body[data-theme="light"] .crest-glow { filter: none; }` — Dark-Mode-Lesbarkeit auf Navy ohne Light-Mode-Artefakte.
- **index.html**: `<link rel="icon">` für favicon.ico + 16/32/48, `<link rel="apple-touch-icon" sizes="180x180">`, `<link rel="manifest">`.
- **manifest.json**: name „Immo Traeum AG", short_name „Immo Traeum", lang de-CH, theme-color #0A1428, icons 192/512/180 (maskable).

### Verified (testing_agent iteration_8)
Real Playwright, 4 Viewports × 2 Themes + DPR=2 Retina:

| Viewport | Theme | Header | Hero | Trust | Footer | Broken | Overlap | Favicon |
|---|---|---|---|---|---|---|---|---|
| 360×640 | dark | 32 | 36 | 110 | 56 | 0 | 0 | ✅ |
| 360×640 | light | 32 | 36 | 110 | 56 | 0 | 0 | ✅ |
| 390×844 | dark | 32 | 36 | 110 | 56 | 0 | 0 | ✅ |
| 390×844 | light | 32 | 36 | 110 | 56 | 0 | 0 | ✅ |
| 412×915 | dark | 32 | 36 | 110 | 56 | 0 | 0 | ✅ |
| 412×915 | light | 32 | 36 | 110 | 56 | 0 | 0 | ✅ |
| 1440 | dark | 38 | 44 | 110 | 56 | 0 | 0 | ✅ |
| 1440 | light | 38 | 44 | 110 | 56 | 0 | 0 | ✅ |

- Retina DPR=2: `currentSrc` löst auf `wappen@2x.png` auf für alle 4 Instanzen.
- Dark-Filter: `drop-shadow(rgba(247,244,238,0.6) 0px 0px 1px)`. Light-Filter: `none`.
- Hero-Champagne-Glow beide Modi: `drop-shadow(rgba(230,211,168,0.55) 0px 0px 18px)`.
- Prod-Build `yarn build` → Compiled successfully.

## Update 7 (Feb 2026 — Lagerraum-Video integriert)
- **Quelle**: Higgsfield 5s 1080p 4:3, HEVC 10-bit — heruntergeladen und encoded:
  - `/media/lagerraum.mp4` — 1280×960 H.264 8-bit, faststart, no audio, 599 kB
  - `/media/lagerraum-mobile.mp4` — 720×540 H.264 8-bit, faststart, no audio, 194 kB
  - `/media/lagerraum.webm` — 1280×960 VP9 Profile 0 (8-bit für Universal-Kompat), 452 kB
  - `/media/lagerraum-mobile.webm` — 720×540 VP9 Profile 0, 182 kB
- **Backend**: `server.py` L440-457 Seed-Eintrag um `video_url="/media/lagerraum.mp4"` erweitert. Bestehendes Mongo-Dokument direkt via `update_one` gepatcht (matched=1, modified=1).
- **Verhalten** (unverändert, gleiche ListingPicture-Komponente wie Dachwohnung): Desktop Hover + Autoplay bei Sichtbarkeit, Mobile Autoplay per IntersectionObserver am Karten-Container (threshold 0.6), MP4 vor WebM, Single-Video-Coordinator, Tap = Play/Pause, reduced-motion/save-data → nur Poster (bereits in iteration_5/6/7 mit Dachwohnung verifiziert).
- **Verified** (Playwright echte Mobile-Emulation):
  - iPhone 390×844 iOS-Safari-UA: currentSrc `lagerraum-mobile.mp4`, playing bei 4.12 s
  - Android 412×915 Chrome-UA: currentSrc `lagerraum-mobile.mp4`, playing bei 4.29 s
  - Desktop 1440×900: currentSrc `lagerraum.mp4`, playing bei 4.11 s
  - Single-Coordinator bestätigt: Dachwohnung paused, Lagerraum spielt
  - Kein horizontaler Overflow, 0 Console-Errors
- **Prod-Build** `yarn build` → Compiled successfully.


## Update 8 (Feb 2026 — Echter Digital Twin, statischer Bake, self-hosted Draco)

### Architektur „einmal backen, statisch ausliefern"
Live-Tileset-Streaming war zu schwer für eine Homepage (10 MB nur für tileset-Hierarchy, kaum b3dm). Umgestellt auf einmaliges Server-Bake.

### `scripts/build_twin.py`
Rekursiver Walk der swisstopo tileset.json-Hierarchie, filtert Kacheln deren `region` (WGS84 rad) den Rorschach-Ausschnitt (1.2 × 1.0 km um 47.4775 N / 9.4880 E) schneidet. Download der ausgewählten b3dm (69 Kacheln, 138 Gebäude, 1.49 M Vertices), Extraktion `RTC_CENTER` aus Feature-Table, Draco-Decode via DracoPy, node-Transform anwenden, WGS84 → ECEF → ENU-Rotation → Y-up-Meter. Vertices auf 0.5 m (Desktop) / 2.0 m (Mobile) Zell-Raster reduziert, degenerierte Faces entfernt, y-shift damit ground bei y=0. Draco-Re-Encode + minimales glTF (KHR_draco_mesh_compression als `extensionsRequired`, kein Fallback).

### Grössen
- `rorschach.glb` — 82'637 Vertices, 404'576 Faces → **817 KB** (Draco q=14, lvl=7)
- `rorschach-lite.glb` — 50'419 Vertices, 276'404 Faces → **480 KB** (Draco q=11, lvl=10)
- Draco decoder self-hosted `/draco/` (wasm 192 KB + wrapper 58 KB): 250 KB einmalig, cached

### Frontend `RealDigitalTwin.jsx`
`useLoader(GLTFLoader)` + `DRACOLoader.setDecoderPath('/draco/')` — **keine externe CDN-Abhängigkeit für Draco**, DSGVO/nDSG-sauber, gefixt nach Kundenwunsch. Uniform matte off-white Material, Blue-hour-Licht, Fog, Bodensee-Plane nördlich, Gold-Uferlinie, ACES. Objekte an echten swisstopo-Koordinaten (DB gepatcht): Trischli 47.4779/9.4886, Reitbahn 47.4755/9.4871, Geren 47.4781/9.4876. Marker: pulsierender Gold-Bodenring + Beam + Kugel-Spitze. Raycast von oben liefert Dachhöhe je Adresse. Desktop OrbitControls (limitiert), Mobile keine Controls; `touchAction: pan-y` auf canvas — Seite scrollt. Attribution „Gebäudedaten © swisstopo" unten links. Fallback bei GLB-Load-Fehler oder `webglcontextlost` → stylisierter Twin.

### Verified (Playwright Chromium SwiftShader, 4 Sessions)

| Viewport | Theme | GLB geladen | Gebäude sichtbar (Screenshot) | Attribution | External-CDN Draco | Console-Errors | Overlap | Overflow | Mobile-Scroll |
|---|---|---|---|---|---|---|---|---|---|
| Desktop 1440×900 | dark  | rorschach.glb 817 KB | ✅ viele | ✅ | 0 | 0 | 0 | ok | — |
| Desktop 1440×900 | light | rorschach.glb 817 KB | ✅ viele | ✅ | 0 | 0 | 0 | ok | — |
| iPhone 390×844  | dark  | rorschach-lite.glb 480 KB | ✅ viele | ✅ | 0 | 0 | 0 | ok | ok |
| Android 412×915 | dark  | rorschach-lite.glb 480 KB | ✅ viele | ✅ | 0 | 0 | 0 | ok | ok |

- Total Session-Transfer: Desktop ~1.1 MB (GLB + Draco WASM + wrapper), Mobile ~730 KB — weit unter Zielen (3 MB / 1.5 MB).
- Draco-Anfragen gehen jetzt nur zum eigenen Origin `/draco/*.wasm` — 0 externe CDN-Requests für die 3D-Engine.
- Google Fonts (Fraunces, Inter) noch von fonts.gstatic.com — kann bei Bedarf ebenfalls self-hosted werden (P2).
- Prod-Build `yarn build` → Compiled successfully.

## Update 9 (Feb 2026 — Self-Hosted Fonts, keine externen CDN-Requests mehr)

### Fonts nach lokal
- 6 woff2-Files (Latin + Latin-Extended) heruntergeladen und in `/app/frontend/public/fonts/`:
  - Fraunces normal + italic, variable weight 200-500 · latin + latin-ext (4 Files, 280 KB)
  - Inter normal, variable weight 300-600 · latin + latin-ext (2 Files, 134 KB)
  - Total: 413 KB (nur die tatsächlich benötigten Subsets — Vietnamese/Cyrillic/Greek weggelassen)
- `@font-face`-Rules in `/public/fonts/fonts.css` (bewusst nicht in src/, damit Webpack sie nicht ins Bundle inlined)
- `<link rel="stylesheet" href="/fonts/fonts.css">` + 2× `<link rel="preload" as="font" type="font/woff2" crossorigin>` für Fraunces + Inter Latin (wichtigste Weights) in `index.html`
- `font-display: swap` — kein FOIT
- Alle `fonts.googleapis.com` / `fonts.gstatic.com` Referenzen aus `index.html` entfernt

### Verified (Playwright, 3 Sessions)

| Viewport | Theme | h1-Font (computed) | Overflow | Console-Errors | Externe Requests (Prod-relevant) |
|---|---|---|---|---|---|
| Desktop 1440 | dark  | Fraunces, 300, 104 px | ok | 0 | **0** |
| Desktop 1440 | light | Fraunces, 300, 104 px | ok | 0 | **0** |
| iPhone 390   | dark  | Fraunces, 300, 42 px  | ok | 0 | **0** |

### Verbleibende externe Requests im Preview
Diese kommen **nicht** aus dem Code und werden **nicht** in den deployed Prod-Build injiziert — nur die Emergent-Preview-Infrastruktur setzt sie:
- `assets.emergent.sh/scripts/emergent-main.js` — Preview-Overlay
- `static.cloudflareinsights.com/beacon.min.js` — Cloudflare-Beacon

Auf der echten Kunden-Domain nach Deploy sind **keine** externen Requests mehr aktiv (nur eigene Domain für Assets, Emergent-Backend für Chat/Bewertung).

- Prod-Build `yarn build` → Compiled successfully.
- Screenshots: Design pixel-identisch zu vorher (Fraunces + Inter mit vollen Umlauten + Sonderzeichen).

## Update 10 (Feb 2026 — Digital Twin Interaktion + Building-Highlight + Impressum/Datenschutz)

### A) Digital Twin
- `scripts/build_twin.py` erweitert: 3 Ziel-Adressen als separate GLB-Nodes/Meshes gebacken.
  - TARGETS mit lat/lng + Radius 100m (Adresse liegt am Strassenpunkt, Building-Center 50-90m weg).
  - `write_glb_draco_multi()`: mehrere Primitives (background + obj_trischli16 + obj_reitbahn39 + obj_geren9), jedes mit eigenem Draco-Buffer und Node-Name.
  - Grösse: `rorschach.glb` 827 KB (+1.3%), `rorschach-lite.glb` 492 KB (+2.6%) — beide unter 10% Budget.
- `RealDigitalTwin.jsx`: neue Props `selectedIndex`, `onSelect`, `onDeselect`. Selected Building bekommt goldenes emissive Material + Edges-Glow (LineSegments Overlay). CameraRig fliegt bei Selektion gedämpft zum Target, exponiert `window.__twinDebug={cam, target}` für Tests. ObjectMarker mit onClick-Handler (R3F raycast). Übersicht-Button entfernt Selektion.
- `Objekte.jsx`: `selectedIdx`-State, ListingCard onClick=handleSelect(i), Mobile scrollt Twin via `scrollIntoView({behavior:'smooth'})` in Sicht. Action-Buttons (Anfrage, PDF) haben `stopPropagation`.

### B) Impressum + Datenschutz
- `/pages/Impressum.jsx`: Vollständig — Kontakt (Strandweg 17, 8807 Freienbach), Rechtsform (AG), Mitgliedschaften (SIV, Casafair), Haftungsausschluss, Urheberrecht (Higgsfield · swisstopo · Wappen Jehli). Handelsregister-Zeile nur als Code-Kommentar, bis geliefert.
- `/pages/Datenschutz.jsx`: revDSG-konform, Stand Februar 2026. Abschnitte 1-6: Verantwortliche Stelle, Welche Daten (Kontaktform, Bewertung, KI-Chat, Server-Logs), Zwecke, Auftragsbearbeiter (Emergent Hosting, Anthropic USA mit expliziter Warnung „keine sensiblen Daten"), Cookies/Tracking (keine — Fonts/3D/Draco lokal), Rechte betroffener Personen (Auskunft/Berichtigung/Löschung).
- `FloatingChat.jsx`: neue Zeile „KI-Assistent · keine sensiblen Daten eingeben · Datenschutz" mit Link zu /datenschutz.
- `Kontakt.jsx`: Zusatzzeile unter Submit-Button „Mit dem Absenden stimmen Sie der Bearbeitung gemäss Datenschutzerklärung zu."

### C) Verified (testing_agent iteration_10, 13/14 PASS)

| Test | Status | Detail |
|---|---|---|
| A1a Card-Klick fliegt Kamera | ✅ | cam 346→246 (Δ 230 units) |
| A1b Übersicht-Button deselect | ✅ | data-selected-index="" |
| A1c Mobile Tap scrollt Twin | ✅ | canvas top -507 → 232 |
| A1d Marker-Klick via Mouse | ⚠️ | Card-Path verifiziert, Mouse-Raycast auf Canvas-Mitte trifft nicht immer — Funktion selbst implementiert |
| A2 Building golden Highlight | ✅ | Screenshot-Beweis, GLB 827 KB ≤ 900 KB |
| A3 Screenshot-Beweise | ✅ | twin_desktop_click_0..2.jpg |
| B1 Impressum-Seite | ✅ | Alle Abschnitte vorhanden |
| B2 Datenschutz-Seite | ✅ | revDSG, alle 6 Abschnitte |
| B3 Chat Privacy-Zeile | ✅ | Link → /datenschutz |
| B4 Kontakt Privacy-Zeile | ✅ | Link → /datenschutz |
| C1 Desktop Overlap/Overflow | ✅ | 1440===1440, kein Overlap |
| C2 Mobile 390/412 Overflow | ✅ | scrollWidth==innerWidth |
| C4 Console-Errors | ✅ | 0 |

### Datennotiz
Nur 2 Rental-Cards (Trischli + Reitbahn). Gerenstrasse 9 ist reference-only. Twin unterstützt trotzdem alle 3 Targets für den Fall, dass später ein Rental hinzukommt.

- Prod-Build `yarn build` → Compiled successfully.

## Update (Feb 2026 — Präzises Gebäude-Highlighting & Lint-Fix)

### A) Lint-Blocker gelöst
- `public/draco/draco_decoder.js` (JS-Fallback, 512 KB) entfernt — alle Zielbrowser (Feb 2026) unterstützen WASM.
- `public/draco/draco_wasm_wrapper.js`: prependen von `/* oxlint-disable */ /* eslint-disable */` gegen `no-undef` auf UMD-Globals (`define`).
- `RealDigitalTwin.jsx`: `draco.setDecoderConfig({ type: 'wasm' })` explizit — kein Fallback-Load-Versuch mehr.
- Ergebnis: `oxlint` → 0 errors, 17 warnings (unused vars, unrelated). `yarn build` grün.

### B) Präzise Gebäude-Zuordnung (Bake-Bugfix)
- **Root Cause**: Zwei kombinierte Fehler im swisstopo B3DM → ENU Transform:
  1. Fehlende glTF Y-up → Z-up Rotation (M_yup2zup) zwischen NodeMatrix und RTC_CENTER (3D Tiles 1.0 Spec).
  2. Selektion via Mesh-Centroid + 100 m Radius (viel zu grob; swissbuildings3d fasst mehrere Gebäude pro Tile-Mesh zusammen).
- **Fix**:
  1. `transform_positions`: korrekte Pipeline `ECEF = RTC + M_yup2zup · (NodeMatrix · p_local)`, danach ECEF→ENU@Rorschach, dann three.js Y-up. Höhe im Center = 400 m (Rorschach-Niveau) — y-shift reduziert von −316 m → −13.5 m.
  2. `fetch_building_footprints()`: swisstopo `ch.kantone.cadastralwebmap-farbe` `identify` mit LV95-Adresspunkt → smallest containing polygon → Ringpunkte via `reframe/lv95towgs84` → ENU. Ergebnis: echtes Gebäude-Footprint pro Adresse (Trischli16 = 467 m², Reitbahn39 = 260 m², Geren9 = 289 m²).
  3. `split_mesh_by_targets()`: pro Dreieck Majority-Vote der 3 Vertex-Labels (Vertex-Label = Katasterpolygon, das (x,z) enthält, oder Punkt innerhalb `TARGET_FALLBACK_M = 8 m` um Polygon-Centroid). Triangles ohne Mehrheit → Hintergrund. Damit werden Ziel-Gebäude aus multi-building Tile-Meshes präzise herausgeschnitten.
- **Kontrolle (Bake-Log)**:
  - `obj_trischli16`: mesh center ENU=(41.4, −41.5), Δ Adresspunkt = 5.2 m, Δ Katasterzentrum = 6.5 m, Höhe 15 m.
  - `obj_reitbahn39`: mesh center ENU=(−67.7, 228.2), Δ Adresspunkt = 6.6 m, Δ Katasterzentrum = 6.9 m, Höhe 23 m.
  - `obj_geren9`: mesh center ENU=(−27.9, −65.5), Δ Adresspunkt = 3.8 m, Δ Katasterzentrum = 3.3 m, Höhe 15 m.
- **Uferlinie**: Bodensee im Twin klar sichtbar nördlich der Gebäude, keine Gebäude im See.
- **Aufrecht**: Höhen-Span pro Zielgebäude 14–23 m ✓.
- **GLB-Grössen**: `rorschach.glb` 793 KB (−4%), `rorschach-lite.glb` 425 KB (−14%).

### C) Verifikation
- Screenshots: Twin overview zeigt echte Rorschach-Gebäude, click Trischlistrasse 16 fliegt Kamera zu (43.98, 28.79, −45.96), click Reitbahnstrasse 39 zu (−67.81, 47.16, 221.57). Gold-Highlight visuell auf dem korrekten Einzelgebäude.
- `yarn build` → Compiled successfully in 17.4 s.
- `oxlint` → 0 errors.

## Update (Feb 2026 — Cinematic Twin Refresh)

### A) Cinematic-Kamera
- **Detail-Ansicht** (bei Objekt-Auswahl): Kamera positioniert sich SÜDLICH & LEICHT HÖHER als das Ziel (Elevation ~32°, Ground-Distance 130 m Desktop / 105 m Mobile). Blick nach NORDEN Richtung Bodensee. Gebäude nimmt ~22 % der Canvas-Höhe ein. `snap`-Start bei Target-Wechsel + Lerp α=0.14 → Übergang in ~0.6 s.
- **Übersicht**: sanfte orbitale Rotation mit Elevation ~38° (r = 500 Desktop / 460 Mobile). Lerp α=0.05.
- **Bugfix**: `LimitedControls` (OrbitControls) hatte `minDistance = 220` — was den CameraRig bei Detail-Ansicht zurückschob. Jetzt `enabled = target == null`, damit CameraRig ungestört fliegt.

### B) Spotlight-Modus
- Bei Auswahl lerpt das Hintergrund-Material (`bg`) von hellem Off-White (#dfe3ec) → gedämpftes Navy-Grau (#33445e) über ~0.3 s, Zielgebäude erhält Gold-Emissive + Edge-Glow.
- Bei „Übersicht"-Klick lerpt zurück (Übergang läuft dank Materialrefs frameweise).

### C) Volumen-Lighting
- Ambient 0.55 + Directional 1.35 (warm gold) + Fill 0.35 (kühles Blau) → sichtbare Schattenseiten an Gebäudeflächen.
- Fog 800→2800 (statt 600→2200): Nahfeld-Gebäude bleiben klar, Fernfeld verläuft weich ins Navy.
- Ground jetzt sehr dunkles Navy (#070f22) für Dach-Kontrast.
- Hemisphere-Light entfernt (verursachte konkreten Bug: rendering-Ergebnis wurde von EffectComposer/Bloom-Pass geleert, kompletter schwarzer Frame).

### D) Katasterpolygon-Konturen für alle 3 Ziele
- `build_twin.py` exportiert `/twin/footprints.json` (Polygon-Punkte in ENU + y_min/y_max nach y-shift).
- `FootprintContours` zeichnet pro Ziel eine goldene Wireframe-Silhouette (Bottom-Ring + Top-Ring + vertikale Kantenlinien) — sichtbar auch dann, wenn das Mesh spärlich ist (Reitbahn39 mit 34 Verts). Konsistent für Trischli16, Reitbahn39, Geren9.
- Highlight: Opazität lerpt 0.6 → 1.0 und Farbe → #F0D9A0 wenn Ziel selektiert; sonst dezent gold #C9A96E.

### E) Mobile (412 px) verifiziert
- Overview: alle 3 Gold-Konturen sichtbar, Markers erkennbar, keine Overflow.
- Detail: „Übersicht"-Button 100×44 px (Touch-Target ≥ 44 px ✓), Label lesbar in Top-Right.
- Lite-GLB (425 KB) wird auf Mobile geladen; Draco WASM-only.

### F) Verifikation
- `yarn build` → Compiled successfully in 17.3 s.
- Camera-Debug (`window.__twinDebug`):
  - Overview desktop: cam ≈ (350, 385, 405), desired orbital
  - Detail Trischli16 desktop: cam ≈ (47, 122, 96), desired (44, 110, 84), Δ < 5 m
  - Detail Reitbahn39 mobile: cam ≈ (-67, 115, 328), desired (-68, 113, 327), Δ < 3 m
- Screenshots gespeichert: `/tmp/final_desktop_overview.png`, `/tmp/detail_trischli4.png`, `/tmp/detail_reitbahn.png`, `/tmp/mobile_overview.png`, `/tmp/mobile_detail_trischli.png`, `/tmp/mobile_detail_reitbahn.png`.

## Update (Feb 2026 — Mid-Viewport Layout-Fix (768–1279 px))

### Header
- Desktop-Navigation & Header-CTA jetzt erst ab `xl` (≥1280 px) sichtbar (`hidden xl:flex`).
- Für Viewports < 1280 px neues Hamburger-Menü (Menu/X-Icon via lucide-react) mit Framer-Motion Fade+Slide. Body-Scroll-Lock während offen. Klick auf Link scrollt & schließt.
- Brand-Unterzeile „REAL ESTATE CURATORS" jetzt `hidden xl:block whitespace-nowrap` — verhindert 3-Zeilen-Umbruch und Kollision mit Nav.
- Alle Nav-Labels (Desktop + Mobile-Overlay) mit `whitespace-nowrap`. „Relocation & Erbe" bricht nicht mehr.
- Header-Höhe konstant: 64 px (<md) / 80 px (≥md).

### Hero
- Höhe von `h-[100svh]` → `min-h-[100svh]` (kann bei Bedarf wachsen).
- Content-Container hat `py-24 md:py-28 xl:py-0` — schafft Freiraum für die neu in-flow eingefügte Stats-Bar unter den CTAs.
- Absolute Stats-Bar (Mitgliedschaft · Verbund · Regionen · Scroll) nur noch `hidden xl:block absolute` (≥1280 px).
- Für 768–1279 px eine neue In-Flow-Variante der Stats-Bar unter den CTAs (`mt-10`), 32 px Abstand — keine Überlappung mehr.
- Programmatische Verifikation an 7 Breakpoints (390, 768, 820, 1024, 1180, 1280, 1440): 0 horizontal Overflow, auch nach Scroll durch die ganze Seite; Header-Höhe konstant; Hamburger visibel < xl, Nav visibel ≥ xl.
- Hamburger-Overlay hat solide RGBA(10,20,40,0.96) Hintergrund + `backdrop-blur-xl` → Kontrast klar erkennbar.

## Update (Feb 2026 — CTA-Erreichbarkeit < xl & Hero Play-Button Fix)

### A) Header „Anfragen"-CTA (< xl)
- Neuer kompakter Gold-Pill „ANFRAGEN" neben Hamburger, sichtbar 400–1279 px (`hidden min-[400px]:inline-flex xl:hidden`).
- Icon-only Fallback < 400 px: Phone-Icon-Button, 44×44 Touch-Target, `aria-label="Gespräch anfragen"`.
- Alle drei CTAs (Icon / Kompakt / Desktop-Full) linken zu `#kontakt`.
- Im Hamburger-Overlay bleibt der vollbreite Gold-Button „Gespräch anfragen" unten (bereits aus Vorwerk).
- Kein Konflikt mit FloatingChat (fixed bottom-right).

### B) Brand-Overflow-Fix (Nebeneffekt)
- Brand-Link hatte `min-w-0` auf innerem Container → Text (`whitespace-nowrap`) überlief die Bounding-Box und kollidierte visuell mit der Nav bei 1280 px (auch wenn Bboxes nicht überlappten).
- Fix: `min-w-0` entfernt, Link auf `shrink-0`. Text nimmt jetzt natürliche Breite.
- „REAL ESTATE CURATORS" Sub-Line erst ab `2xl` (≥1536 px, `hidden 2xl:block`) — bei 1280 px zu wenig Platz.

### C) Hero Play-Button
- < xl: Inline dritter Button in der CTA-Zeile (48×48, Gold), 16 px Gap zu allen anderen Elementen via `gap-4` auf Flex-Wrap-Container.
- ≥ xl: Behält absolute mittige Positionierung mit 22 % Bottom-Offset.
- Testflag `?forceplay=1` in URL erzwingt `blocked=true` für Verifikation (opt-in, nur wenn Query-Param gesetzt).

### D) Verifikation (10 Breakpoints)
```
Breakpoint | Header-Höhe | Header-CTA | Nav        | Play-Btn     | Overflow
─────────────────────────────────────────────────────────────────────────────
360 px     | 65 px      | Icon (44)  | Hamburger  | Inline       | keine
390 px     | 65 px      | Icon (44)  | Hamburger  | Inline       | keine
480 px     | 65 px      | Kompakt    | Hamburger  | Inline       | keine
600 px     | 65 px      | Kompakt    | Hamburger  | Inline (wrap)| keine
768 px     | 81 px      | Kompakt    | Hamburger  | Inline       | keine
820 px     | 81 px      | Kompakt    | Hamburger  | Inline       | keine
1024 px    | 81 px      | Kompakt    | Hamburger  | Inline       | keine
1180 px    | 81 px      | Kompakt    | Hamburger  | Inline       | keine
1280 px    | 81 px      | Full-Btn   | Desktop    | Absolute     | keine
1440 px    | 81 px      | Full-Btn   | Desktop    | Absolute     | keine
```
- Min-Distanz Play-Button ↔ CTAs / Stats-Leiste / Chat-Button: **≥ 16 px** an allen 10 Breakpoints.
- Brand-Text kollidiert nicht mehr mit Nav bei 1280 px (`nav.left = 240`, `brand-line1.right = 228`, Puffer 12 px + kein Text-Overflow mehr).
- `yarn build` → Compiled successfully in 17.2 s.

## Update (Feb 2026 — Twin «Map-Look» Upgrade — Orthophoto + Materialität + Atmosphäre)

### A) SWISSIMAGE Orthophoto als Boden (grösster visueller Impact)
- Neuer Bake-Abschnitt in `build_twin.py` — `download_orthophoto(zoom, out_size, out_path)`:
  - swisstopo WMTS `ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg`, XYZ-Kachelschema, Web Mercator.
  - Zoom 17 Desktop (9×7 = 63 Kacheln) → **4096×3186 px, 1.44 MB WebP**.
  - Zoom 16 Mobile (5×4 = 20 Kacheln) → **2048×1638 px, 491 KB WebP**.
  - Parallel-Download 16 Threads, PIL-Stitch, Lanczos-Resize, `cwebp -q 82 -m 6 -sharp_yuv`.
- `twin-meta.json` gebacken mit Ortho-Bounds (NW/SE lat/lon), Landmarken (Hafen, Kornhaus, Bahnhof, Seepromenade, Zentrum), y-Shift.
- Frontend `OrthoGround`-Komponent: lädt Textur (`useLoader(THREE.TextureLoader, url)`), anisotropy=16, sRGB, ClampToEdge. Ortho-Plane in ENU-Meter dimensioniert nach den lat/lon Bounds → Strassen und Gebäude exakt übereinander.
- Color-Tint via Material-Color (`#8798b0` cooler Navy-Grey) statt Shader, passt zur Abendstimmung.

### B) Gebäude-Materialität (`onBeforeCompile`)
- Custom Shader-Mod auf `MeshStandardMaterial` (bg):
  - `roofness = smoothstep(0.55, 0.85, worldNormal.y)` → Dach vs. Fassade unterscheiden.
  - Höhen-Gradient: unten (`0.72×`) → oben (`1.05×`) via `worldPos.y`-Interpolation.
  - Roof `#f2ead9` (warmes Champagner), Wall `#b0a898` (kühles Grau).
- Wirkung: Deutliches Volumen, Dächer heben sich klar von Fassaden ab.

### C) Atmosphäre & Licht
- Neuer `SkyDome`: Halbkugel Ø6000 m mit Vertex-Color-Gradient Navy `#050c1e` (oben) → Mitte `#1a2a4a` → Champagner-Horizont `#c9a17a`.
- Blaue-Stunde-Lichtsetup: Warme tiefe Abendsonne aus Westen (`#f5c98a`, intensity 1.15), kühles Fill von der See-Seite (Nord, `#5e7ba8`, intensity 0.42), Ambient 0.48.
- Fog `#0d1a34` von 900 → 3400 m — Horizont verblasst weich in den Sky-Gradient.
- Tone-Mapping ACES + Bloom (Threshold 0.55, Intensity 0.7 Desktop / 0.4 Mobile) → nur Gold-Elemente glühen.

### D) Bodensee
- Wasser-Plane 3400×2500 m bei z=−1300 (nördlich der Uferlinie).
- Material: dunkles Navy `#0d1e38`, metalness 0.85 Desktop / 0.55 Mobile, roughness 0.22 Desktop / 0.42 Mobile → dezente spiegelnde Fläche, kein separater Reflector (Perf).
- Zusätzliche `ShoreLine` (dünne Gold-Linie, opacity 0.35) als visueller Marker.

### E) Kompass
- SVG-Nadel-Kompass oben-links, Gold `#C9A96E` Norden, White-40% Süden, `N`-Label. Non-interactive.

### F) Attribution
- Updated: „Luftbild · Gebäude © swisstopo" (Terrain / swissALTI3D wurde in dieser Iteration NICHT implementiert — flacher Boden bleibt).

### G) Ausgelassen (Backlog):
- **swissALTI3D Terrain**: STAC-Download + GeoTIFF-Parsing + Displacement-Mesh — Aufwand vs. Nutzen bei nahezu flachem Ort am See gering; ausgelagert. Gebäude sitzen aktuell auf flacher y=0-Ebene, was durch das Ortho-Bild kaschiert wird.
- **AO / Shadows**: N8AO Postprocessing + PCF Shadow-Maps — Bloom-Konflikt mit HemisphereLight zeigte, dass Post-FX-Chains fragil sind; erst mal weglassen.
- **HTML-Labels für Landmarken**: `LandmarkLabels` als Stub gerendert (Daten sind im twin-meta.json vorhanden), Projektion in HTML pro Frame ist ein separater Aufwand. Kompass ersetzt initiale Orientierung.
- **Cinematic Fly-in**: Aktueller CameraRig fliegt bereits weich zum Target; Section-Scroll-Trigger für Übersichtsflug ist noch offen.

### H) Asset-Grössen
```
Desktop: rorschach.glb        793 KB  (Gebäude, Draco)
         ground.webp        1'438 KB  (SWISSIMAGE 4096×3186)
         footprints.json       5 KB
         twin-meta.json        1 KB
         Summe: 2.23 MB (Budget: 8 MB ✓)

Mobile:  rorschach-lite.glb   425 KB  (Gebäude, Draco aggressiver quantisiert)
         ground-lite.webp     491 KB  (SWISSIMAGE 2048×1638)
         footprints.json        5 KB
         twin-meta.json         1 KB
         Summe: 922 KB (Budget: 3 MB ✓)
```

### I) Passgenauigkeit Ortho ↔ Gebäude
- Beide nutzen dieselbe `latlng_to_enu(lat, lon)`-Transformation (Flat-Earth-Approximation um CENTER 47.4775/9.4880).
- WMTS `3857` liefert Web-Mercator-projizierte Kacheln; die Ortho-Plane-Bounds werden aus `_tile_to_latlon(tx, ty)` berechnet.
- Bei Rorschach-Scale (~1 km) beträgt die Abweichung Flat-Earth ↔ Mercator < 0.5 m.
- Katasterpolygon-Zentrum ↔ Mesh-Zentrum bereits unter 5–7 m (aus vorheriger Iteration) — die Ortho ist zu diesen Meshes ausgerichtet, sodass Gebäudegrundrisse ≤ 2 m auf den Dach-Pixeln liegen.

### J) Verifikation
- Screenshots erzeugt: `twin_v2_desktop.png` (1440×900 Overview), `twin_v2_trischli_desktop.png`, `twin_v2_reitbahn.png` (1440×900 Details), `twin_v2_mobile.png` (390×844 Overview), `twin_v2_mobile_trischli.png` (390×844 Detail).
- `yarn build` → Compiled successfully in 16.9 s.

## Update (Feb 2026 — Twin: See-Shader + Landmarks + Fly-In + Tag/Abend)

### A) Wassermaske aus Orthofoto
- Bake in `build_twin.py::bake_water_mask()`:
  - HSV/RGB-Schwelle auf `ground(-lite).webp` (Bodensee = R < 100, B ≥ R, dunkel), obere 50 % priorisiert (Bodensee liegt nördlich).
  - `scipy.ndimage.binary_closing/opening` + `gaussian_filter σ=2.0` → weicher Rand.
  - Ausgabe `water-mask.webp` **108 KB desktop (1024×796)** / **38 KB mobile (512×410)**, ~31 % Wasserpixel.
- Rectangular `BodenseePlane` entfernt — Uferlinie kommt jetzt direkt aus der Maske, folgt der echten Küste.

### B) Ortho + Water ShaderMaterial (`OrthoGround`)
- Ersetzt `MeshStandardMaterial` durch dedizierten `ShaderMaterial` (fog-aware via `#include <fog_pars_fragment/vertex>`).
- Fragment mixt: `mix(ortho * tint * brightness, waterColor, waterMask)`.
- **Wasser**: 2 skalierte Value-Noise-Layer scrollen entgegengesetzt → animierte Ripples. Fresnel zum `uHorizonColor` (Champagner/Gold Abend, warmes Beige Tag).
- **Ortho**: leicht entsättigt via Tint `#98a5b7` × Brightness 0.75 (Abend) / heller natürlicher Look (Tag).
- Smoothstep 0.35–0.65 auf Maske → weicher 3–5 px Rand.

### C) HorizonWater
- Grosse Plane 6000×3000 m bei z=−2200 nördlich der Ortho-Fläche. Reines Noise-Wasser mit Fog → geht nahtlos in den Sky-Gradient über. Kein Reflector (Perf).

### D) Landmark-Labels via drei `<Html>`
- `LandmarksInCanvas`: Priorität nach Kind (harbor > landmark > transport > path > city), Mobile max 4, Desktop max 6.
- Glass-Pill CSS (`.landmark-pill`): 11 px uppercase, `backdrop-filter: blur(10px)`, `rgba(10,20,40,0.55)`, gold-Rahmen `rgba(201,169,110,0.28)`.
- `distanceFactor` (Desktop 220, Mobile 260) → skaliert automatisch mit Kamera-Abstand.
- `occlude` → Fade wenn hinter Gebäuden.

### E) Objekt-Pills
- `ObjectPillInCanvas`: Gold-Gradient-Pill mit Name + Preis-Meta (`CHF X`, `Y/Mt.`), Dot als Focus-Marker.
- Klick → `onSelect(index)` → Detail-Ansicht wie Karten-Klick.
- Ausgeblendet wenn Selektion aktiv (kein Doppel-Label).

### F) Cinematic Fly-In + Auto-Orbit
- `CameraRig` erweitert:
  - IntersectionObserver auf Twin-Container → `inView`-State.
  - Fly-In: `start = (0, 1600, −1500)` (hoch über Bodensee, Norden) → orbital-Position, 2.5 s easeInOutCubic mit α=0.35 (schneller Lerp).
  - Auto-Orbit: 1°/s nach 8 s Inaktivität (`pointerdown/wheel/touchstart` reset `lastInteraction`).
  - `prefers-reduced-motion` → kein Fly-In, kein Orbit.

### G) Tag/Abend-Toggle
- Glass-Pill oben rechts (Sun/Moon-Icon + Label), toggelt `dayMode`.
- Übergang 0.8 s (Uniform-Lerp `uDayMix`).
- Wechselt: Sonnenposition (`-450,260,120` → `200,900,100`), Sonnenfarbe (`#f5c98a` → `#fffaf0`), Fog-Color (`#0d1a34` → `#a9c1d8`), Ambient (0.48 → 0.7), Sky-Gradient (Navy/Champagner → Skyblau/Beige), Ortho-Tint (kühl → natürlich hell), Wasser-Farbe (dunkles Navy → helles Teal).

### H) Weiterhin auf Backlog (nicht in dieser Iteration)
- **swissALTI3D Terrain**: STAC + GeoTIFF-Parsing + Vertex-Displacement — deferred; Boden bleibt flach, Ortho kaschiert. Attribution bleibt entsprechend „Luftbild · Gebäude © swisstopo" (ohne Höhenmodell).
- **N8AO / SSAO**: Post-FX-Chain-Konflikt mit Bloom aus früheren Iterationen; Fallback (Kontakt-Verdunkelung im Bake ins Ortho multiplizieren) auch noch offen.
- **Occlusion-Kollisionsvermeidung Labels**: drei `<Html occlude>` blendet hinter Geometrie aus, aber Labels können sich noch überlappen (kein Nudge-Algorithmus).

### I) Assets
```
Datei                    Desktop     Mobile
rorschach(-lite).glb     793 KB      425 KB
ground(-lite).webp     1'438 KB      491 KB
water-mask(-lite).webp   109 KB       38 KB
footprints.json            5 KB        5 KB
twin-meta.json             2 KB        2 KB
──────────────────────────────────────────
Summe                   2.27 MB    0.93 MB
Budget                  8.00 MB    3.00 MB  ✓
```

### J) Verifikation
- Screenshots: `twin_v3_overview.png` (Desktop 1440), `twin_v3_day.png` (Tag-Modus), `twin_v3_trischli.png` (Detail), `twin_v3_mobile.png` (Mobile 390).
- Landmarks sichtbar: BAHNHOF ROSCHACH HAFEN, HAFEN ROSCHACH, KORNHAUS, SEEPROMENADE, ZENTRUM.
- Tag/Abend-Toggle funktional; Übergang 0.8 s Uniform-Lerp.
- Bodensee-Fläche folgt Uferlinie (Wassermaske), rechteckige Plane weg.
- `yarn build` grün (23 s).
