import { Header } from "../components/Header";
import { Hero } from "../sections/Hero";
import { Marquee } from "../sections/Marquee";
import { ValueSection } from "../sections/ValueSection";
import { HowItWorks } from "../sections/HowItWorks";
import { GameModes } from "../sections/GameModes";
import { TrustSection } from "../sections/TrustSection";
import { PrivateLeagues } from "../sections/PrivateLeagues";
import { Markets } from "../sections/Markets";
import { Rules, FAQ } from "../sections/RulesAndFAQ";
import { Newsletter } from "../sections/Newsletter";
import { Contact } from "../sections/Contact";
import { FinalCTA } from "../sections/FinalCTA";
import { Footer } from "../sections/Footer";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-bg-base text-ink overflow-x-clip" data-testid="app-root">
      <Header />
      <main>
        <Hero />
        <Marquee />
        <ValueSection />
        <HowItWorks />
        <GameModes />
        <TrustSection />
        <PrivateLeagues />
        <Markets />
        <Rules />
        <FAQ />
        <Newsletter />
        <Contact />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
