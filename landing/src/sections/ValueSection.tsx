import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

export function ValueSection() {
  const { t } = useTranslation();
  return (
    <section className="relative py-20 md:py-28" data-testid="value-section">
      <div className="container-x">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="max-w-4xl mx-auto text-center"
        >
          <span className="overline">{t("value.overline")}</span>
          <h2 className="font-display font-bold text-4xl md:text-5xl lg:text-[64px] mt-5 tracking-tightest leading-[1.02]">
            <span className="block text-ink">{t("value.title_line1")}</span>
            <span className="block text-brand-blue">{t("value.title_line2")}</span>
          </h2>
          <p className="mt-7 text-muted text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
            {t("value.subtitle")}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
