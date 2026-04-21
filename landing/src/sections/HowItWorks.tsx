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
          className="max-w-2xl mb-16 text-center mx-auto"
        >
          <span className="overline">{t("how.overline")}</span>
          <h2 className="font-display font-bold text-4xl md:text-5xl lg:text-6xl mt-4 tracking-tightest text-ink">
            {t("how.title")}
          </h2>
          <p className="mt-5 text-muted text-base md:text-lg leading-relaxed">
            {t("how.subtitle")}
          </p>
        </motion.div>

        <div className="relative">
          {/* Connector line behind cards on desktop */}
          <div className="hidden md:block absolute top-24 left-[16%] right-[16%] h-px border-t-2 border-dashed border-line2" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 relative">
            {steps.map((step, i) => {
              const Icon = ICONS[i];
              return (
                <motion.div
                  key={step.n}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="card p-8 md:p-9 relative"
                  data-testid={`how-step-${i + 1}`}
                >
                  <div className="flex items-start justify-between mb-7">
                    <div className="h-14 w-14 rounded-2xl bg-brand-blue text-white grid place-items-center shadow-blue">
                      <Icon size={22} strokeWidth={2.2} />
                    </div>
                    <span className="font-display font-bold text-[64px] leading-none text-brand-blue-50 select-none">
                      {step.n}
                    </span>
                  </div>
                  <h3 className="font-display text-2xl font-bold text-ink tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-muted leading-relaxed text-sm md:text-base">
                    {step.body}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
