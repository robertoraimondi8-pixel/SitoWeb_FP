import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ArrowRight, Play, Sparkles } from "lucide-react";

export function Hero() {
  const { t } = useTranslation();
  return (
    <section
      id="top"
      className="relative overflow-hidden pt-28 md:pt-32 pb-20"
      data-testid="hero-section"
    >
      {/* Background — soft light with brand tint + stadium fading */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-blue-50 via-white to-white" />
        <div className="absolute inset-0 grid-bg opacity-100" />
        <div className="absolute inset-0 bg-brand-radial" />
        {/* Stadium photo fades subtly top-right */}
        <div
          className="absolute top-0 right-0 w-[900px] h-[600px] bg-cover bg-center opacity-10 pointer-events-none"
          style={{
            backgroundImage: "url(/stadium.png)",
            maskImage: "radial-gradient(circle at 70% 40%, black 30%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(circle at 70% 40%, black 30%, transparent 75%)",
          }}
        />
      </div>

      <div className="relative z-10 container-x">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* Left — copy */}
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="chip-orange mb-8"
              data-testid="hero-badge"
            >
              <Sparkles size={12} />
              <span>{t("hero.badge")}</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="font-display font-bold text-5xl sm:text-6xl md:text-7xl lg:text-[82px] leading-[0.95] tracking-tightest text-ink"
              data-testid="hero-title"
            >
              <span className="block">{t("hero.title_line1")}</span>
              <span className="block text-brand-blue">
                {t("hero.title_line2")}{" "}
                <span className="relative inline-block">
                  <span className="text-brand-orange italic">{t("hero.title_line3")}</span>
                  <svg
                    className="absolute -bottom-2 left-0 w-full"
                    viewBox="0 0 200 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M2 9C40 3 80 3 120 5C160 7 180 7 198 3"
                      stroke="#F58220"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="mt-8 max-w-xl text-base md:text-lg text-muted leading-relaxed"
              data-testid="hero-subtitle"
            >
              {t("hero.subtitle")}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-10 flex flex-wrap items-center gap-3"
            >
              <a href="#leagues" className="btn-primary" data-testid="hero-cta-primary">
                {t("hero.cta_primary")}
                <ArrowRight size={18} />
              </a>
              <a href="#how" className="btn-ghost" data-testid="hero-cta-secondary">
                <Play size={14} className="fill-current" />
                {t("hero.cta_secondary")}
              </a>
            </motion.div>

            {/* Trust bar — real social proof instead of fake stats */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.55 }}
              className="mt-14 flex items-center gap-5"
              data-testid="hero-trust"
            >
              <div className="flex -space-x-2">
                {[
                  { bg: "bg-brand-blue", letter: "M" },
                  { bg: "bg-brand-orange", letter: "L" },
                  { bg: "bg-brand-yellow", letter: "S" },
                  { bg: "bg-brand-blue-700", letter: "A" },
                ].map((a, i) => (
                  <div
                    key={i}
                    className={`h-10 w-10 rounded-full ${a.bg} border-[3px] border-white text-white font-bold grid place-items-center text-sm`}
                  >
                    {a.letter}
                  </div>
                ))}
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">
                  {t("hero.trust_line")}
                </p>
                <p className="text-xs text-muted">{t("hero.trust_sub")}</p>
              </div>
            </motion.div>
          </div>

          {/* Right — floating app mockup */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="lg:col-span-5 relative hidden lg:flex items-center justify-center"
          >
            {/* Decorative ring */}
            <div className="absolute -z-10 h-[460px] w-[460px] rounded-full bg-brand-blue-50" />
            <div className="absolute -z-10 h-[360px] w-[360px] rounded-full bg-white border border-line2" />

            {/* Phone mockup */}
            <div className="relative animate-float">
              <div className="relative rounded-[44px] border-[10px] border-ink bg-ink shadow-blue w-[280px] h-[560px] overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-6 bg-ink flex items-center justify-center">
                  <div className="h-1.5 w-16 rounded-full bg-white/20" />
                </div>
                <div className="pt-8 h-full bg-gradient-to-br from-brand-blue via-brand-blue-700 to-brand-blue-900 p-4 flex flex-col">
                  <div className="flex items-center gap-2 mb-4">
                    <img src="/brand-icon.png" alt="" className="h-8 w-8 rounded-lg" />
                    <span className="font-display text-white font-bold">FantaPronostic</span>
                  </div>

                  <p className="text-[10px] uppercase tracking-widest text-white/50 font-semibold mb-2">
                    Giornata 28
                  </p>
                  <div className="rounded-2xl bg-white/10 border border-white/15 p-3 backdrop-blur-sm mb-2">
                    <div className="flex items-center justify-between text-white text-sm font-semibold">
                      <span>Juventus</span>
                      <span className="text-brand-yellow font-display font-bold">2-1</span>
                      <span>Milan</span>
                    </div>
                    <div className="mt-2 flex gap-1">
                      <span className="flex-1 text-[10px] text-center py-1 rounded-md bg-brand-orange text-white font-bold">
                        1
                      </span>
                      <span className="flex-1 text-[10px] text-center py-1 rounded-md bg-white/10 text-white/70">
                        X
                      </span>
                      <span className="flex-1 text-[10px] text-center py-1 rounded-md bg-white/10 text-white/70">
                        2
                      </span>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/10 border border-white/15 p-3 backdrop-blur-sm mb-2">
                    <div className="flex items-center justify-between text-white text-sm font-semibold">
                      <span>Inter</span>
                      <span className="text-white/50 text-xs">20:45</span>
                      <span>Napoli</span>
                    </div>
                  </div>

                  <div className="mt-auto rounded-2xl bg-brand-orange p-3 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-white/80 font-bold">
                        La tua posizione
                      </p>
                      <p className="font-display text-white font-bold text-2xl">
                        #2 su 12
                      </p>
                    </div>
                    <span className="text-3xl">🏆</span>
                  </div>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -left-10 top-16 bg-white rounded-2xl border border-line shadow-card p-3 flex items-center gap-2 animate-float">
                <span className="h-8 w-8 rounded-full bg-brand-orange-50 grid place-items-center text-brand-orange">
                  ⚽
                </span>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted font-bold">
                    Gol
                  </p>
                  <p className="text-sm font-display font-bold text-ink">+3 pt</p>
                </div>
              </div>

              <div className="absolute -right-8 bottom-20 bg-white rounded-2xl border border-line shadow-card p-3 flex items-center gap-2">
                <span className="h-8 w-8 rounded-full bg-brand-blue-50 grid place-items-center text-brand-blue">
                  ✓
                </span>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted font-bold">
                    1X2 OK
                  </p>
                  <p className="text-sm font-display font-bold text-ink">Juve vince</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
