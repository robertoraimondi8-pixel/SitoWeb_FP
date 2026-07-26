import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Users, ArrowRight, Gift, Plane } from "lucide-react";

export function CommunityLeagueBanner() {
  return (
    <section className="pb-4 md:pb-6" data-testid="community-banner">
      <div className="container-x">
        <Link
          to="/community"
          aria-label="Scopri la Community League"
          className="group block relative overflow-hidden rounded-[28px] md:rounded-[36px] shadow-[0_30px_80px_-24px_rgba(6,40,20,0.5)] ring-1 ring-white/10"
          style={{
            background:
              "radial-gradient(120% 130% at 15% 0%, #12692f 0%, #0a3d1f 55%, #062814 100%)",
          }}
          data-testid="community-banner-link"
        >
          <div
            className="absolute inset-0 opacity-[0.08] pointer-events-none"
            style={{
              backgroundImage:
                "repeating-linear-gradient(180deg, rgba(255,255,255,0.6) 0px, rgba(255,255,255,0.6) 2px, transparent 2px, transparent 40px)",
            }}
          />
          <div className="absolute -top-16 -right-8 w-64 h-48 rounded-full bg-brand-orange/20 blur-[100px]" />

          <div className="relative p-7 sm:p-9 md:p-11 flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
            <div className="flex-1">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-green-800">
                  <Users size={12} />
                  Lega gratuita · 6 capitani creator
                </span>

                <h2 className="mt-4 font-display font-bold text-3xl sm:text-4xl md:text-5xl leading-[0.98] tracking-tightest uppercase">
                  <span className="text-brand-orange">Community</span>{" "}
                  <span className="text-white">League</span>
                </h2>

                <div className="mt-4 flex flex-col gap-2 text-sm text-white/80">
                  <span className="inline-flex items-center gap-2">
                    <Gift size={15} className="text-brand-orange shrink-0" />
                    Buono Amazon di 20€ ogni settimana per il miglior punteggio
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Plane size={15} className="text-brand-orange shrink-0" />
                    Weekend in una capitale europea per 2 persone
                  </span>
                </div>

                <p className="mt-3 text-sm text-white/70 max-w-xl">
                  Scegli la community del tuo creator preferito e pronostica gratis le partite di
                  Serie A.
                </p>
              </motion.div>
            </div>

            <div className="shrink-0">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-ink shadow-soft transition-transform group-hover:-translate-y-0.5">
                Scopri e iscriviti gratis
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
}
