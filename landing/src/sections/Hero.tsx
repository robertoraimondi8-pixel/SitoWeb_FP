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
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-blue-50 via-white to-white" />
        <div className="absolute inset-0 grid-bg opacity-100" />
        <div className="absolute inset-0 bg-brand-radial" />
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
              className="font-display font-bold text-[42px] sm:text-5xl md:text-6xl lg:text-[72px] leading-[1.02] tracking-tightest text-ink"
              data-testid="hero-title"
            >
              <span className="block">
                {t("hero.title_pre")}{" "}
                <span className="relative inline-block text-brand-orange italic">
                  {t("hero.title_accent")}
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
              <span className="block text-brand-blue">{t("hero.title_post")}</span>
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
              <a href="#download" className="btn-primary" data-testid="hero-cta-primary">
                {t("hero.cta_primary")}
                <ArrowRight size={18} />
              </a>
              <a href="#how" className="btn-ghost" data-testid="hero-cta-secondary">
                <Play size={14} className="fill-current" />
                {t("hero.cta_secondary")}
              </a>
            </motion.div>
          </div>

          {/* Right — real app screenshot in phone frame */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="lg:col-span-5 relative hidden lg:flex items-center justify-center"
          >
            <div className="absolute -z-10 h-[460px] w-[460px] rounded-full bg-brand-blue-50" />
            <div className="absolute -z-10 h-[360px] w-[360px] rounded-full bg-white border border-line2" />

            <div className="relative animate-float">
              <div className="relative rounded-[44px] border-[10px] border-ink bg-ink shadow-blue w-[280px] h-[580px] overflow-hidden">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 h-5 w-28 bg-ink rounded-b-2xl z-20" />
                {/* Screenshot */}
                <img
                  src="/app-screen-predictions.jpg"
                  alt="FantaPronostic app — Pronostici Giornata 1"
                  className="h-full w-full object-cover object-top"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
