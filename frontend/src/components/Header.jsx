import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { Sun, Moon, Menu, X } from "lucide-react";
import { useTheme } from "@/lib/useTheme";
import Crest, { useCrestExists } from "@/components/Crest";

const NAV = [
  { id: "leistungen", label: "Leistungen" },
  { id: "objekte", label: "Objekte" },
  { id: "bewertung", label: "Bewertung" },
  { id: "relocation", label: "Relocation & Erbe" },
  { id: "beteiligungen", label: "Beteiligungen" },
  { id: "kontakt", label: "Kontakt" },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const loc = useLocation();
  const hasCrest = useCrestExists();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    // Body scroll lock while overlay open
    if (menuOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const isHome = loc.pathname === "/";

  const scrollTo = (id) => (e) => {
    e.preventDefault();
    setMenuOpen(false);
    if (!isHome) {
      window.location.href = `/#${id}`;
      return;
    }
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <motion.header
      data-testid="site-header"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`fixed top-0 inset-x-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-500 ${
        scrolled || menuOpen
          ? "backdrop-blur-xl bg-[color:var(--navy)]/70 border-b border-[color:var(--gold)]/20"
          : "backdrop-blur-md bg-transparent border-b border-transparent"
      }`}
      style={{ WebkitBackdropFilter: (scrolled || menuOpen) ? "blur(20px)" : "blur(8px)" }}
    >
      <div className="max-w-[1400px] mx-auto px-4 md:px-10 h-16 md:h-20 flex items-center justify-between gap-3">
        <Link to="/" data-testid="brand-link" className="group flex items-center gap-2 md:gap-3 min-w-0" onClick={() => setMenuOpen(false)}>
          <Crest variant="header" />
          {!hasCrest && (
            <svg width="24" height="24" viewBox="0 0 28 28" className="text-gold shrink-0 md:w-7 md:h-7">
              <path d="M4 20 L14 6 L24 20 Z" fill="none" stroke="currentColor" strokeWidth="1.2"/>
              <circle cx="14" cy="14" r="1.6" fill="currentColor"/>
            </svg>
          )}
          <div className="leading-tight min-w-0">
            <div className="font-serif text-[15px] md:text-[18px] font-light tracking-tight text-white dark:text-white whitespace-nowrap">
              Immo Traeum <span className="text-gold">AG</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-gold-light/70 hidden xl:block whitespace-nowrap">Real Estate Curators</div>
          </div>
        </Link>

        <nav className="hidden xl:flex items-center gap-8">
          {NAV.map(n => (
            <a
              key={n.id}
              href={`#${n.id}`}
              onClick={scrollTo(n.id)}
              data-testid={`nav-${n.id}`}
              className="text-[13px] uppercase tracking-[0.18em] text-white/80 hover:text-gold-light transition-colors whitespace-nowrap"
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <button
            onClick={toggle}
            data-testid="theme-toggle"
            aria-label="Farbschema wechseln"
            className="h-9 w-9 rounded-full glass flex items-center justify-center text-gold hover:text-gold-light transition-colors shrink-0"
          >
            {theme === "dark" ? <Sun size={16} strokeWidth={1.5}/> : <Moon size={16} strokeWidth={1.5}/>}
          </button>
          <a
            href="#kontakt"
            onClick={scrollTo("kontakt")}
            data-testid="header-cta"
            className="hidden xl:inline-flex items-center h-9 px-4 rounded-full btn-gold text-[12px] font-medium uppercase tracking-[0.16em] whitespace-nowrap"
          >
            Gespräch anfragen
          </a>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            data-testid="menu-toggle"
            aria-label={menuOpen ? "Menü schliessen" : "Menü öffnen"}
            aria-expanded={menuOpen}
            className="xl:hidden h-9 w-9 rounded-full glass flex items-center justify-center text-gold hover:text-gold-light transition-colors shrink-0"
          >
            {menuOpen ? <X size={18} strokeWidth={1.5}/> : <Menu size={18} strokeWidth={1.5}/>}
          </button>
        </div>
      </div>

      {/* Hamburger overlay — Mobile + Tablet + kleines Laptop (< xl) */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="xl:hidden absolute top-full inset-x-0 border-t border-[color:var(--gold)]/15 backdrop-blur-xl"
            style={{ backgroundColor: "rgba(10, 20, 40, 0.96)", WebkitBackdropFilter: "blur(20px)" }}
            data-testid="mobile-menu"
          >
            <nav className="max-w-[1400px] mx-auto px-4 md:px-10 py-4 flex flex-col">
              {NAV.map((n) => (
                <a
                  key={n.id}
                  href={`#${n.id}`}
                  onClick={scrollTo(n.id)}
                  data-testid={`mobile-nav-${n.id}`}
                  className="py-3 text-[13px] uppercase tracking-[0.2em] text-white/85 hover:text-gold-light transition-colors border-b border-white/5 last:border-0 whitespace-nowrap"
                >
                  {n.label}
                </a>
              ))}
              <a
                href="#kontakt"
                onClick={scrollTo("kontakt")}
                data-testid="mobile-cta"
                className="mt-4 inline-flex items-center justify-center h-11 px-6 rounded-full btn-gold text-[12px] font-medium uppercase tracking-[0.18em] whitespace-nowrap"
              >
                Gespräch anfragen
              </a>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
