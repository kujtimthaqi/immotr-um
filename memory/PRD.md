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
