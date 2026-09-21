import { useEffect, useState } from "react";

// Cache the availability check across renders/pages
let crestState = { checked: false, exists: false };
const CREST_SRC = "/brand/wappen.png";

async function checkCrestExists() {
  try {
    const r = await fetch(CREST_SRC, { method: "HEAD" });
    if (!r.ok) return false;
    const ct = r.headers.get("content-type") || "";
    // Guard against SPA catch-all that returns index.html for missing static files
    return ct.startsWith("image/");
  } catch {
    return false;
  }
}

/**
 * <Crest/> — Family crest (Wappen) placeholder.
 * Renders <img src="/brand/wappen.png" ...> only if the file exists at runtime.
 * When the file is missing (default), the component renders nothing — no fabricated placeholder.
 *
 * Sizes (per design):
 *  - variant="header"  -> 32-36px
 *  - variant="hero"    -> 44px + champagne glow
 *  - variant="trust"   -> 84-120px (paired with "Immo Traeum AG" seal text)
 *  - variant="footer"  -> 56px @ 60% opacity
 */
/**
 * useCrestExists — returns true if /brand/wappen.png exists.
 * Used to conditionally hide the fallback logo icon in Header.
 */
export function useCrestExists() {
  const [exists, setExists] = useState(crestState.exists);
  useEffect(() => {
    if (crestState.checked) { setExists(crestState.exists); return; }
    let alive = true;
    checkCrestExists().then(ok => {
      crestState = { checked: true, exists: ok };
      if (alive) setExists(ok);
    });
    return () => { alive = false; };
  }, []);
  return exists;
}

export default function Crest({ variant = "header", className = "", alt = "Familienwappen Immo Traeum" }) {
  const [exists, setExists] = useState(crestState.exists);
  const [checked, setChecked] = useState(crestState.checked);

  useEffect(() => {
    if (crestState.checked) return;
    let alive = true;
    checkCrestExists().then(ok => {
      crestState = { checked: true, exists: ok };
      if (alive) { setExists(ok); setChecked(true); }
    });
    return () => { alive = false; };
  }, []);

  if (!checked || !exists) return null;

  const sizes = {
    header: "h-8 md:h-9 w-auto",                     // 32-36px
    hero:   "h-11 w-auto",                            // 44px
    trust:  "h-20 md:h-[120px] w-auto",               // 84-120px
    footer: "h-14 w-auto opacity-60",                 // 56px @ 60%
  };
  const glowClass = variant === "hero"
    ? "drop-shadow-[0_0_18px_rgba(230,211,168,0.55)]"
    : variant === "trust"
      ? "drop-shadow-[0_0_28px_rgba(201,169,110,0.35)]"
      : "";

  return (
    <img
      src={CREST_SRC}
      alt={alt}
      loading="lazy"
      decoding="async"
      data-testid={`crest-${variant}`}
      className={`${sizes[variant] || sizes.header} ${glowClass} ${className} select-none pointer-events-none`}
    />
  );
}
