import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getListings, createInquiry } from "@/lib/api";
import { SectionHeader } from "@/components/sections/Leistungen";
import { toast } from "sonner";

const DigitalTwin = lazy(() => import("@/components/DigitalTwin"));

const STATUS = {
  available: { label: "Verfügbar", cls: "" },
  reserved: { label: "Reserviert", cls: "reserved" },
  rented: { label: "Vermietet", cls: "rented" },
  reference: { label: "Referenz", cls: "reserved" },
};

function money(n) {
  if (n == null) return "—";
  return `CHF ${Number(n).toLocaleString("de-CH")}`;
}
function dateSwiss(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function Objekte() {
  const [tab, setTab] = useState("rental");
  const [listings, setListings] = useState([]);
  const [hoverIdx, setHoverIdx] = useState(null);
  const [inquiryFor, setInquiryFor] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const twinRef = useRef(null);
  const [showTwin, setShowTwin] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await getListings();
        if (mounted) setListings(data);
      } catch (e) { /* noop */ }
    };
    load();
    const t = setInterval(load, 30000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  useEffect(() => {
    if (!twinRef.current) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) setShowTwin(true); });
    }, { threshold: 0.1 });
    obs.observe(twinRef.current);
    return () => obs.disconnect();
  }, []);

  const filtered = listings.filter(l => l.kind === tab);
  const featureRef = filtered.find(l => l.kind === "reference" && l.video_url);
  const restFiltered = tab === "reference" && featureRef ? filtered.filter(l => l.id !== featureRef.id) : filtered;
  const arezenActive = tab === "reference" && featureRef && hoverIdx === -1;

  return (
    <section id="objekte" data-testid="objekte-section" className="relative py-24 md:py-40 bg-navy-2/40 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10">
        <SectionHeader index="02" total="08" eyebrow="Objekte" title="Rorschach · Digital Twin." subtitle="Live-Verfügbarkeit, kuratiertes Portfolio. Klick auf ein Objekt zoomt die Kamera dorthin." />

        <div className="mt-10 flex items-center gap-2">
          {[
            { id: "rental", label: "Mietobjekte" },
            { id: "reference", label: "Referenzen" },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setHoverIdx(null); }}
              data-testid={`objekte-tab-${t.id}`}
              className={`h-10 px-5 rounded-full text-[12px] uppercase tracking-[0.16em] border transition-colors ${
                tab === t.id
                  ? "bg-gold text-navy border-gold"
                  : "bg-transparent text-white/70 border-gold/30 hover:text-gold-light hover:border-gold/60"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Reference feature card (Landhaus Arezen) */}
        {tab === "reference" && featureRef && (
          <ReferenceFeature listing={featureRef} isMobile={isMobile} />
        )}

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div ref={twinRef} className="lg:col-span-7 h-[380px] md:h-[520px] rounded-2xl overflow-hidden glass relative">
            {showTwin ? (
              <Suspense fallback={<TwinFallback />}>
                <DigitalTwin highlightIndex={hoverIdx} listings={restFiltered} mobile={isMobile} />
              </Suspense>
            ) : <TwinFallback />}

            {/* Arezen video overlay (glass card over canvas) */}
            <AnimatePresence>
              {arezenActive && featureRef && (
                <motion.div
                  key="arezen-overlay"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="absolute inset-4 md:inset-6 rounded-xl overflow-hidden glass-strong border border-gold/40 gold-glow"
                >
                  <ArezenOverlayVideo listing={featureRef} isMobile={isMobile}/>
                  <div className="absolute top-3 left-3 glass px-3 py-1.5 rounded-full text-[10px] uppercase tracking-[0.28em] text-gold-light">
                    Arezen GR · 7104 · nicht in Rorschach
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
              <div className="glass px-3 py-1.5 rounded-full text-[10px] uppercase tracking-[0.28em] text-gold-light">
                Digital Twin · Rorschach
              </div>
              <div className="glass px-3 py-1.5 rounded-full text-[10px] uppercase tracking-[0.28em] text-gold-light hidden md:block">
                Drag · Zoom · Klick
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            {restFiltered.length === 0 && !featureRef && (
              <div className="glass rounded-2xl p-6 text-white/70 text-sm">Aktuell keine Einträge.</div>
            )}
            {tab === "reference" && featureRef && (
              <button
                onMouseEnter={() => setHoverIdx(-1)}
                onMouseLeave={() => setHoverIdx(null)}
                onFocus={() => setHoverIdx(-1)}
                onBlur={() => setHoverIdx(null)}
                data-testid="arezen-pointer"
                className={`w-full text-left glass rounded-2xl p-5 transition-all ${arezenActive ? "gold-glow" : ""}`}
              >
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-gold-light/80">
                  <span className="pulse-dot reserved"/> <span>Feature</span>
                  <span className="text-white/50">· {featureRef.year}</span>
                </div>
                <div className="font-serif text-lg font-light tracking-tight text-white mt-1">
                  {featureRef.title}
                </div>
                <div className="text-xs text-white/60 mt-1">{featureRef.address}</div>
                <div className="mt-3 text-[10px] uppercase tracking-[0.24em] text-gold">Hover · zeigt Drohnenaufnahme</div>
              </button>
            )}
            {restFiltered.map((l, i) => (
              <ListingCard
                key={l.id}
                listing={l}
                idx={i}
                active={hoverIdx === i}
                onEnter={() => setHoverIdx(i)}
                onLeave={() => setHoverIdx(null)}
                onInquire={() => setInquiryFor(l)}
              />
            ))}
            {tab === "rental" && (
              <div className="text-xs text-white/50 pt-2 italic">Hinweis: Derzeit sind keine Kaufobjekte verfügbar.</div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {inquiryFor && <InquiryModal listing={inquiryFor} onClose={() => setInquiryFor(null)} />}
      </AnimatePresence>
    </section>
  );
}

function TwinFallback() {
  return (
    <div className="w-full h-full bg-gradient-to-br from-[#0A1428] to-[#13233F] flex items-center justify-center">
      <div className="text-gold/60 text-[10px] uppercase tracking-[0.3em]">3D lädt…</div>
    </div>
  );
}

function ReferenceFeature({ listing, isMobile }) {
  const ref = useRef(null);
  const videoRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (!ref.current) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => setInView(e.isIntersecting));
    }, { threshold: 0.25 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (inView && !reduced && !isMobile) v.play().catch(() => {});
    else v.pause();
  }, [inView, reduced, isMobile]);

  const useVideo = !isMobile && !reduced;
  const m = /^\/media\/([^/]+?)-800\.webp$/.exec(listing.image_url || "");
  const base = m ? `/media/${m[1]}` : "/media/landhaus";
  const videoBase = listing.video_url ? listing.video_url.replace(/\.mp4$/, "") : "/media/landhaus";

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.9 }}
      data-testid="reference-feature"
      className="mt-8 relative rounded-2xl overflow-hidden glass-strong border border-gold/40 gold-glow"
      style={{ aspectRatio: "4 / 3" }}
    >
      <picture>
        <source type="image/avif" srcSet={`${base}-1600.avif`} />
        <source type="image/webp" srcSet={`${base}-800.webp 800w, ${base}-1600.webp 1600w, ${base}-2400.webp 2400w`} sizes="(max-width: 1024px) 100vw, 1200px" />
        <img
          src={`${base}-1600.webp`}
          alt={listing.title}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
        />
      </picture>
      {useVideo && inView && (
        <video
          ref={videoRef}
          muted loop playsInline preload="metadata"
          poster={`${base}-1600.webp`}
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src={`${videoBase}.webm`} type="video/webm" />
          <source src={`${videoBase}.mp4`} type="video/mp4" />
        </video>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A1428] via-[#0A1428]/40 to-transparent pointer-events-none"/>
      <div className="absolute bottom-0 inset-x-0 p-6 md:p-10">
        <div className="text-[10px] uppercase tracking-[0.28em] text-gold-light mb-2">Referenz · Feature</div>
        <h3 className="font-serif text-2xl md:text-4xl font-light tracking-tight text-white leading-tight max-w-2xl">
          {listing.title}
        </h3>
        <div className="mt-2 text-sm text-white/75">{listing.address} · {listing.year}</div>
      </div>
      <div className="absolute top-4 right-4 glass px-3 py-1.5 rounded-full text-[10px] uppercase tracking-[0.28em] text-gold-light">
        Drohnen-Orbit · 10 s
      </div>
    </motion.div>
  );
}

function ArezenOverlayVideo({ listing, isMobile }) {
  const vRef = useRef(null);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  useEffect(() => {
    const v = vRef.current;
    if (!v) return;
    if (!isMobile && !reduced) v.play().catch(() => {});
  }, [isMobile, reduced]);

  const m = /^\/media\/([^/]+?)-800\.webp$/.exec(listing.image_url || "");
  const base = m ? `/media/${m[1]}` : "/media/landhaus";
  const videoBase = listing.video_url ? listing.video_url.replace(/\.mp4$/, "") : "/media/landhaus";

  return (
    <>
      <picture>
        <source type="image/avif" srcSet={`${base}-1600.avif`} />
        <source type="image/webp" srcSet={`${base}-800.webp 800w, ${base}-1600.webp 1600w`} sizes="800px" />
        <img
          src={`${base}-1600.webp`}
          alt={listing.title}
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
        />
      </picture>
      {!isMobile && !reduced && (
        <video ref={vRef} muted loop playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover">
          <source src={`${videoBase}.webm`} type="video/webm" />
          <source src={`${videoBase}.mp4`} type="video/mp4" />
        </video>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A1428]/80 via-transparent to-transparent"/>
      <div className="absolute bottom-3 inset-x-3 md:bottom-4 md:inset-x-4">
        <div className="font-serif text-lg md:text-xl font-light tracking-tight text-white">{listing.title}</div>
        <div className="text-[10px] uppercase tracking-[0.28em] text-gold-light mt-1">{listing.address}</div>
      </div>
    </>
  );
}

function ListingCard({ listing, idx, active, onEnter, onLeave, onInquire }) {
  const st = STATUS[listing.status] || STATUS.available;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: idx * 0.04 }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      data-testid={`listing-card-${listing.id}`}
      className={`glass rounded-2xl overflow-hidden transition-all ${active ? "gold-glow" : ""}`}
    >
      <div className="flex gap-0">
        {listing.image_url ? (
          <div className="w-32 md:w-40 shrink-0 relative">
            <ListingPicture
              src={listing.image_url}
              alt={listing.title}
              videoSrc={listing.video_url}
              hoverToPlay={!!listing.video_url}
            />
          </div>
        ) : (
          <div className="w-32 md:w-40 shrink-0 bg-gradient-to-br from-[#13233F] to-[#0A1428] relative">
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full opacity-40">
              <line x1="0" y1="80" x2="100" y2="10" stroke="#C9A96E" strokeWidth="0.5"/>
              <line x1="20" y1="100" x2="100" y2="40" stroke="#C9A96E" strokeWidth="0.5"/>
              <line x1="0" y1="50" x2="80" y2="100" stroke="#C9A96E" strokeWidth="0.5"/>
            </svg>
          </div>
        )}
        <div className="flex-1 p-5">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-gold-light/80">
            <span className={`pulse-dot ${st.cls}`}/> <span>{st.label}</span>
            {listing.available_from && listing.status === "available" && (
              <span className="text-white/50">· ab {dateSwiss(listing.available_from)}</span>
            )}
            {listing.year && listing.kind === "reference" && (
              <span className="text-white/50">· {listing.year}</span>
            )}
          </div>
          <h4 className="mt-2 font-serif text-lg md:text-xl font-light tracking-tight text-white leading-tight">{listing.title}</h4>
          <div className="mt-1 text-xs text-white/60">{listing.address}{listing.zip ? `, ${listing.zip} ${listing.city || ""}` : ""}</div>
          {listing.kind === "rental" && (
            <div className="mt-3 flex items-center gap-4 text-sm">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-gold">Netto</div>
                <div className="text-white">{money(listing.net_rent)}</div>
              </div>
              {listing.utilities != null && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gold">NK akonto</div>
                  <div className="text-white">{money(listing.utilities)}</div>
                </div>
              )}
              {listing.area && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gold">Fläche</div>
                  <div className="text-white">{listing.area} m²</div>
                </div>
              )}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {listing.kind === "rental" && (
              <button
                onClick={onInquire}
                data-testid={`inquire-${listing.id}`}
                className="h-8 px-3 rounded-full btn-gold text-[11px] font-medium uppercase tracking-[0.14em]"
              >
                Anfrage
              </button>
            )}
            {listing.pdf_url && (
              <a
                href={listing.pdf_url}
                target="_blank"
                rel="noreferrer"
                data-testid={`pdf-${listing.id}`}
                className="h-8 px-3 rounded-full btn-ghost text-[11px] font-medium uppercase tracking-[0.14em] inline-flex items-center"
              >
                Exposé PDF ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function InquiryModal({ listing, onClose }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: `Anfrage zu: ${listing.title}` });
  const [sending, setSending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await createInquiry({ ...form, listing_id: listing.id, source: "listing", topic: "Vermietung" });
      toast.success("Anfrage gesendet. Wir melden uns umgehend.");
      onClose();
    } catch (e) {
      toast.error("Übermittlung fehlgeschlagen. Bitte per Telefon oder E-Mail versuchen.");
    } finally { setSending(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] bg-navy/70 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong w-full max-w-lg rounded-2xl p-8"
        data-testid="inquiry-modal"
      >
        <div className="text-[10px] uppercase tracking-[0.28em] text-gold mb-2">Anfrage · {listing.city || "Rorschach"}</div>
        <h3 className="font-serif text-2xl font-light tracking-tight text-white">{listing.title}</h3>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <Field label="Name" required>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="inquiry-name" className="w-full bg-transparent border-b border-gold/30 focus:border-gold py-2 text-white placeholder-white/30 outline-none"/>
          </Field>
          <Field label="E-Mail" required>
            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="inquiry-email" className="w-full bg-transparent border-b border-gold/30 focus:border-gold py-2 text-white placeholder-white/30 outline-none"/>
          </Field>
          <Field label="Telefon">
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="inquiry-phone" className="w-full bg-transparent border-b border-gold/30 focus:border-gold py-2 text-white placeholder-white/30 outline-none"/>
          </Field>
          <Field label="Nachricht">
            <textarea rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} data-testid="inquiry-message" className="w-full bg-transparent border-b border-gold/30 focus:border-gold py-2 text-white placeholder-white/30 outline-none resize-none"/>
          </Field>
          <div className="pt-4 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="h-10 px-5 rounded-full btn-ghost text-[12px] uppercase tracking-[0.14em]" data-testid="inquiry-cancel">Abbrechen</button>
            <button type="submit" disabled={sending} className="h-10 px-5 rounded-full btn-gold text-[12px] uppercase tracking-[0.14em] disabled:opacity-60" data-testid="inquiry-submit">
              {sending ? "Sende…" : "Anfrage senden"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-[0.28em] text-gold-light/80 mb-1">{label}{required ? " *" : ""}</div>
      {children}
    </label>
  );
}

// Renders an optimized <picture> when the image_url follows the /media/*-800.webp or /media/*-1600.webp naming; else plain <img>.
function ListingPicture({ src, alt, videoSrc, hoverToPlay = false }) {
  const m = /^(\/media\/[^/]+?)-(?:800|1600|2400)\.webp$/.exec(src || "");
  const [hover, setHover] = useState(false);
  const vRef = useRef(null);

  useEffect(() => {
    if (!videoSrc || !vRef.current) return;
    if (hover) { vRef.current.currentTime = 0; vRef.current.play().catch(() => {}); }
    else { vRef.current.pause(); }
  }, [hover, videoSrc]);

  if (!m) return <img src={src} alt={alt} loading="lazy" decoding="async" className="w-full h-full object-cover"/>;
  const base = m[1];
  return (
    <div
      className="w-full h-full relative overflow-hidden"
      onMouseEnter={() => hoverToPlay && setHover(true)}
      onMouseLeave={() => hoverToPlay && setHover(false)}
      onFocus={() => hoverToPlay && setHover(true)}
      onBlur={() => hoverToPlay && setHover(false)}
      tabIndex={hoverToPlay ? 0 : -1}
    >
      <picture>
        <source
          type="image/avif"
          srcSet={`${base}-800.avif 800w, ${base}-1600.avif 1600w`}
          sizes="(max-width: 768px) 128px, 160px"
        />
        <source
          type="image/webp"
          srcSet={`${base}-800.webp 800w, ${base}-1600.webp 1600w, ${base}-2400.webp 2400w`}
          sizes="(max-width: 768px) 128px, 160px"
        />
        <img
          src={`${base}-800.webp`}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={`w-full h-full object-cover transition-opacity duration-500 ${hover && videoSrc ? "opacity-0" : "opacity-100"}`}
        />
      </picture>
      {videoSrc && (
        <video
          ref={vRef}
          muted
          loop
          playsInline
          preload="none"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${hover ? "opacity-100" : "opacity-0"}`}
        >
          <source src={videoSrc.replace(/\.mp4$/, ".webm")} type="video/webm" />
          <source src={videoSrc} type="video/mp4" />
        </video>
      )}
    </div>
  );
}
