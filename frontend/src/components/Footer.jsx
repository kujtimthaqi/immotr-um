import { Link } from "react-router-dom";
import Crest from "@/components/Crest";

export default function Footer() {
  return (
    <footer data-testid="site-footer" className="relative border-t border-[color:var(--gold)]/20 bg-navy">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-16 md:py-20 grid md:grid-cols-12 gap-10">
        <div className="md:col-span-5">
          <Crest variant="footer" className="mb-6" />
          <div className="font-serif text-3xl font-light tracking-tight text-white">Immo Traeum <span className="text-gold">AG</span></div>
          <p className="mt-4 text-sm text-white/60 max-w-md leading-relaxed">
            Traumhaftes Immobilienmanagement zwischen Bodensee und Alpen. Diskret, präzise und persönlich.
          </p>
          <div className="mt-6 flex items-center gap-4">
            <span className="text-[10px] uppercase tracking-[0.28em] text-gold">SIV-Mitglied</span>
            <span className="w-8 h-px bg-gold/30"/>
            <span className="text-[10px] uppercase tracking-[0.28em] text-gold-light">Casafair</span>
          </div>
        </div>
        <div className="md:col-span-3">
          <div className="text-[10px] uppercase tracking-[0.28em] text-gold mb-4">Kontakt</div>
          <address className="not-italic text-sm text-white/75 leading-relaxed">
            Immo Traeum AG<br/>
            Strandweg 17<br/>
            8807 Freienbach<br/>
            <a href="tel:+41446877134" className="link-gold">044 687 71 34</a><br/>
            <a href="mailto:info@immo-traeum.li" className="link-gold">info@immo-traeum.li</a>
          </address>
        </div>
        <div className="md:col-span-2">
          <div className="text-[10px] uppercase tracking-[0.28em] text-gold mb-4">Rechtliches</div>
          <ul className="space-y-2 text-sm text-white/70">
            <li><Link to="/impressum" className="link-gold" data-testid="footer-impressum">Impressum</Link></li>
            <li><Link to="/datenschutz" className="link-gold" data-testid="footer-datenschutz">Datenschutz</Link></li>
          </ul>
        </div>
        <div className="md:col-span-2">
          <div className="text-[10px] uppercase tracking-[0.28em] text-gold mb-4">Regionen</div>
          <ul className="space-y-2 text-sm text-white/70">
            <li>Ostschweiz</li>
            <li>Zentralschweiz</li>
            <li>Liechtenstein</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[color:var(--gold)]/10">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-6 pb-24 md:pb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="text-xs text-white/50">© 2026 Immo Traeum AG. Alle Rechte vorbehalten.</div>
          <div className="text-xs text-white/40">Zwischen Bodensee und Alpen · CH · FL</div>
        </div>
      </div>
    </footer>
  );
}
