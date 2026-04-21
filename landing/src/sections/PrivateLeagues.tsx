import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Link as LinkIcon, Layers, Settings2, Activity, ArrowRight } from "lucide-react";

const ICONS = [LinkIcon, Layers, Settings2, Activity];

export function PrivateLeagues() {
  const { t } = useTranslation();
  const features = t("leagues.features", { returnObjects: true }) as {
    title: string;
    body: string;
  }[];

  return (
    <section
      id="leagues"
      className="relative section-pad overflow-hidden"
      data-testid="private-leagues-section"
    >
      <div className="absolute inset-0 bg-brand-radial opacity-60" />
      <div className="container-x relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          {/* Left — copy */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7 }}
            className="lg:col-span-6"
          >
            <span className="overline">{t("leagues.overline")}</span>
            <h2 className="font-display font-bold text-4xl md:text-5xl lg:text-6xl mt-4 tracking-tightest text-ink leading-[1.05]">
              {t("leagues.title")}
            </h2>
            <p className="mt-6 text-muted text-base md:text-lg leading-relaxed max-w-xl">
              {t("leagues.subtitle")}
            </p>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {features.map((f, i) => {
                const Icon = ICONS[i];
                return (
                  <motion.div
                    key={f.title}
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
                    className="card p-5 hover:-translate-y-1"
                    data-testid={`league-feature-${i + 1}`}
                  >
                    <div className="h-9 w-9 rounded-xl bg-brand-blue text-white grid place-items-center mb-3">
                      <Icon size={16} strokeWidth={2.4} />
                    </div>
                    <h3 className="font-display font-bold text-ink mb-1">{f.title}</h3>
                    <p className="text-sm text-muted leading-relaxed">{f.body}</p>
                  </motion.div>
                );
              })}
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              <a href="#download" className="btn-primary" data-testid="leagues-cta-create">
                {t("leagues.cta")}
                <ArrowRight size={18} />
              </a>
            </div>
          </motion.div>

          {/* Right — real leaderboard screenshot in phone frame */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="lg:col-span-6 relative flex items-center justify-center"
          >
            <div className="relative">
              <div className="relative rounded-[44px] border-[10px] border-ink bg-ink shadow-blue w-[320px] md:w-[340px] h-[660px] md:h-[700px] overflow-hidden mx-auto">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 h-5 w-28 bg-ink rounded-b-2xl z-20" />
                {/* Screenshot */}
                <img
                  src="/app-screen-leaderboard.jpg"
                  alt="FantaPronostic app — Classifica Lega Nazionale"
                  className="h-full w-full object-cover object-top"
                />
              </div>

              {/* Float badge — invite code */}
              <div className="absolute -left-6 md:-left-12 top-28 bg-white rounded-2xl border border-line shadow-card p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-brand-blue-50 grid place-items-center text-brand-blue font-bold">
                  #
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted font-bold">
                    Codice lega
                  </p>
                  <p className="text-sm font-display font-bold text-brand-blue tracking-widest">
                    FP-7X92
                  </p>
                </div>
              </div>

              {/* Float badge — trophy */}
              <div className="absolute -right-4 md:-right-10 bottom-32 bg-white rounded-2xl border border-line shadow-card p-3 flex items-center gap-2">
                <span className="h-9 w-9 rounded-full bg-brand-orange-50 grid place-items-center text-xl">
                  🏆
                </span>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted font-bold">
                    1° posto
                  </p>
                  <p className="text-sm font-display font-bold text-ink">64 pt</p>
                </div>
              </div>

              <div className="absolute -z-10 inset-0 rounded-[44px] bg-brand-blue/10 blur-3xl" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
