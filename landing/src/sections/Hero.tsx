import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ArrowRight, Play, Sparkles } from "lucide-react";

export function Hero() {
  const { t } = useTranslation();
  return (
    <section
      id="top"
      className="relative min-h-[100svh] overflow-hidden pt-28 md:pt-32"
      data-testid="hero-section"
    >
      {/* Background layers */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.55]"
          style={{ backgroundImage: "url(/stadium.png)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-bg-base/40 via-bg-base/70 to-bg-base" />
        <div className="absolute inset-0 bg-radial-brand opacity-80" />
        <div className="absolute inset-0 grid-bg opacity-60" />
      </div>

      <div className="relative z-10 container-x flex flex-col items-start">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="chip mb-8 backdrop-blur-sm"
          data-testid="hero-badge"
        >
          <Sparkles size={12} className="text-brand" />
          <span>{t("hero.badge")}</span>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-display font-bold text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tightest max-w-5xl"
          data-testid="hero-title"
        >
          <span className="block text-ink">{t("hero.title_line1")}</span>
          <span className="block text-ink">
            {t("hero.title_line2")}{" "}
            <span className="relative inline-block">
              <span className="brand-gradient italic">{t("hero.title_line3")}</span>
              <svg
                className="absolute -bottom-2 left-0 w-full"
                viewBox="0 0 200 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="none"
              >
                <path
                  d="M2 9C40 3 80 3 120 5C160 7 180 7 198 3"
                  stroke="#00E55A"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-8 max-w-2xl text-base md:text-lg text-muted leading-relaxed"
          data-testid="hero-subtitle"
        >
          {t("hero.subtitle")}
        </motion.p>

        {/* CTAs */}
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
            <Play size={16} className="fill-current" />
            {t("hero.cta_secondary")}
          </a>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55 }}
          className="mt-16 md:mt-24 grid grid-cols-3 gap-4 md:gap-10 w-full max-w-3xl border-t border-white/5 pt-8"
          data-testid="hero-stats"
        >
          {[
            { n: "150K+", l: t("hero.stat_users") },
            { n: "2.4K+", l: t("hero.stat_leagues") },
            { n: "20+", l: t("hero.stat_matches") },
          ].map((s, i) => (
            <div key={i} className="flex flex-col">
              <span className="font-display text-3xl md:text-5xl font-bold text-ink tracking-tight">
                {s.n}
              </span>
              <span className="text-xs md:text-sm text-muted mt-1 uppercase tracking-wider">
                {s.l}
              </span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-muted text-xs opacity-60">
        <div className="h-8 w-px bg-gradient-to-b from-transparent via-brand to-transparent animate-pulse-soft" />
      </div>
    </section>
  );
}
