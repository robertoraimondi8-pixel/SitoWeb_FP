import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Users, Target, Trophy } from "lucide-react";

const ICONS = [Users, Target, Trophy];

export function HowItWorks() {
  const { t } = useTranslation();
  const steps = t("how.steps", { returnObjects: true }) as {
    n: string;
    title: string;
    body: string;
  }[];

  return (
    <section id="how" className="relative section-pad" data-testid="how-it-works-section">
      <div className="container-x">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mb-16"
        >
          <span className="overline">{t("how.overline")}</span>
          <h2 className="font-display font-bold text-4xl md:text-5xl lg:text-6xl mt-4 tracking-tight text-ink">
            {t("how.title")}
          </h2>
          <p className="mt-5 text-muted text-base md:text-lg leading-relaxed">
            {t("how.subtitle")}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {steps.map((step, i) => {
            const Icon = ICONS[i];
            return (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group relative rounded-3xl bg-bg-surface border border-white/5 p-8 md:p-10 overflow-hidden hover:border-brand/30 transition-colors"
                data-testid={`how-step-${i + 1}`}
              >
                <span className="absolute -top-4 right-4 font-display font-bold text-[140px] leading-none text-white/[0.03] select-none">
                  {step.n}
                </span>
                <div className="relative z-10">
                  <div className="h-12 w-12 rounded-2xl bg-brand/10 text-brand grid place-items-center border border-brand/20 mb-6 group-hover:scale-110 transition-transform">
                    <Icon size={22} strokeWidth={2.2} />
                  </div>
                  <h3 className="font-display text-2xl font-semibold text-ink tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-muted leading-relaxed text-sm md:text-base">
                    {step.body}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
