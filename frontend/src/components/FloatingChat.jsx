import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send } from "lucide-react";
import { API } from "@/lib/api";

const QUICK = [
  "Was ist meine Immobilie wert?",
  "Freie Mietobjekte",
  "Hilfe bei Erbteilung",
  "Relocation für Mitarbeitende",
];

export default function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Grüezi. Ich bin der digitale Berater der Immo Traeum AG. Wie darf ich helfen?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [visible, setVisible] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // Reveal only after the user has scrolled past the hero CTAs (or after 6s idle).
  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 120) { setVisible(true); window.removeEventListener("scroll", onScroll); }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const t = setTimeout(() => setVisible(true), 6000);
    return () => { window.removeEventListener("scroll", onScroll); clearTimeout(t); };
  }, []);

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: msg }, { role: "assistant", content: "" }]);
    setLoading(true);
    try {
      const res = await fetch(`${API}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: msg }),
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop();
        for (const p of parts) {
          const line = p.trim();
          if (!line.startsWith("data:")) continue;
          try {
            const json = JSON.parse(line.slice(5).trim());
            if (json.type === "delta") {
              setMessages(prev => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: (copy[copy.length - 1].content || "") + json.content };
                return copy;
              });
            } else if (json.type === "error") {
              setMessages(prev => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: "Entschuldigung, im Moment nicht erreichbar. Bitte kontaktieren Sie uns direkt: 044 687 71 34." };
                return copy;
              });
            }
          } catch {}
        }
      }
    } catch (e) {
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: "Verbindung unterbrochen. Bitte erneut versuchen." };
        return copy;
      });
    } finally { setLoading(false); }
  };

  return (
    <>
      {/* Orb button */}
      <motion.button
        aria-label="AI-Berater öffnen"
        onClick={() => setOpen(v => !v)}
        data-testid="chat-toggle"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: visible || open ? 1 : 0, opacity: visible || open ? 1 : 0 }}
        transition={{ duration: 0.4, type: "spring" }}
        className="fixed z-[70] h-13 w-13 md:h-14 md:w-14 rounded-full flex items-center justify-center"
        style={{
          width: "clamp(48px, 13vw, 56px)",
          height: "clamp(48px, 13vw, 56px)",
          right: "calc(1rem + env(safe-area-inset-right, 0px))",
          bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
          background: "radial-gradient(circle at 30% 30%, #E6D3A8 0%, #C9A96E 55%, #7a5c2a 100%)",
          boxShadow: "0 12px 40px rgba(201,169,110,0.55), 0 0 0 1px rgba(255,255,255,0.15) inset, 0 0 80px rgba(201,169,110,0.3)",
          pointerEvents: visible || open ? "auto" : "none",
        }}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X size={20} strokeWidth={1.5} className="text-navy"/>
            </motion.span>
          ) : (
            <motion.span key="orb" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="font-serif text-navy font-medium">
              iT
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            data-testid="chat-panel"
            className="fixed z-[69] rounded-2xl glass-strong flex flex-col overflow-hidden"
            style={{
              right: "max(0.75rem, env(safe-area-inset-right, 0px))",
              left: "max(0.75rem, env(safe-area-inset-left, 0px))",
              bottom: "calc(6rem + env(safe-area-inset-bottom, 0px))",
              maxHeight: "min(70dvh, 600px)",
              maxWidth: "400px",
              marginLeft: "auto",
            }}
          >
            <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-gold/15">
              <div>
                <div className="text-[10px] uppercase tracking-[0.28em] text-gold">Digitaler Berater</div>
                <div className="font-serif text-lg font-light tracking-tight text-white">Immo Traeum · AI</div>
              </div>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/50">
                <span className="pulse-dot"/> Online
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-gold text-navy rounded-br-sm"
                      : "bg-white/6 text-white border border-gold/20 rounded-bl-sm"
                  }`}>
                    {m.content || (loading && i === messages.length - 1 ? <span className="inline-flex gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-gold-light animate-pulse"/>
                      <span className="h-1.5 w-1.5 rounded-full bg-gold-light animate-pulse" style={{ animationDelay: "150ms" }}/>
                      <span className="h-1.5 w-1.5 rounded-full bg-gold-light animate-pulse" style={{ animationDelay: "300ms" }}/>
                    </span> : null)}
                  </div>
                </div>
              ))}
              <div ref={bottomRef}/>
            </div>

            {messages.length < 3 && (
              <div className="px-4 pb-2 flex flex-wrap gap-2">
                {QUICK.map(q => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    data-testid={`chat-quick-${q}`}
                    className="text-[11px] px-3 py-1.5 rounded-full border border-gold/30 text-gold-light hover:bg-gold/10 transition-colors"
                  >{q}</button>
                ))}
              </div>
            )}

            <form
              onSubmit={(e) => { e.preventDefault(); send(); }}
              className="p-3 border-t border-gold/15 flex items-center gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ihre Frage…"
                data-testid="chat-input"
                className="flex-1 bg-transparent text-sm text-white placeholder-white/40 outline-none px-2"
              />
              <button type="submit" disabled={loading || !input.trim()} data-testid="chat-send" className="h-9 w-9 rounded-full btn-gold flex items-center justify-center disabled:opacity-50">
                <Send size={14} className="text-navy"/>
              </button>
            </form>
            <div className="px-3 pb-2 text-[10px] text-white/40 tracking-tight text-center">
              KI-Assistent · keine sensiblen Daten eingeben · <a href="/datenschutz" className="link-gold" data-testid="chat-privacy-link">Datenschutz</a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
