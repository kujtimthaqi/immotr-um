import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Crest from "@/components/Crest";
import { usePrefersSaveMotion } from "@/lib/useVideo";
import { Play } from "lucide-react";

export default function Hero() {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [videoReady, setVideoReady] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  const [blocked, setBlocked] = useState(false);
  const reduced = usePrefersSaveMotion();

  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end start"] });
  const yImg = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const yOverlay = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const opacityContent = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    const onMove = (e) => {
      const w = window.innerWidth, h = window.innerHeight;
      setMouse({ x: (e.clientX - w / 2) / w, y: (e.clientY - h / 2) / h });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => { window.removeEventListener("resize", check); window.removeEventListener("mousemove", onMove); };
  }, []);

  // Auto play/pause on visibility
  useEffect(() => {
    const v = videoRef.current;
    if (!v || reduced) return;
    const onVis = () => {
      if (document.visibilityState !== "visible") v.pause();
      else if (!blocked) v.play().catch(() => setBlocked(true));
    };
    document.addEventListener("visibilitychange", onVis);
    // Try to play once metadata is available
    const tryPlay = () => {
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => setBlocked(true));
    };
    v.addEventListener("loadedmetadata", tryPlay, { once: true });
    return () => { document.removeEventListener("visibilitychange", onVis); v.removeEventListener("loadedmetadata", tryPlay); };
  }, [reduced, blocked]);

  const manualPlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.play().then(() => setBlocked(false)).catch(() => {});
  };

  const scrollTo = (id) => (e) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const useVideo = !reduced;
  const videoSrcMp4 = isMobile ? "/media/hero-mobile.mp4" : "/media/hero.mp4";
  const videoSrcWebm = isMobile ? "/media/hero-mobile.webm" : "/media/hero.webm";

  return (
    <section
      id="hero"
      ref={containerRef}
      data-testid="hero-section"
      className="relative w-full min-h-[100svh] md:min-h-[720px] overflow-hidden bg-navy"
    >
      {/* Background: poster + video */}
      <motion.div
        className="absolute inset-0"
        style={{ y: yImg, transform: `translate3d(${mouse.x * -14}px, ${mouse.y * -10}px, 0)` }}
      >
        {/* Poster – always present. Ken-Burns only while video not ready. */}
        <picture>
          <source
            type="image/avif"
            srcSet="/media/hero-poster-800.avif 800w, /media/hero-poster-1600.avif 1600w, /media/hero-poster-2400.avif 2400w, /media/hero-poster-3200.avif 3200w"
            sizes="100vw"
          />
          <source
            type="image/webp"
            srcSet="/media/hero-poster-800.webp 800w, /media/hero-poster-1600.webp 1600w, /media/hero-poster-2400.webp 2400w, /media/hero-poster-3200.webp 3200w"
            sizes="100vw"
          />
          <img
            src="/media/hero-poster-1600.webp"
            alt="Bodensee bei Blauer Stunde — Immo Traeum AG"
            fetchpriority="high"
            decoding="async"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[900ms] ${videoReady ? "opacity-0" : "opacity-100"} ${!videoReady ? "animate-kenBurnsSubtle" : ""}`}
          />
        </picture>

        {useVideo && (
          <video
            ref={videoRef}
            poster="/media/hero-poster-1600.webp"
            autoPlay
            muted
            loop
            playsInline
            /* eslint-disable-next-line react/no-unknown-property */
            webkit-playsinline="true"
            disablePictureInPicture
            preload="metadata"
            onPlaying={() => setVideoReady(true)}
            onCanPlay={() => setVideoReady(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[900ms] ${videoReady ? "opacity-100" : "opacity-0"}`}
          >
            <source src={videoSrcMp4} type="video/mp4" />
            <source src={videoSrcWebm} type="video/webm" />
          </video>
        )}
        {blocked && (
          <button
            onClick={manualPlay}
            data-testid="hero-play"
            aria-label="Video abspielen"
            className="absolute inset-0 m-auto w-16 h-16 rounded-full btn-gold flex items-center justify-center z-20"
            style={{ top: "auto", bottom: "22%" }}
          >
            <Play size={22} strokeWidth={1.5} className="text-navy translate-x-0.5"/>
          </button>
        )}
      </motion.div>

      {/* Dark gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-navy/45 via-transparent to-navy" />
      <div className="absolute inset-0 bg-gradient-to-r from-navy/70 via-navy/10 to-transparent" />

      {/* HUD scan line + refined SVG (no big polygon over the video's own gold parcel) */}
      <motion.svg
        viewBox="0 0 1600 900"
        className="absolute inset-0 w-full h-full pointer-events-none hidden md:block"
        preserveAspectRatio="xMidYMid slice"
        style={{ y: yOverlay }}
      >
        <defs>
          <linearGradient id="scanGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(201,169,110,0)"/>
            <stop offset="50%" stopColor="rgba(230,211,168,0.55)"/>
            <stop offset="100%" stopColor="rgba(201,169,110,0)"/>
          </linearGradient>
        </defs>
        {/* Vertical golden hairline */}
        <line x1="50%" y1="0" x2="50%" y2="100%" stroke="rgba(201,169,110,0.18)" strokeWidth="0.5"/>
        {/* Horizontal scan line, animated */}
        <line x1="0" y1="60%" x2="100%" y2="60%" stroke="url(#scanGrad)" strokeWidth="0.75">
          <animate attributeName="y1" values="20%;80%;20%" dur="9s" repeatCount="indefinite" />
          <animate attributeName="y2" values="20%;80%;20%" dur="9s" repeatCount="indefinite" />
        </line>
        {/* Corner brackets */}
        <g stroke="rgba(201,169,110,0.55)" strokeWidth="1" fill="none">
          <path d="M40,40 L40,80 M40,40 L80,40" />
          <path d="M1560,40 L1560,80 M1560,40 L1520,40" />
          <path d="M40,860 L40,820 M40,860 L80,860" />
          <path d="M1560,860 L1560,820 M1560,860 L1520,860" />
        </g>
      </motion.svg>

      {/* HUD label pins */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6, duration: 0.9, ease: "easeOut" }}
        className="hidden md:flex absolute top-[26%] right-[10%] items-center gap-2"
      >
        <span className="w-6 h-px bg-gold"/>
        <div className="glass px-3 py-1.5 rounded-full text-[11px] uppercase tracking-[0.22em] text-gold-light">
          Rorschach · 9400
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.0, duration: 0.9, ease: "easeOut" }}
        className="hidden md:flex absolute top-[68%] right-[7%] items-center gap-2"
      >
        <span className="w-6 h-px bg-gold"/>
        <div className="glass px-3 py-1.5 rounded-full text-[11px] uppercase tracking-[0.22em] text-gold-light">
          Bewertet · CHF —
        </div>
      </motion.div>

      {/* Content */}
      <motion.div
        style={{ opacity: opacityContent }}
        className="relative z-10 min-h-[100svh] flex flex-col justify-center max-w-[1400px] mx-auto px-6 md:px-10 py-24 md:py-28 xl:py-0"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.9, ease: "easeOut" }}
          className="max-w-3xl"
        >
          <Crest variant="hero" className="mb-4" />
          <div className="flex items-center gap-3 mb-6 max-w-full">
            <span className="w-6 md:w-8 h-px bg-gold shrink-0"/>
            <span className="text-[10px] md:text-[11px] uppercase tracking-[0.18em] md:tracking-[0.32em] text-gold whitespace-nowrap">
              <span className="md:hidden">Bodensee · Alpen</span>
              <span className="hidden md:inline">Real Estate · Bodensee &amp; Alpen</span>
            </span>
          </div>
          <h1 data-testid="hero-title" className="font-serif font-light tracking-tight text-white leading-[0.98] text-[42px] sm:text-[64px] md:text-[84px] lg:text-[104px]">
            Traumhaftes<br/>
            <span className="italic text-gold-light">Immobilien-</span><br/>
            <span className="text-gold">management.</span>
          </h1>
          <p className="mt-8 max-w-xl text-base md:text-lg text-white/85 leading-relaxed font-light">
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

          {/* Inline Stats-Bar (Tablet & kleines Laptop — 768…1279 px).
              Auf xl+ nicht rendern, dort wird die absolute Version unten benutzt. */}
          <div className="hidden md:block xl:hidden mt-10">
            <div className="glass rounded-full px-5 md:px-8 py-3 md:py-4 flex flex-wrap items-center gap-x-6 gap-y-2" data-testid="hero-stats-inline">
              <Stat label="Mitgliedschaft" value="SIV" />
              <Sep/>
              <Stat label="Verbund" value="SIV · Casafair" />
              <Sep/>
              <Stat label="Regionen" value="Ostschweiz · Zentralschweiz · FL" />
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Bottom stats bar — nur Desktop ≥ xl (1280 px+).
          Kleinere Viewports haben die In-Flow-Version im Content-Block. */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.4, duration: 0.9, ease: "easeOut" }}
        className="hidden xl:block absolute bottom-8 inset-x-0 z-10"
      >
        <div className="max-w-[1400px] mx-auto px-6 md:px-10">
          <div className="glass rounded-full px-5 md:px-8 py-3 md:py-4 flex flex-wrap items-center justify-between gap-4">
            <Stat label="Mitgliedschaft" value="SIV" />
            <Sep/>
            <Stat label="Verbund" value="SIV · Casafair" />
            <Sep/>
            <Stat label="Regionen" value="Ostschweiz · Zentralschweiz · FL" />
            <Sep/>
            <div className="flex items-center gap-3 text-white/70">
              <span className="text-[10px] uppercase tracking-[0.28em] text-gold">Scroll</span>
              <span className="w-8 h-px bg-gold/50"/>
            </div>
          </div>
        </div>
      </motion.div>

      <style>{`
        @keyframes kenBurnsSubtle {
          0% { transform: scale(1.05) translate3d(0, 0, 0); }
          100% { transform: scale(1.0) translate3d(-0.5%, -0.5%, 0); }
        }
        .animate-kenBurnsSubtle { animation: kenBurnsSubtle 18s ease-out forwards; }
      `}</style>
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
