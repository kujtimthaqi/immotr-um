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
              onClick={() => setTab(t.id)}
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

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div ref={twinRef} className="lg:col-span-7 h-[380px] md:h-[520px] rounded-2xl overflow-hidden glass relative">
            {showTwin ? (
              <Suspense fallback={<TwinFallback />}>
                <DigitalTwin highlightIndex={hoverIdx} listings={filtered} mobile={isMobile} />
              </Suspense>
            ) : <TwinFallback />}
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
            {filtered.length === 0 && (
              <div className="glass rounded-2xl p-6 text-white/70 text-sm">Aktuell keine Einträge.</div>
            )}
            {filtered.map((l, i) => (
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
          <div className="w-28 md:w-32 shrink-0 relative">
            <ListingPicture src={listing.image_url} alt={listing.title} />
          </div>
        ) : (
          <div className="w-28 md:w-32 shrink-0 bg-gradient-to-br from-[#13233F] to-[#0A1428] relative">
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

// Renders an optimized <picture> when the image_url follows the /media/*-800.webp naming; else plain <img>.
function ListingPicture({ src, alt }) {
  const m = /^(\/media\/[^/]+?)-800\.webp$/.exec(src || "");
  if (!m) return <img src={src} alt={alt} loading="lazy" decoding="async" className="w-full h-full object-cover"/>;
  const base = m[1];
  return (
    <picture>
      <source
        type="image/webp"
        srcSet={`${base}-800.webp 800w, ${base}-1600.webp 1600w, ${base}-2400.webp 2400w`}
        sizes="(max-width: 768px) 112px, 128px"
      />
      <img
        src={`${base}-800.webp`}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover"
      />
    </picture>
  );
}
