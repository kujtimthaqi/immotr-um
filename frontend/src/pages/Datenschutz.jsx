import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function Datenschutz() {
  return (
    <div className="min-h-screen bg-navy text-white">
      <div className="max-w-3xl mx-auto px-6 md:px-10 py-16 md:py-24">
        <Link to="/" className="text-[10px] uppercase tracking-[0.28em] text-gold-light hover:text-gold flex items-center gap-2 mb-10">
          <ArrowLeft size={14}/> Zurück
        </Link>
        <h1 className="font-serif text-4xl md:text-5xl font-light tracking-tight">Datenschutzerklärung</h1>
        <p className="mt-3 text-[11px] uppercase tracking-[0.24em] text-gold-light">Nach revDSG (in Kraft seit 1.9.2023) · Stand: Februar 2026</p>

        <div className="mt-10 space-y-8 text-white/80 leading-relaxed text-[15px]">
          <section>
            <h2 className="font-serif text-xl text-gold-light mb-2">1. Verantwortliche Stelle</h2>
            <p>
              Immo Traeum AG, Strandweg 17, 8807 Freienbach, Schweiz.
              Kontakt: <a className="link-gold" href="mailto:info@immo-traeum.li">info@immo-traeum.li</a> · <a className="link-gold" href="tel:+41446877134">044 687 71 34</a>.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl text-gold-light mb-2">2. Welche Daten wir bearbeiten</h2>
            <ul className="list-disc pl-6 space-y-1 text-sm">
              <li><strong>Kontakt-/Anfrageformular:</strong> Firma, Name, Adresse, PLZ/Ort, Telefon, E-Mail, Betreff, Mitteilung.</li>
              <li><strong>Bewertungs-Wizard:</strong> Ihre Eingaben zu Objekt-Typ, Fläche, Zustand, Standort, Baujahr etc.</li>
              <li><strong>KI-Assistent (Chat):</strong> Die von Ihnen eingegebenen Nachrichten und daraus generierte Antworten.</li>
              <li><strong>Server-Logs:</strong> IP-Adresse, User-Agent, Zeitstempel, aufgerufene URL — zur Betriebssicherheit und Missbrauchsabwehr.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl text-gold-light mb-2">3. Zwecke der Bearbeitung</h2>
            <p className="text-sm">
              Beantwortung von Anfragen, Erstellen unverbindlicher Bewertungen, Betrieb und
              Verbesserung der Website, Erfüllung vertraglicher und gesetzlicher Pflichten.
              Wir bearbeiten Daten nur so lange, wie es für den jeweiligen Zweck erforderlich ist,
              höchstens jedoch 10 Jahre nach dem letzten Kontakt.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl text-gold-light mb-2">4. Auftragsbearbeiter und Bekanntgabe ins Ausland</h2>
            <p className="text-sm">Wir arbeiten mit sorgfältig ausgewählten Dienstleistern:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1 text-sm">
              <li><strong>Hosting</strong> — Emergent (Betrieb der Website und der Anfragen-API).</li>
              <li><strong>KI-Antworten im Chat und in Bewertungskommentaren</strong> — Anthropic (USA).
                Ihre Eingaben werden zur Generierung der Antwort an den LLM-Anbieter übermittelt. Die USA
                verfügen über einen anerkannten Angemessenheitsbeschluss (Swiss-U.S. Data Privacy Framework).
                <strong className="text-gold-light"> Bitte geben Sie im Chat keine sensiblen Personendaten
                (Gesundheit, Religion, politische Meinung, Finanzsituation im Detail o. ä.) ein.</strong>
              </li>
            </ul>
            <p className="text-sm mt-3">
              Fonts (Fraunces, Inter), das 3D-Gebäudemodell und der Draco-Decoder werden ausschliesslich
              vom eigenen Server ausgeliefert — es findet <strong>keine Übermittlung an Google oder andere
              Dritte</strong> beim Seitenaufruf statt.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl text-gold-light mb-2">5. Cookies, Tracking, Analytics</h2>
            <p className="text-sm">
              Wir setzen <strong>keine</strong> Analyse-Tools, Werbenetzwerke oder Tracking-Cookies ein.
              Wir verwenden ausschliesslich technisch notwendigen lokalen Speicher (z. B. für die
              Theme-Auswahl dunkel/hell und die Chat-Sitzungs-ID). Es werden keine externen CDNs für Fonts,
              Bilder oder 3D-Daten aufgerufen.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl text-gold-light mb-2">6. Ihre Rechte</h2>
            <p className="text-sm">
              Sie haben jederzeit das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung und
              Datenherausgabe. Wenden Sie sich dafür an{" "}
              <a className="link-gold" href="mailto:info@immo-traeum.li">info@immo-traeum.li</a>.
              Zudem können Sie sich beim Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten (EDÖB)
              beschweren.
            </p>
          </section>

          <section className="pt-4 border-t border-gold/15">
            <p className="text-xs text-white/50">
              Impressum: siehe <Link to="/impressum" className="link-gold">Impressum</Link>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
