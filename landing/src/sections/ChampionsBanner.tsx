import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Trophy, ArrowRight, Swords, Star } from "lucide-react";

// Numeri della lega tenuti qui, allineati alla landing /fp-champions-league.
const CHAMPIONS = {
  prizePool: "500€",
  heroImage: "/stadium-hero.png",
  to: "/fp-champions-league",
};

/**
 * Card della Champions League in home, al posto della Super League.
 * Stessa impronta della SuperLeagueBanner (stadio notturno + velatura), con
 * accento a stelle a richiamare la landing dedicata.
 */
export function ChampionsBanner() {
  return (
    <section className="relative pt-24 md:pt-28" data-testid="champions-banner">
      <div className="container-x">
        <Link
          to={CHAMPIONS.to}
          aria-label="Scopri la F.P Champions League"
          className="group block relative overflow-hidden rounded-[28px] md:rounded-[36px] bg-[#050f24] shadow-[0_30px_80px_-24px_rgba(5,15,36,0.55)] ring-1 ring-white/10"
          data-testid="champions-banner-link"
        >
          {/* Sfondo stadio */}
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-[1.03]"
            style={{ backgroundImage: `url(${CHAMPIONS.heroImage})` }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(100deg, rgba(5,15,36,0.94) 0%, rgba(5,15,36,0.78) 45%, rgba(5,15,36,0.45) 100%)",
            }}
          />
          <div className="absolute -top-20 -left-10 w-72 h-56 rounded-full bg-brand-orange/25 blur-[110px]" />

          <div className="relative p-7 sm:p-10 md:p-12 flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
            <div className="flex-1">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-orange/15 border border-brand-orange/40 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-orange">
                  <Star size={12} />
                  Gratis · Arena 1vs1 a premi
                </span>

                <h2 className="mt-4 font-display font-bold text-3xl sm:text-4xl md:text-5xl leading-[0.98] tracking-tightest text-white uppercase">
                  F.P{" "}
                  <span className="text-brand-orange">Champions League</span>
                </h2>

                <div className="mt-4 flex flex-col gap-2 text-sm text-white/80">
                  <span className="inline-flex items-center gap-2 font-semibold text-white">
                    <Trophy size={16} className="text-brand-orange" />
                    {CHAMPIONS.prizePool} in buoni Amazon
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Swords size={15} className="text-brand-orange shrink-0" />
                    Ogni giornata sfidi un avversario 1vs1
                  </span>
                </div>

                <p className="mt-3 text-sm text-white/70 max-w-xl">
                  Pronostica le partite di Champions League e sfida gli altri utenti. Entra gratis.
                </p>
              </motion.div>
            </div>

            {/* CTA */}
            <div className="shrink-0">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-ink shadow-soft transition-transform group-hover:-translate-y-0.5">
                Scopri e gioca gratis
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
}
