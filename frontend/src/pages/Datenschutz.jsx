import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function Datenschutz() {
  return (
    <div className="min-h-screen bg-navy text-white">
      <div className="max-w-3xl mx-auto px-6 md:px-10 py-16 md:py-24">
        <Link to="/" className="text-[10px] uppercase tracking-[0.28em] text-gold-light hover:text-gold flex items-center gap-2 mb-10">
          <ArrowLeft size={14}/> Zurück
        </Link>
        <h1 className="font-serif text-4xl md:text-5xl font-light tracking-tight">Datenschutz</h1>
        <div className="mt-8 space-y-4 text-white/80 leading-relaxed">
          <p>Ihre Daten werden vertraulich behandelt und ausschliesslich zur Bearbeitung Ihrer Anfrage verwendet.</p>
          <p>Bei Fragen wenden Sie sich bitte an <a className="link-gold" href="mailto:info@immo-traeum.li">info@immo-traeum.li</a>.</p>
          <p className="text-white/60 text-sm">Diese Seite dient als Platzhalter und wird laufend ergänzt.</p>
        </div>
      </div>
    </div>
  );
}
