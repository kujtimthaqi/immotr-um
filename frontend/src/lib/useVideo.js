import { useEffect, useRef, useState } from "react";

// Global: only one <video> plays at a time (battery + data).
let currentPlaying = null;
const listeners = new Set();
function setCurrent(v) {
  if (currentPlaying && currentPlaying !== v) {
    try { currentPlaying.pause(); } catch (_) {}
  }
  currentPlaying = v;
  listeners.forEach(fn => fn(v));
}

export function usePrefersSaveMotion() {
  const [flag, setFlag] = useState(false);
  useEffect(() => {
    const mm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const conn = navigator.connection || {};
    const check = () => setFlag(mm.matches || !!conn.saveData);
    check();
    mm.addEventListener?.("change", check);
    conn.addEventListener?.("change", check);
    return () => {
      mm.removeEventListener?.("change", check);
      conn.removeEventListener?.("change", check);
    };
  }, []);
  return flag;
}

/**
 * useAutoPlayVideo — auto-play/pause when in viewport, tap toggles, only one at a time.
 * Returns: { ref, playing, canPlay, blocked, toggle }
 */
export function useAutoPlayVideo({ threshold = 0.6, enabled = true } = {}) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => setInView(e.intersectionRatio >= threshold));
    }, { threshold: [0, threshold, 1] });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  useEffect(() => {
    const v = ref.current;
    if (!v || !enabled) return;
    const onPlay = () => { setPlaying(true); setCurrent(v); };
    const onPause = () => setPlaying(false);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      if (currentPlaying === v) currentPlaying = null;
    };
  }, [enabled]);

  useEffect(() => {
    const v = ref.current;
    if (!v || !enabled) return;
    if (inView) {
      const p = v.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => setBlocked(true));
      }
    } else {
      try { v.pause(); } catch (_) {}
    }
  }, [inView, enabled]);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => setBlocked(true));
      else setBlocked(false);
    } else {
      v.pause();
    }
  };

  return { ref, playing, blocked, toggle };
}
