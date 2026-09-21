import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

export default function Hero() {
  const containerRef = useRef(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end start"] });
  const yImg = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const yOverlay = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const opacityContent = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  useEffect(() => {
    const onMove = (e) => {
      const w = window.innerWidth, h = window.innerHeight;
      setMouse({ x: (e.clientX - w / 2) / w, y: (e.clientY - h / 2) / h });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const scrollTo = (id) => (e) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const [hasVideo, setHasVideo] = useState(false);
  useEffect(() => {
    fetch("/media/hero.mp4", { method: "HEAD" }).then(r => setHasVideo(r.ok)).catch(() => setHasVideo(false));
  }, []);

  return (
    <section
      id="hero"
      ref={containerRef}
      data-testid="hero-section"
      className="relative w-full h-[100svh] min-h-[640px] overflow-hidden bg-navy"
    >
      {/* Background image with Ken-Burns + parallax + mouse */}
      <motion.div
        className="absolute inset-0"
        style={{ y: yImg, transform: `translate3d(${mouse.x * -18}px, ${mouse.y * -12}px, 0)` }}
      >
        <picture>
          <source type="image/avif" srcSet="/media/hero-2400.avif" />
          <source
            type="image/webp"
            srcSet="/media/hero-800.webp 800w, /media/hero-1600.webp 1600w, /media/hero-2400.webp 2400w"
            sizes="100vw"
          />
          <img
            src="/media/hero-1600.webp"
            alt="Bodensee bei Blauer Stunde — Immo Traeum AG"
            fetchpriority="high"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover animate-kenBurns"
          />
        </picture>
        {hasVideo && (
          <video
            src="/media/hero.mp4"
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
      </motion.div>

      {/* Dark gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-navy/50 via-navy/20 to-navy" />
      <div className="absolute inset-0 bg-gradient-to-r from-navy/70 via-transparent to-transparent" />

      {/* SVG Gold parcel overlay */}
      <motion.svg
        viewBox="0 0 1600 900"
        className="absolute inset-0 w-full h-full pointer-events-none"
        preserveAspectRatio="xMidYMid slice"
        style={{ y: yOverlay }}
      >
        <defs>
          <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E6D3A8"/>
            <stop offset="100%" stopColor="#C9A96E"/>
          </linearGradient>
        </defs>
        <g className="glow-parcel">
          <polygon
            className="draw-parcel"
            points="820,420 1020,380 1120,470 1080,600 880,640 780,540"
            fill="rgba(201,169,110,0.08)"
            stroke="url(#goldGrad)"
            strokeWidth="1.6"
          />
          <circle cx="820" cy="420" r="3" fill="#E6D3A8"/>
          <circle cx="1020" cy="380" r="3" fill="#E6D3A8"/>
          <circle cx="1120" cy="470" r="3" fill="#E6D3A8"/>
          <circle cx="1080" cy="600" r="3" fill="#E6D3A8"/>
          <circle cx="880" cy="640" r="3" fill="#E6D3A8"/>
          <circle cx="780" cy="540" r="3" fill="#E6D3A8"/>
        </g>
      </motion.svg>

      {/* Label pins */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 3.4, duration: 0.9, ease: "easeOut" }}
        className="hidden md:block absolute top-[38%] right-[16%]"
      >
        <div className="glass px-3 py-1.5 rounded-full text-[11px] uppercase tracking-[0.2em] text-gold-light">
          Rorschach · 9400
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 3.7, duration: 0.9, ease: "easeOut" }}
        className="hidden md:block absolute top-[62%] right-[10%]"
      >
        <div className="glass px-3 py-1.5 rounded-full text-[11px] uppercase tracking-[0.2em] text-gold-light">
          Bewertet · CHF —
        </div>
      </motion.div>

      {/* Content */}
      <motion.div
        style={{ opacity: opacityContent }}
        className="relative z-10 h-full flex flex-col justify-center max-w-[1400px] mx-auto px-6 md:px-10"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.9, ease: "easeOut" }}
          className="max-w-3xl"
        >
          <div className="flex items-center gap-3 mb-6">
            <span className="w-8 h-px bg-gold"/>
            <span className="text-[11px] uppercase tracking-[0.32em] text-gold">Real Estate · Bodensee &amp; Alpen</span>
          </div>
          <h1 data-testid="hero-title" className="font-serif font-light tracking-tight text-white leading-[0.98] text-[42px] sm:text-[64px] md:text-[84px] lg:text-[104px]">
            Traumhaftes<br/>
            <span className="italic text-gold-light">Immobilien-</span><br/>
            <span className="text-gold">management.</span>
          </h1>
          <p className="mt-8 max-w-xl text-base md:text-lg text-white/80 leading-relaxed font-light">
            <span className="text-gold-light">Bewerten. Bewirtschaften. Beraten.</span><br/>
            Diskret, präzise und persönlich — zwischen Bodensee und Alpen.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href="#bewertung"
              onClick={scrollTo("bewertung")}
              data-testid="hero-cta-bewertung"
              className="inline-flex items-center gap-2 h-12 px-6 rounded-full btn-gold text-sm font-medium uppercase tracking-[0.14em]"
            >
              Immobilie bewerten
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8h11m0 0-4-4m4 4-4 4" stroke="currentColor" strokeWidth="1.4"/></svg>
            </a>
            <a
              href="#objekte"
              onClick={scrollTo("objekte")}
              data-testid="hero-cta-objekte"
              className="inline-flex items-center gap-2 h-12 px-6 rounded-full btn-ghost text-sm font-medium uppercase tracking-[0.14em]"
            >
              Verfügbare Objekte
            </a>
          </div>
        </motion.div>
      </motion.div>

      {/* Bottom stats bar */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.4, duration: 0.9, ease: "easeOut" }}
        className="absolute bottom-6 md:bottom-8 inset-x-0 z-10"
      >
        <div className="max-w-[1400px] mx-auto px-6 md:px-10">
          <div className="glass rounded-full px-5 md:px-8 py-3 md:py-4 flex flex-wrap items-center justify-between gap-4">
            <Stat label="Mitgliedschaft" value="SIV" />
            <Sep/>
            <Stat label="Verbund" value="SIV · Casafair" />
            <Sep/>
            <Stat label="Regionen" value="Ostschweiz · Zentralschweiz · FL" />
            <Sep className="hidden md:inline-flex"/>
            <div className="hidden md:flex items-center gap-3 text-white/70">
              <span className="text-[10px] uppercase tracking-[0.28em] text-gold">Scroll</span>
              <span className="w-8 h-px bg-gold/50"/>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

const Stat = ({ label, value }) => (
  <div className="flex items-center gap-3">
    <span className="text-[10px] uppercase tracking-[0.28em] text-gold">{label}</span>
    <span className="font-serif text-sm md:text-base font-light text-white tracking-tight">{value}</span>
  </div>
);
const Sep = ({ className = "" }) => <span className={`w-px h-4 bg-gold/25 ${className}`} />;
