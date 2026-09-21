import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function Impressum() {
  return (
    <div className="min-h-screen bg-navy text-white">
      <div className="max-w-3xl mx-auto px-6 md:px-10 py-16 md:py-24">
        <Link to="/" className="text-[10px] uppercase tracking-[0.28em] text-gold-light hover:text-gold flex items-center gap-2 mb-10">
          <ArrowLeft size={14}/> Zurück
        </Link>
        <h1 className="font-serif text-4xl md:text-5xl font-light tracking-tight">Impressum</h1>
        <div className="mt-8 space-y-4 text-white/80 leading-relaxed">
          <p><strong className="text-gold-light">Immo Traeum AG</strong><br/>
          Strandweg 17<br/>8807 Freienbach<br/>Schweiz</p>
          <p>Telefon: <a className="link-gold" href="tel:+41446877134">044 687 71 34</a><br/>
          E-Mail: <a className="link-gold" href="mailto:info@immo-traeum.li">info@immo-traeum.li</a></p>
          <p className="text-white/60 text-sm">Diese Seite dient als Platzhalter und wird laufend ergänzt.</p>
        </div>
      </div>
    </div>
  );
}
