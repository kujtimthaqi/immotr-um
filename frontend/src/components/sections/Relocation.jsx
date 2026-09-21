import { motion } from "framer-motion";
import { SectionHeader } from "@/components/sections/Leistungen";
import { Plane, Landmark, ArrowUpRight } from "lucide-react";

const CARDS = [
  {
    id: "relocation",
    kicker: "Relocation",
    title: "Neu in der Schweiz. Zu Hause bei uns.",
    body: "Wir begleiten Ihre Mitarbeitenden und Familien Schritt für Schritt: Wohnungssuche, Bankkonto, Versicherungen, Schulen und die Gemeinde-Anmeldung.",
    bullets: ["Wohnungssuche & Besichtigungen", "Bankkonto & Versicherungen", "Schulen & Kinderbetreuung", "Gemeinde-Anmeldung"],
    cta: { label: "Broschüre öffnen", href: "https://www.immo-traeum.li/Firmen_Relocation.pdf" },
    icon: Plane,
    tone: "from-[#13233F] to-[#0A1428]",
  },
  {
    id: "erbe",
    kicker: "Erbschaften",
    title: "Auch in schwierigen Zeiten an Ihrer Seite.",
    body: "Professionell, diskret und rasch. Als unabhängige Willensvollstrecker vermitteln wir zwischen den Erben, führen Mandate zur Erbteilung — und helfen Kosten zu sparen.",
    bullets: ["Willensvollstreckung als unabhängige Instanz", "Erbteilungsmandate", "Wert- und Sachverständigen-Fragen", "Diskrete, persönliche Betreuung"],
    icon: Landmark,
    tone: "from-[#13233F] to-[#0A1428]",
  },
];

export default function Relocation() {
  return (
    <section id="relocation" data-testid="relocation-section" className="relative py-24 md:py-40 bg-navy overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10">
        <SectionHeader index="04" total="08" eyebrow="Relocation · Erbschaften" title="Menschen. Häuser. Übergänge." />

        <div className="mt-14 grid grid-cols-1 md:grid-cols-12 gap-6">
          {CARDS.map((c, i) => {
            const Icon = c.icon;
            return (
              <motion.article
                key={c.id}
                initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: i * 0.08 }}
                data-testid={`relocation-${c.id}`}
                className={`md:col-span-6 relative rounded-2xl overflow-hidden min-h-[440px] glass p-8 md:p-10 flex flex-col`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${c.tone} opacity-70 -z-10`}/>
                <svg viewBox="0 0 400 400" className="absolute inset-0 w-full h-full opacity-[0.08] -z-10">
                  {Array.from({ length: 14 }).map((_, i) => (
                    <line key={i} x1={i * 32} y1="0" x2={i * 32 - 120} y2="400" stroke="#C9A96E" strokeWidth="0.6" />
                  ))}
                </svg>

                <div className="flex items-start justify-between">
                  <div className="w-11 h-11 rounded-full glass-strong flex items-center justify-center text-gold border border-gold/30">
                    <Icon size={18} strokeWidth={1.25}/>
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.28em] text-gold-light/70">{c.kicker}</span>
                </div>

                <h3 className="mt-6 font-serif text-3xl md:text-4xl font-light tracking-tight text-white leading-[1.05]">{c.title}</h3>
                <p className="mt-4 text-white/75 max-w-md leading-relaxed">{c.body}</p>

                <ul className="mt-6 space-y-2">
                  {c.bullets.map(b => (
                    <li key={b} className="flex items-start gap-3 text-sm text-white/80">
                      <span className="mt-2 w-4 h-px bg-gold"/>{b}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-8">
                  {c.cta ? (
                    <a href={c.cta.href} target="_blank" rel="noreferrer" data-testid={`relocation-cta-${c.id}`} className="inline-flex items-center gap-2 h-10 px-5 rounded-full btn-gold text-[12px] uppercase tracking-[0.14em]">
                      {c.cta.label} <ArrowUpRight size={14}/>
                    </a>
                  ) : (
                    <a href="#kontakt" onClick={(e) => { e.preventDefault(); document.getElementById("kontakt")?.scrollIntoView({ behavior: "smooth" }); }} data-testid={`relocation-cta-${c.id}`} className="inline-flex items-center gap-2 h-10 px-5 rounded-full btn-ghost text-[12px] uppercase tracking-[0.14em]">
                      Vertrauliches Gespräch <ArrowUpRight size={14}/>
                    </a>
                  )}
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
