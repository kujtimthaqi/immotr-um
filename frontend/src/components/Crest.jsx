import { useEffect, useState } from "react";

// Verify with a real Image() preload — a HEAD/content-type check is not enough
// (CDNs/proxies sometimes return image/* headers for 404 pages, causing a broken <img>).
let crestState = { checked: false, exists: false, pending: null };
const CREST_SRC = "/brand/wappen.png";

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
 * <Crest/> — Family crest (Wappen).
 * Renders <img> only after a real Image() load with naturalWidth > 0.
 * When missing/broken: renders nothing (no <img>, no alt text, no placeholder).
 */
export default function Crest({ variant = "header", className = "", alt = "Familienwappen Immo Traeum" }) {
  const [exists, setExists] = useState(crestState.checked ? crestState.exists : false);

  useEffect(() => {
    if (crestState.checked) { setExists(crestState.exists); return; }
    let alive = true;
    verifyCrestImage().then(ok => { if (alive) setExists(ok); });
    return () => { alive = false; };
  }, []);

  if (!exists) return null;

  const sizes = {
    header: "h-8 md:h-9 w-auto",
    hero:   "h-11 w-auto",
    trust:  "h-20 md:h-[120px] w-auto",
    footer: "h-14 w-auto opacity-60",
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
