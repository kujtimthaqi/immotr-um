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
 * Options:
 *  - containerRef: observe this element for visibility instead of the video itself
 *  - forceLoad: call video.load() before play() (needed when preload=none)
 */
export function useAutoPlayVideo({ threshold = 0.6, enabled = true, containerRef = null, forceLoad = false } = {}) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const target = (containerRef && containerRef.current) || ref.current;
    if (!target) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => setInView(e.intersectionRatio >= threshold));
    }, { threshold: [0, threshold * 0.5, threshold, 1] });
    obs.observe(target);
    return () => obs.disconnect();
  }, [threshold, containerRef]);

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
      if (forceLoad) { try { v.load(); } catch (_) {} }
      const p = v.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => setBlocked(true));
      }
    } else {
      try { v.pause(); } catch (_) {}
    }
  }, [inView, enabled, forceLoad]);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      if (forceLoad) { try { v.load(); } catch (_) {} }
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => setBlocked(true));
      else setBlocked(false);
    } else {
      v.pause();
    }
  };

  return { ref, playing, blocked, toggle };
}
