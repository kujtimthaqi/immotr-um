import { useState } from "react";
import { motion } from "framer-motion";
import { SectionHeader } from "@/components/sections/Leistungen";
import { createInquiry } from "@/lib/api";
import { toast } from "sonner";

const TOPICS = ["Bewertung", "Bewirtschaftung", "Beratung", "Erbschaft", "Investor", "Relocation", "Sonstiges"];

export default function Kontakt() {
  const [form, setForm] = useState({
    company: "", name: "", address: "", zip_city: "", phone: "", email: "", topic: "Bewertung", message: "",
  });
  const [sending, setSending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await createInquiry({ ...form, source: "contact" });
      toast.success("Vielen Dank. Ihre Nachricht ist bei uns eingegangen.");
      setForm({ ...form, message: "", company: "", address: "", zip_city: "", phone: "" });
    } catch (e) {
      toast.error("Übermittlung fehlgeschlagen. Bitte per Telefon oder E-Mail versuchen.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="kontakt" data-testid="kontakt-section" className="relative py-24 md:py-40 bg-navy overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10">
        <SectionHeader index="07" total="08" eyebrow="Kontakt" title="Sprechen wir." subtitle="Diskret, unverbindlich — und zu Zeiten, die zu Ihnen passen." />

        <div className="mt-14 grid grid-cols-1 md:grid-cols-12 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}
            className="md:col-span-5 glass rounded-2xl p-8 md:p-10"
          >
            <div className="text-[10px] uppercase tracking-[0.28em] text-gold mb-3">Adresse</div>
            <div className="font-serif text-2xl md:text-3xl font-light tracking-tight text-white leading-tight">Immo Traeum AG</div>
            <div className="mt-3 text-white/75 leading-relaxed">
              Strandweg 17<br/>
              8807 Freienbach<br/>
              <a href="tel:+41446877134" className="link-gold" data-testid="contact-phone">044 687 71 34</a><br/>
              <a href="mailto:info@immo-traeum.li" className="link-gold" data-testid="contact-email">info@immo-traeum.li</a>
            </div>

            <div className="mt-10 pt-6 border-t border-gold/15">
              <div className="text-[10px] uppercase tracking-[0.28em] text-gold mb-3">Regionen</div>
              <div className="grid grid-cols-2 gap-2 text-sm text-white/75">
                <div>Ostschweiz</div>
                <div>Bodensee</div>
                <div>Zentralschweiz</div>
                <div>Liechtenstein</div>
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-gold/15">
              <div className="text-[10px] uppercase tracking-[0.28em] text-gold mb-2">Vertraulichkeit</div>
              <p className="text-sm text-white/65 leading-relaxed">Ihre Angaben werden ausschliesslich zur Bearbeitung Ihrer Anfrage verwendet und nicht an Dritte weitergegeben.</p>
            </div>
          </motion.div>

          <motion.form
            onSubmit={submit}
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.1 }}
            className="md:col-span-7 glass rounded-2xl p-8 md:p-10 space-y-4"
            data-testid="contact-form"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Fld label="Firma"><input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="input" data-testid="c-company"/></Fld>
              <Fld label="Name" required><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" data-testid="c-name"/></Fld>
              <Fld label="Adresse"><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input" data-testid="c-address"/></Fld>
              <Fld label="PLZ / Ort"><input value={form.zip_city} onChange={(e) => setForm({ ...form, zip_city: e.target.value })} className="input" data-testid="c-zip"/></Fld>
              <Fld label="Telefon"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" data-testid="c-phone"/></Fld>
              <Fld label="E-Mail" required><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" data-testid="c-email"/></Fld>
            </div>

            <Fld label="Thema">
              <div className="flex flex-wrap gap-2 pt-1">
                {TOPICS.map(t => (
                  <button type="button" key={t} onClick={() => setForm({ ...form, topic: t })} data-testid={`c-topic-${t}`}
                    className={`h-8 px-3 rounded-full text-[11px] uppercase tracking-[0.14em] border transition-colors ${form.topic === t ? "bg-gold text-navy border-gold" : "border-gold/25 text-white/75 hover:border-gold/60"}`}
                  >{t}</button>
                ))}
              </div>
            </Fld>

            <Fld label="Nachricht">
              <textarea rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="input resize-none" data-testid="c-message"/>
            </Fld>

            <div className="pt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-white/50">
                Wir antworten in der Regel innert 24 h.<br/>
                <span className="text-white/40">Mit dem Absenden stimmen Sie der Bearbeitung gemäss <a href="/datenschutz" className="link-gold">Datenschutzerklärung</a> zu.</span>
              </div>
              <button disabled={sending} type="submit" className="h-11 px-6 rounded-full btn-gold text-[12px] uppercase tracking-[0.14em] disabled:opacity-60" data-testid="c-submit">
                {sending ? "Sende…" : "Nachricht senden"}
              </button>
            </div>
          </motion.form>
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

function Fld({ label, required, children }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-[0.24em] text-gold-light/80 mb-1">{label}{required ? " *" : ""}</div>
      {children}
    </label>
  );
}
