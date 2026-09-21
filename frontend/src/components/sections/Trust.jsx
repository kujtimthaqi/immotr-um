import { motion } from "framer-motion";
import { SectionHeader } from "@/components/sections/Leistungen";
import { ShieldCheck, Compass, Handshake } from "lucide-react";

const VALUES = [
  { icon: ShieldCheck, title: "Diskretion", body: "Was wir wissen, bleibt bei uns. Sensible Themen — sensibel behandelt." },
  { icon: Compass, title: "Präzision", body: "Zahlen, Methodik, Dokumentation. SIV-konform und nachvollziehbar." },
  { icon: Handshake, title: "Persönlich", body: "Kein Callcenter. Dieselbe Ansprechperson vom Erstgespräch bis zur Übergabe." },
];

const TIMELINE = [
  { step: "01", title: "Erstgespräch", body: "Vor Ort oder vertraulich in Freienbach. Wir hören zuerst zu." },
  { step: "02", title: "Analyse", body: "Marktdaten, Objektdaten, Kontext. Wir strukturieren die Optionen." },
  { step: "03", title: "Umsetzung", body: "Bewertung, Vermietung, Sanierung — kuratiert und begleitet." },
  { step: "04", title: "Begleitung", body: "Wir bleiben — für Bewirtschaftung, Steuern oder das nächste Kapitel." },
];

export default function Trust() {
  return (
    <section id="trust" data-testid="trust-section" className="relative py-24 md:py-40 bg-navy overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10">
        <SectionHeader index="06" total="08" eyebrow="Vertrauen" title="Zwei Verbände. Drei Werte. Ein Weg."/>

        {/* Memberships */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="glass rounded-2xl p-8 flex items-center gap-6">
            <div className="w-16 h-16 rounded-full glass-strong flex items-center justify-center border border-gold/30">
              <span className="font-serif text-gold text-xl">SIV</span>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-gold">Mitgliedschaft</div>
              <div className="font-serif text-xl font-light tracking-tight text-white mt-1">Schweizerischer Immobilienschätzer-Verband</div>
              <div className="text-sm text-white/60 mt-1">Anerkannte Schätzer für Verkehrswertgutachten.</div>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.1 }} className="glass rounded-2xl p-8 flex items-center gap-6">
            <div className="w-16 h-16 rounded-full glass-strong flex items-center justify-center border border-gold/30">
              <span className="font-serif text-gold text-xl">C</span>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-gold">Mitgliedschaft</div>
              <div className="font-serif text-xl font-light tracking-tight text-white mt-1">Casafair</div>
              <div className="text-sm text-white/60 mt-1">Verband für verantwortungsbewusste Wohneigentümer.</div>
            </div>
          </motion.div>
        </div>

        {/* Values */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          {VALUES.map((v, i) => {
            const Icon = v.icon;
            return (
              <motion.div key={v.title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: i * 0.08 }} className="glass rounded-2xl p-8">
                <div className="w-11 h-11 rounded-full glass-strong flex items-center justify-center text-gold border border-gold/30">
                  <Icon size={18} strokeWidth={1.25}/>
                </div>
                <h4 className="mt-5 font-serif text-xl font-light tracking-tight text-white">{v.title}</h4>
                <p className="mt-2 text-sm text-white/70 leading-relaxed">{v.body}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Timeline */}
        <div className="mt-20 relative">
          <div className="text-[10px] uppercase tracking-[0.28em] text-gold mb-8">Unser Prozess</div>
          <div className="relative pl-6 md:pl-0">
            <div className="hidden md:block absolute top-6 left-0 right-0 h-px bg-gold/25"/>
            <div className="md:hidden absolute top-0 bottom-0 left-2 w-px bg-gold/25"/>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-10">
              {TIMELINE.map((t, i) => (
                <motion.div
                  key={t.step}
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: i * 0.1 }}
                  className="relative"
                >
                  <div className="absolute md:top-3 md:-translate-y-1/2 md:left-0 -left-6 top-0 w-4 h-4 rounded-full bg-gold gold-glow"/>
                  <div className="md:pt-10">
                    <div className="section-counter text-gold">{t.step}</div>
                    <div className="font-serif text-xl font-light tracking-tight text-white mt-1">{t.title}</div>
                    <div className="text-sm text-white/65 mt-2 leading-relaxed">{t.body}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
