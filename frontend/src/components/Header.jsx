import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/useTheme";

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
  const { theme, toggle } = useTheme();
  const loc = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isHome = loc.pathname === "/";

  const scrollTo = (id) => (e) => {
    e.preventDefault();
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
        scrolled
          ? "backdrop-blur-xl bg-[color:var(--navy)]/70 border-b border-[color:var(--gold)]/20"
          : "backdrop-blur-md bg-transparent border-b border-transparent"
      }`}
      style={{ WebkitBackdropFilter: scrolled ? "blur(20px)" : "blur(8px)" }}
    >
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 h-16 md:h-20 flex items-center justify-between">
        <Link to="/" data-testid="brand-link" className="group flex items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 28 28" className="text-gold">
            <path d="M4 20 L14 6 L24 20 Z" fill="none" stroke="currentColor" strokeWidth="1.2"/>
            <circle cx="14" cy="14" r="1.6" fill="currentColor"/>
          </svg>
          <div className="leading-tight">
            <div className="font-serif text-[17px] md:text-[18px] font-light tracking-tight text-white dark:text-white">
              Immo Traeum <span className="text-gold">AG</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-gold-light/70 hidden md:block">Real Estate Curators</div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-8">
          {NAV.map(n => (
            <a
              key={n.id}
              href={`#${n.id}`}
              onClick={scrollTo(n.id)}
              data-testid={`nav-${n.id}`}
              className="text-[13px] uppercase tracking-[0.18em] text-white/80 hover:text-gold-light transition-colors"
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            data-testid="theme-toggle"
            aria-label="Farbschema wechseln"
            className="h-9 w-9 rounded-full glass flex items-center justify-center text-gold hover:text-gold-light transition-colors"
          >
            {theme === "dark" ? <Sun size={16} strokeWidth={1.5}/> : <Moon size={16} strokeWidth={1.5}/>}
          </button>
          <a
            href="#kontakt"
            onClick={scrollTo("kontakt")}
            data-testid="header-cta"
            className="hidden md:inline-flex items-center h-9 px-4 rounded-full btn-gold text-[12px] font-medium uppercase tracking-[0.16em]"
          >
            Gespräch anfragen
          </a>
        </div>
      </div>
    </motion.header>
  );
}
