import { useEffect, useState } from "react";

// Verify with a real Image() preload — a HEAD/content-type check is not enough
// (CDNs/proxies sometimes return image/* headers for 404 pages, causing a broken <img>).
let crestState = { checked: false, exists: false, pending: null };
const CREST_SRC   = "/brand/wappen.png";
const CREST_SRC2X = "/brand/wappen@2x.png";
const CREST_SRC3X = "/brand/wappen@3x.png";

function verifyCrestImage() {
  if (crestState.pending) return crestState.pending;
  crestState.pending = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ok = img.naturalWidth > 0 && img.naturalHeight > 0;
      crestState = { checked: true, exists: ok, pending: null };
      resolve(ok);
    };
    img.onerror = () => {
      crestState = { checked: true, exists: false, pending: null };
      resolve(false);
    };
    img.src = CREST_SRC;
  });
  return crestState.pending;
}

export function useCrestExists() {
  const [exists, setExists] = useState(crestState.checked ? crestState.exists : false);
  useEffect(() => {
    if (crestState.checked) { setExists(crestState.exists); return; }
    let alive = true;
    verifyCrestImage().then(ok => { if (alive) setExists(ok); });
    return () => { alive = false; };
  }, []);
  return exists;
}

/**
 * <Crest/> — Familienwappen Jehli.
 * Renders <img> only after a real Image() load with naturalWidth > 0.
 * When missing/broken: renders nothing (no <img>, no alt text, no placeholder).
 *
 * Sizes per spec:
 *  - header: 32px (mobile) / 38px (desktop)
 *  - hero:   36px (mobile) / 44px (desktop) + champagne glow
 *  - trust:  ~110px + seal text next to it
 *  - footer: 56px @ 60% opacity
 *
 * Dark mode: subtle outer luminance so dark blue/black is readable on navy.
 * Light mode: no glow.
 */
export default function Crest({ variant = "header", className = "", alt = "Familienwappen Jehli · Immo Traeum AG" }) {
  const [exists, setExists] = useState(crestState.checked ? crestState.exists : false);

  useEffect(() => {
    if (crestState.checked) { setExists(crestState.exists); return; }
    let alive = true;
    verifyCrestImage().then(ok => { if (alive) setExists(ok); });
    return () => { alive = false; };
  }, []);

  if (!exists) return null;

  const sizes = {
    header: "h-8 md:h-[38px] w-auto",
    hero:   "h-9 md:h-11 w-auto",
    trust:  "h-[110px] w-auto",
    footer: "h-14 w-auto opacity-60",
  };

  // Dark-mode outer luminance for readability on navy. Light mode overrides in index.css.
  // Hero variant: strong champagne drop-shadow both modes.
  const glowClass =
    variant === "hero"
      ? "drop-shadow-[0_0_18px_rgba(230,211,168,0.55)]"
      : "crest-glow";

  return (
    <img
      src={CREST_SRC}
      srcSet={`${CREST_SRC} 1x, ${CREST_SRC2X} 2x, ${CREST_SRC3X} 3x`}
      alt={alt}
      loading={variant === "header" || variant === "hero" ? "eager" : "lazy"}
      decoding="async"
      data-testid={`crest-${variant}`}
      className={`${sizes[variant] || sizes.header} ${glowClass} ${className} select-none pointer-events-none`}
    />
  );
}
