import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { postValuation } from "@/lib/api";
import { SectionHeader } from "@/components/sections/Leistungen";

const STEPS = ["Objektart", "Details", "Extras"];

export default function Bewertung() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState({
    property_type: "wohnung",
    zip: "9400",
    city: "Rorschach",
    area: 110,
    rooms: 4.5,
    year_built: 2005,
    condition: 4,
    location_quality: 4,
    lake_view: false,
    garage: false,
    balcony: true,
    elevator: false,
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setLoading(true); setError("");
    try {
      const r = await postValuation(state);
      setResult(r);
    } catch (e) {
      setError("Bewertung fehlgeschlagen. Bitte erneut versuchen.");
    } finally { setLoading(false); }
  };

  const canNext = () => {
    if (step === 0) return !!state.property_type;
    if (step === 1) return state.zip && state.area > 0;
    return true;
  };

  return (
    <section id="bewertung" data-testid="bewertung-section" className="relative py-24 md:py-40 bg-navy overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10">
        <SectionHeader index="03" total="08" eyebrow="AI-Schnellbewertung" title="Was ist Ihre Immobilie wert?" subtitle="Indikative Schätzung in drei Schritten — mit fachlichem Kommentar. Bandbreite, keine Illusion." />

        <div className="mt-14 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}
            className="lg:col-span-7 glass rounded-2xl p-8 md:p-10"
          >
            <div className="flex items-center gap-3 mb-8">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-full border flex items-center justify-center text-[11px] transition-colors ${i <= step ? "bg-gold text-navy border-gold" : "border-gold/30 text-white/60"}`}>{i + 1}</div>
                  <div className={`text-[11px] uppercase tracking-[0.2em] ${i === step ? "text-gold-light" : "text-white/50"}`}>{s}</div>
                  {i < STEPS.length - 1 && <div className="w-8 h-px bg-gold/25"/>}
                </div>
              ))}
            </div>

            {step === 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.28em] text-gold mb-3">Objektart</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { id: "wohnung", label: "Wohnung" },
                    { id: "efh", label: "Einfamilienhaus" },
                    { id: "mfh", label: "Mehrfamilienhaus" },
                    { id: "gewerbe", label: "Gewerbe" },
                  ].map(o => (
                    <button
                      key={o.id}
                      onClick={() => setState({ ...state, property_type: o.id })}
                      data-testid={`ptype-${o.id}`}
                      className={`h-14 rounded-xl border transition-all text-sm ${state.property_type === o.id ? "bg-gold/15 border-gold text-white gold-glow" : "border-gold/25 text-white/75 hover:border-gold/60"}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                <Fld label="PLZ"><input data-testid="val-zip" value={state.zip} onChange={(e) => setState({ ...state, zip: e.target.value })} className="input"/></Fld>
                <Fld label="Ort"><input data-testid="val-city" value={state.city} onChange={(e) => setState({ ...state, city: e.target.value })} className="input"/></Fld>
                <Fld label="Wohnfläche (m²)"><input data-testid="val-area" type="number" value={state.area} onChange={(e) => setState({ ...state, area: +e.target.value })} className="input"/></Fld>
                <Fld label="Zimmer"><input data-testid="val-rooms" type="number" step="0.5" value={state.rooms} onChange={(e) => setState({ ...state, rooms: +e.target.value })} className="input"/></Fld>
                <Fld label="Baujahr"><input data-testid="val-year" type="number" value={state.year_built} onChange={(e) => setState({ ...state, year_built: +e.target.value })} className="input"/></Fld>
                <Fld label={`Zustand: ${state.condition}/5`}><input data-testid="val-condition" type="range" min={1} max={5} value={state.condition} onChange={(e) => setState({ ...state, condition: +e.target.value })} className="w-full accent-[#C9A96E]"/></Fld>
                <Fld label={`Lage-Qualität: ${state.location_quality}/5`}><input data-testid="val-location" type="range" min={1} max={5} value={state.location_quality} onChange={(e) => setState({ ...state, location_quality: +e.target.value })} className="w-full accent-[#C9A96E]"/></Fld>
              </div>
            )}

            {step === 2 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { id: "lake_view", label: "Seesicht" },
                  { id: "garage", label: "Garage" },
                  { id: "balcony", label: "Balkon/Terrasse" },
                  { id: "elevator", label: "Lift" },
                ].map(o => (
                  <button
                    key={o.id}
                    onClick={() => setState({ ...state, [o.id]: !state[o.id] })}
                    data-testid={`extra-${o.id}`}
                    className={`h-14 rounded-xl border transition-all text-sm ${state[o.id] ? "bg-gold/15 border-gold text-white gold-glow" : "border-gold/25 text-white/70 hover:border-gold/60"}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={() => setStep(Math.max(0, step - 1))}
                disabled={step === 0}
                className="h-10 px-5 rounded-full btn-ghost text-[12px] uppercase tracking-[0.14em] disabled:opacity-40"
                data-testid="val-back"
              >Zurück</button>
              {step < STEPS.length - 1 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={!canNext()}
                  className="h-10 px-5 rounded-full btn-gold text-[12px] uppercase tracking-[0.14em] disabled:opacity-40"
                  data-testid="val-next"
                >Weiter</button>
              ) : (
                <button
                  onClick={submit}
                  disabled={loading}
                  className="h-10 px-5 rounded-full btn-gold text-[12px] uppercase tracking-[0.14em] disabled:opacity-60"
                  data-testid="val-submit"
                >{loading ? "Berechne…" : "Bewertung anzeigen"}</button>
              )}
            </div>
            {error && <div className="mt-3 text-sm text-red-300">{error}</div>}
          </motion.div>

          <div className="lg:col-span-5">
            <ResultPanel result={result} loading={loading} />
          </div>
        </div>
      </div>

      <style>{`
        .input {
          width: 100%;
          background: transparent;
          border-bottom: 1px solid rgba(201,169,110,.35);
          color: #fff;
          padding: 10px 0;
          outline: none;
          transition: border-color 200ms;
        }
        .input:focus { border-color: #C9A96E; }
      `}</style>
    </section>
  );
}

function Fld({ label, children }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-[0.24em] text-gold-light/80 mb-2">{label}</div>
      {children}
    </label>
  );
}

function ResultPanel({ result, loading }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  return (
    <div ref={ref} className="glass rounded-2xl p-8 md:p-10 h-full min-h-[400px] flex flex-col">
      <div className="text-[10px] uppercase tracking-[0.28em] text-gold mb-2">Indikative Schätzung</div>
      <h3 className="font-serif text-2xl font-light tracking-tight text-white">Ihr Ergebnis</h3>

      {!result && !loading && (
        <div className="mt-8 text-white/60 text-sm leading-relaxed">
          Vervollständigen Sie die Angaben — Ihre Schätzung erscheint hier. Bandbreiten sind ±8 % um den erwarteten Verkehrswert.
        </div>
      )}

      {loading && (
        <div className="mt-8 flex items-center gap-3 text-gold-light">
          <div className="h-2 w-2 rounded-full bg-gold animate-pulse"/>
          <div className="text-sm">Analyse läuft…</div>
        </div>
      )}

      {result && (
        <div className="mt-6 flex-1 flex flex-col">
          <AnimatedNumber value={result.expected} play={inView} />
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-[0.24em] text-gold-light/80 mb-2">Bandbreite (±8 %)</div>
            <div className="relative h-2 rounded-full bg-white/8 overflow-hidden">
              <div className="absolute inset-y-0 left-[10%] right-[10%] bg-gradient-to-r from-gold/60 via-gold to-gold/60 rounded-full"/>
              <div className="absolute inset-y-0 left-[45%] w-1 bg-white"/>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-white/70">
              <span>CHF {result.min.toLocaleString("de-CH")}</span>
              <span className="text-gold-light">CHF {result.expected.toLocaleString("de-CH")}</span>
              <span>CHF {result.max.toLocaleString("de-CH")}</span>
            </div>
          </div>

          <div className="mt-6">
            <div className="text-[10px] uppercase tracking-[0.24em] text-gold-light/80 mb-3">Faktoren</div>
            <ul className="space-y-1.5 text-sm">
              {result.factors.map((f, i) => (
                <li key={i} className="flex items-center justify-between border-b border-gold/10 pb-1.5">
                  <span className="text-white/75">{f.label} <span className="text-white/40 ml-1">{f.value}</span></span>
                  <span className="text-gold-light">{f.impact}</span>
                </li>
              ))}
              <li className="flex items-center justify-between pt-1.5">
                <span className="text-white/75">Konfidenz</span>
                <span className="text-gold-light">{result.confidence} %</span>
              </li>
            </ul>
          </div>

          {result.commentary && (
            <div className="mt-6 glass-strong rounded-xl p-4 border border-gold/25">
              <div className="text-[10px] uppercase tracking-[0.24em] text-gold mb-2">Fachlicher Kommentar</div>
              <div className="text-sm text-white/85 leading-relaxed">{result.commentary}</div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a href="#kontakt" onClick={(e) => { e.preventDefault(); document.getElementById("kontakt")?.scrollIntoView({ behavior: "smooth" }); }} className="h-10 px-5 rounded-full btn-gold text-[12px] uppercase tracking-[0.14em]" data-testid="val-cta-contact">Verbindliche Schätzung</a>
            <div className="text-[10px] text-white/45 leading-tight max-w-xs">Indikative Schätzung — ersetzt keine SIV-konforme Verkehrswertschätzung.</div>
          </div>
        </div>
      )}
    </div>
  );
}

function AnimatedNumber({ value, play }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!play) return;
    const dur = 1400;
    const start = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, play]);
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.24em] text-gold-light/80 mb-1">Erwarteter Wert</div>
      <div className="font-serif font-light tracking-tight text-white text-4xl md:text-5xl">
        CHF <span data-testid="val-result-number">{display.toLocaleString("de-CH")}</span>
      </div>
    </div>
  );
}
