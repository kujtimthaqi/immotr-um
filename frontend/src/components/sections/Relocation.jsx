import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
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
    bgBase: "/media/relocation",
    alt: "Schlüsselübergabe mit Seeblick",
  },
  {
    id: "erbe",
    kicker: "Erbschaften",
    title: "Auch in schwierigen Zeiten an Ihrer Seite.",
    body: "Professionell, diskret und rasch. Als unabhängige Willensvollstrecker vermitteln wir zwischen den Erben, führen Mandate zur Erbteilung — und helfen Kosten zu sparen.",
    bullets: ["Willensvollstreckung als unabhängige Instanz", "Erbteilungsmandate", "Wert- und Sachverständigen-Fragen", "Diskrete, persönliche Betreuung"],
    icon: Landmark,
    bgBase: "/media/erbe",
    alt: "Schreibtisch mit Familienalbum und Dokumenten",
  },
];

export default function Relocation() {
  return (
    <section id="relocation" data-testid="relocation-section" className="relative py-24 md:py-40 bg-navy overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10">
        <SectionHeader index="04" total="08" eyebrow="Relocation · Erbschaften" title="Menschen. Häuser. Übergänge." />

        <div className="mt-14 grid grid-cols-1 md:grid-cols-12 gap-6">
          {CARDS.map((c, i) => (
            <SplitCard key={c.id} card={c} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function SplitCard({ card, index }) {
  const cardRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: cardRef, offset: ["start end", "end start"] });
  const yBg = useTransform(scrollYProgress, [0, 1], ["-8%", "8%"]);
  const scaleBg = useTransform(scrollYProgress, [0, 1], [1.08, 1.0]);

  const Icon = card.icon;

  return (
    <motion.article
      ref={cardRef}
      initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.8, delay: index * 0.08 }}
      data-testid={`relocation-${card.id}`}
      className="md:col-span-6 relative rounded-2xl overflow-hidden min-h-[520px] glass p-8 md:p-10 flex flex-col isolate"
    >
      {/* Parallax background image */}
      <motion.div className="absolute inset-0 -z-20 overflow-hidden" style={{ y: yBg, scale: scaleBg }}>
        <picture>
          <source type="image/avif" srcSet={`${card.bgBase}-1600.avif`} />
          <source
            type="image/webp"
            srcSet={`${card.bgBase}-800.webp 800w, ${card.bgBase}-1600.webp 1600w`}
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          <img
            src={`${card.bgBase}-1600.webp`}
            alt={card.alt}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </picture>
      </motion.div>

      {/* Navy gradient from bottom for legibility */}
      <div className="absolute inset-0 -z-10 pointer-events-none bg-gradient-to-t from-[#0A1428] via-[#0A1428]/85 to-transparent"/>
      <div className="absolute inset-0 -z-10 pointer-events-none bg-gradient-to-br from-[#0A1428]/70 via-transparent to-transparent"/>

      {/* Gold hairline overlay (screen blend) */}
      <svg viewBox="0 0 400 400" aria-hidden className="absolute inset-0 -z-10 w-full h-full opacity-[0.16] mix-blend-screen pointer-events-none">
        {Array.from({ length: 12 }).map((_, i) => (
          <line key={i} x1={i * 38} y1="0" x2={i * 38 - 130} y2="400" stroke="#E6D3A8" strokeWidth="0.6" />
        ))}
      </svg>

      <div className="relative flex items-start justify-between">
        <div className="w-11 h-11 rounded-full glass-strong flex items-center justify-center text-gold border border-gold/30">
          <Icon size={18} strokeWidth={1.25}/>
        </div>
        <span className="text-[10px] uppercase tracking-[0.28em] text-gold-light/85">{card.kicker}</span>
      </div>

      <h3 className="relative mt-6 font-serif text-3xl md:text-4xl font-light tracking-tight text-white leading-[1.05]">
        {card.title}
      </h3>
      <p className="relative mt-4 text-white/80 max-w-md leading-relaxed">{card.body}</p>

      <ul className="relative mt-6 space-y-2">
        {card.bullets.map(b => (
          <li key={b} className="flex items-start gap-3 text-sm text-white/85">
            <span className="mt-2 w-4 h-px bg-gold"/>{b}
          </li>
        ))}
      </ul>

      <div className="relative mt-auto pt-8">
        {card.cta ? (
          <a href={card.cta.href} target="_blank" rel="noreferrer" data-testid={`relocation-cta-${card.id}`} className="inline-flex items-center gap-2 h-10 px-5 rounded-full btn-gold text-[12px] uppercase tracking-[0.14em]">
            {card.cta.label} <ArrowUpRight size={14}/>
          </a>
        ) : (
          <a href="#kontakt" onClick={(e) => { e.preventDefault(); document.getElementById("kontakt")?.scrollIntoView({ behavior: "smooth" }); }} data-testid={`relocation-cta-${card.id}`} className="inline-flex items-center gap-2 h-10 px-5 rounded-full btn-ghost text-[12px] uppercase tracking-[0.14em]">
            Vertrauliches Gespräch <ArrowUpRight size={14}/>
          </a>
        )}
      </div>
    </motion.article>
  );
}
