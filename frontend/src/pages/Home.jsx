import { useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Hero from "@/components/sections/Hero";
import Leistungen from "@/components/sections/Leistungen";
import Objekte from "@/components/sections/Objekte";
import Bewertung from "@/components/sections/Bewertung";
import Relocation from "@/components/sections/Relocation";
import Beteiligungen from "@/components/sections/Beteiligungen";
import Trust from "@/components/sections/Trust";
import Kontakt from "@/components/sections/Kontakt";
import FloatingChat from "@/components/FloatingChat";
import { useLenis } from "@/lib/useLenis";

export default function Home() {
  useLenis();

  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.slice(1);
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 400);
    }
  }, []);

  return (
    <div className="grain vignette relative">
      <Header />
      <main>
        <Hero />
        <Leistungen />
        <Objekte />
        <Bewertung />
        <Relocation />
        <Beteiligungen />
        <Trust />
        <Kontakt />
      </main>
      <Footer />
      <FloatingChat />
    </div>
  );
}
