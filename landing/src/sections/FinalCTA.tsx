import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";

export function FinalCTA() {
  const { t } = useTranslation();
  return (
    <section className="relative section-pad" data-testid="final-cta-section">
      <div className="container-x">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="relative rounded-[32px] overflow-hidden border-2 border-brand-orange/20 bg-white"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-brand-blue-50 via-white to-brand-orange-50" />
          <div className="absolute inset-0 grid-bg opacity-70" />
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-64 w-[600px] rounded-full bg-brand-orange/20 blur-[120px]" />

          <div className="relative p-10 md:p-20 flex flex-col items-center text-center">
            <img
              src="/brand-icon.png"
              alt=""
              className="h-20 w-20 rounded-2xl mb-8 shadow-soft"
            />
            <h2 className="font-display font-bold text-4xl md:text-6xl lg:text-7xl tracking-tightest text-ink leading-[1]">
              {t("cta_final.title")}
            </h2>
            <p className="mt-6 text-muted text-base md:text-lg max-w-xl">
              {t("cta_final.subtitle")}
            </p>
            <a
              href="#download"
              className="btn-primary mt-10 text-base md:text-lg px-10 py-4"
              data-testid="final-cta-button"
            >
              {t("cta_final.cta")}
              <ArrowRight size={20} />
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
