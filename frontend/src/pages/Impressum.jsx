import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

// UID/Handelsregister: CHE-xxx.xxx.xxx (wird ergänzt, sobald geliefert)
export default function Impressum() {
  return (
    <div className="min-h-screen bg-navy text-white">
      <div className="max-w-3xl mx-auto px-6 md:px-10 py-16 md:py-24">
        <Link to="/" className="text-[10px] uppercase tracking-[0.28em] text-gold-light hover:text-gold flex items-center gap-2 mb-10">
          <ArrowLeft size={14}/> Zurück
        </Link>
        <h1 className="font-serif text-4xl md:text-5xl font-light tracking-tight">Impressum</h1>

        <div className="mt-10 space-y-8 text-white/80 leading-relaxed">
          <section>
            <h2 className="font-serif text-xl text-gold-light mb-2">Kontakt</h2>
            <p><strong className="text-white">Immo Traeum AG</strong><br/>
            Strandweg 17<br/>8807 Freienbach<br/>Schweiz</p>
            <p className="mt-3">Telefon: <a className="link-gold" href="tel:+41446877134">044 687 71 34</a><br/>
            E-Mail: <a className="link-gold" href="mailto:info@immo-traeum.li">info@immo-traeum.li</a></p>
          </section>

          <section>
            <h2 className="font-serif text-xl text-gold-light mb-2">Rechtsform</h2>
            <p>Aktiengesellschaft nach schweizerischem Recht mit Sitz in Freienbach SZ.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl text-gold-light mb-2">Mitgliedschaften</h2>
            <p>Schweizerischer Immobilienschätzer-Verband (SIV) · Casafair.</p>
          </section>

          <section>
            <h2 className="font-serif text-xl text-gold-light mb-2">Haftungsausschluss</h2>
            <p className="text-sm">
              Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die
              Richtigkeit, Vollständigkeit und Aktualität der Inhalte. Angaben zu Objekten
              (Preise, Verfügbarkeiten, Zustand) sind unverbindlich und werden regelmässig
              aktualisiert. Die Haftung für Schäden materieller oder immaterieller Art, die
              durch den Zugriff auf oder die Nutzung dieser Website entstehen, wird —
              soweit gesetzlich zulässig — ausgeschlossen.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl text-gold-light mb-2">Urheberrecht</h2>
            <p className="text-sm">
              Sämtliche Inhalte dieser Website — Texte, Layouts, Programmierung — sind
              urheberrechtlich geschützt. Bilder und Videos wurden teilweise KI-generiert
              (Higgsfield) zur Illustration und stellen keine fotografischen Aufnahmen
              existierender Objekte dar. Die 3D-Gebäudedaten stammen aus swissBUILDINGS3D
              und werden verwendet unter den Nutzungsbedingungen von swisstopo
              (© swisstopo, Open Data — <a className="link-gold" href="https://www.geo.admin.ch/de/allgemeine-nutzungsbedingungen-fsdi" target="_blank" rel="noreferrer">Nutzungsbedingungen</a>).
              Das Familienwappen „Jehli" wird mit Zustimmung des Wappenträgers verwendet.
            </p>
          </section>

          <section className="pt-4 border-t border-gold/15">
            <p className="text-xs text-white/50">
              Datenschutz: siehe <Link to="/datenschutz" className="link-gold">Datenschutzerklärung</Link>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
