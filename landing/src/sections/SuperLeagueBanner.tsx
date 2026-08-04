import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Trophy, ArrowRight, Sparkles, CalendarDays } from "lucide-react";
import { SUPER_LEAGUE } from "@/data/superLeague";

export function SuperLeagueBanner() {
  return (
    <section className="relative pt-24 md:pt-28" data-testid="superleague-banner">
      <div className="container-x">
        <Link
          to="/lega"
          aria-label="Scopri la FantaPronostic Super League"
          className="group block relative overflow-hidden rounded-[28px] md:rounded-[36px] bg-[#050f24] shadow-[0_30px_80px_-24px_rgba(5,15,36,0.55)] ring-1 ring-white/10"
          data-testid="superleague-banner-link"
        >
          {/* Sfondo stadio */}
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-[1.03]"
            style={{ backgroundImage: `url(${SUPER_LEAGUE.heroImage})` }}
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
                  <Sparkles size={12} />
                  Novità · Lega ufficiale a premi
                </span>

                <h2 className="mt-4 font-display font-bold text-3xl sm:text-4xl md:text-5xl leading-[0.98] tracking-tightest text-white uppercase">
                  FantaPronostic{" "}
                  <span className="text-brand-orange">Super League</span>
                </h2>

                <div className="mt-4 flex flex-col gap-2 text-sm text-white/80">
                  <span className="inline-flex items-center gap-2 font-semibold text-white">
                    <Trophy size={16} className="text-brand-orange" />
                    Montepremi {SUPER_LEAGUE.prizePool}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays size={15} className="text-brand-orange shrink-0" />
                    Iscrizioni aperte · Start lega {SUPER_LEAGUE.startLabel}
                  </span>
                </div>

                <p className="mt-3 text-sm text-white/70 max-w-xl">
                  Pass stagione <strong className="text-white">{SUPER_LEAGUE.price}€</strong>,
                  pagamento unico · nessun rinnovo automatico.
                </p>
              </motion.div>
            </div>

            {/* CTA */}
            <div className="shrink-0">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-ink shadow-soft transition-transform group-hover:-translate-y-0.5">
                Iscriviti
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
}
