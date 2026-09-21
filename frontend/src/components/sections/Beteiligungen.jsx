import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { SectionHeader } from "@/components/sections/Leistungen";

const STATS = [
  { value: 60, suffix: "%", label: "Mieteranteil in der Schweiz", note: "Rund 60 % der Haushalte leben zur Miete — struktureller Rückenwind (Quelle: Bundesamt für Statistik, gerundet)." },
  { value: 4.2, suffix: "%", decimals: 1, label: "Bruttorendite Referenz", note: "Bewährter Zielkorridor für Wohnimmobilien-Portfolios." },
  { value: 100, suffix: " %", label: "Passiv investieren", note: "Sie legen an — wir bewirtschaften, buchhalten und pflegen." },
  { value: 3, suffix: "", label: "Regionen im Fokus", note: "Ostschweiz, Zentralschweiz und Fürstentum Liechtenstein." },
];

export default function Beteiligungen() {
  return (
    <section id="beteiligungen" data-testid="beteiligungen-section" className="relative py-28 md:py-44 bg-[#060d1c] overflow-hidden">
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-32 w-[500px] h-[500px] rounded-full" style={{ background: "radial-gradient(circle, rgba(201,169,110,0.14), transparent 60%)" }}/>
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full" style={{ background: "radial-gradient(circle, rgba(19,35,63,0.9), transparent 60%)" }}/>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 md:px-10 relative">
        <SectionHeader index="05" total="08" eyebrow="Immobilienbeteiligungen" title="Passiv beteiligt. Persönlich betreut." subtitle="Wohnungsknappheit, stabile Preisentwicklung, wachsende Nachfrage — und ein Team, das die Objekte täglich pflegt." />

        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((s, i) => <StatCard key={s.label} {...s} idx={i}/>)}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}
          className="mt-14 glass rounded-2xl p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
        >
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-gold mb-2">Whitepaper</div>
            <h3 className="font-serif text-2xl md:text-3xl font-light tracking-tight text-white">Wohnimmobilien-Beteiligungen — die Details.</h3>
            <p className="mt-2 text-white/70 max-w-2xl">Struktur, Beteiligungsmodell und Case Studies. Als PDF-Broschüre.</p>
          </div>
          <a
            href="https://www.immo-traeum.li/Real%20Estate/WOHNIMMOBILIENBETEILIGUNGEN.pdf"
            target="_blank"
            rel="noreferrer"
            data-testid="beteiligungen-pdf"
            className="inline-flex items-center gap-2 h-11 px-6 rounded-full btn-gold text-[12px] uppercase tracking-[0.14em]"
          >
            Broschüre öffnen ↗
          </a>
        </motion.div>
      </div>
    </section>
  );
}

function StatCard({ value, suffix, label, note, decimals = 0, idx }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const dur = 1600;
    const start = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: idx * 0.06 }}
      className="glass rounded-2xl p-6 md:p-7"
    >
      <div className="font-serif font-light tracking-tight text-white text-4xl md:text-5xl leading-none">
        {display.toFixed(decimals)}<span className="text-gold text-3xl md:text-4xl">{suffix}</span>
      </div>
      <div className="mt-3 text-[10px] uppercase tracking-[0.22em] text-gold-light/80">{label}</div>
      <div className="mt-3 text-sm text-white/65 leading-relaxed">{note}</div>
    </motion.div>
  );
}
