import { motion } from "framer-motion";
import { Home, Wrench, Scale, Landmark, HandCoins, FileText, Hammer, Compass } from "lucide-react";

const TILES = [
  {
    id: "bewerten",
    title: "Bewerten",
    tagline: "Wir schätzen, was Ihnen wertvoll ist.",
    body: "SIV-konforme Verkehrswertschätzungen mit hedonischer und Ertragswertmethode. Für Verkauf, Erbteilung, Steuern oder persönliche Sicherheit.",
    icon: Compass,
    span: "md:col-span-7 md:row-span-2",
  },
  {
    id: "bewirtschaften",
    title: "Bewirtschaften",
    tagline: "Wir pflegen, was Ihnen gehört.",
    body: "Vermietung, Buchhaltung, Nebenkostenabrechnungen — verlässlich und persönlich.",
    icon: Home,
    span: "md:col-span-5",
  },
  {
    id: "beraten",
    title: "Beraten",
    tagline: "Wir raten, wo Sie suchen.",
    body: "Kauf, Verkauf und Investition — mit der nüchternen Perspektive der Region.",
    icon: Scale,
    span: "md:col-span-5",
  },
  {
    id: "erbteilungen",
    title: "Erbteilungen & Willensvollstreckung",
    tagline: "Wir sind für Sie da, auch in schwierigen Zeiten.",
    body: "Diskrete und rasche Abwicklung — als unabhängige Instanz zwischen den Beteiligten.",
    icon: Landmark,
    span: "md:col-span-6",
  },
  {
    id: "sanierung",
    title: "Sanierungs- & Umbaubegleitung",
    tagline: "Vom Rohbau bis zur Vermietung.",
    body: "Projektsteuerung mit Handwerker-Auge und Kostenbewusstsein.",
    icon: Hammer,
    span: "md:col-span-6",
  },
  {
    id: "steuer",
    title: "Steuererklärungen",
    tagline: "Mit oder ohne Immobilien.",
    body: "Für Private und Eigentümer — akkurat und termingerecht.",
    icon: FileText,
    span: "md:col-span-12 lg:col-span-12",
  },
];

export default function Leistungen() {
  return (
    <section id="leistungen" data-testid="leistungen-section" className="relative py-24 md:py-40 bg-navy overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10">
        <SectionHeader index="01" total="08" eyebrow="Leistungen" title="Sechs Disziplinen. Eine Haltung." />

        <div className="mt-14 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-5 auto-rows-[minmax(190px,auto)]">
          {TILES.map((t, i) => (
            <BentoCard key={t.id} tile={t} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function SectionHeader({ index, total, eyebrow, title, subtitle, align = "left" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className={`flex flex-col ${align === "center" ? "items-center text-center" : "items-start"} gap-5`}
    >
      <div className="flex items-center gap-4">
        <span className="section-counter text-gold text-sm md:text-base">{index} <span className="text-gold/40">/ {total}</span></span>
        <span className="w-12 h-px bg-gold/40"/>
        <span className="text-[10px] uppercase tracking-[0.32em] text-gold-light/80">{eyebrow}</span>
      </div>
      <h2 className="font-serif font-light tracking-tight text-white text-4xl md:text-5xl lg:text-6xl leading-[1.02] max-w-3xl">
        {title}
      </h2>
      {subtitle && <p className="text-white/70 max-w-2xl leading-relaxed">{subtitle}</p>}
    </motion.div>
  );
}

function BentoCard({ tile, index }) {
  const Icon = tile.icon;
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <motion.article
      onMouseMove={onMove}
      initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay: index * 0.05, ease: "easeOut" }}
      data-testid={`leistung-${tile.id}`}
      className={`spotlight glass rounded-2xl p-7 md:p-9 relative group col-span-1 ${tile.span} min-h-[220px]`}
    >
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-start justify-between">
          <div className="w-11 h-11 rounded-full glass-strong flex items-center justify-center text-gold border border-gold/30">
            <Icon size={18} strokeWidth={1.25} />
          </div>
          <span className="text-[10px] uppercase tracking-[0.28em] text-gold-light/70">— {String(index + 1).padStart(2, "0")}</span>
        </div>
        <h3 className="mt-6 font-serif text-2xl md:text-[26px] font-light tracking-tight text-white leading-tight">
          {tile.title}
        </h3>
        <p className="mt-2 text-gold-light/90 text-sm italic font-serif">{tile.tagline}</p>
        <p className="mt-4 text-sm text-white/70 leading-relaxed">
          {tile.body}
        </p>
      </div>
    </motion.article>
  );
}
