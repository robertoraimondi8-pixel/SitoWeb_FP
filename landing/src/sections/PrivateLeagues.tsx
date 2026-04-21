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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="max-w-3xl mx-auto text-center mb-14 md:mb-16"
        >
          <span className="overline">{t("leagues.overline")}</span>
          <h2 className="font-display font-bold text-4xl md:text-5xl lg:text-6xl mt-4 tracking-tightest text-ink leading-[1.05]">
            {t("leagues.title")}
          </h2>
          <p className="mt-6 text-muted text-base md:text-lg leading-relaxed">
            {t("leagues.subtitle")}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 max-w-6xl mx-auto">
          {features.map((f, i) => {
            const Icon = ICONS[i];
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
                className="card p-6 md:p-7 hover:-translate-y-1"
                data-testid={`league-feature-${i + 1}`}
              >
                <div className="h-11 w-11 rounded-xl bg-brand-blue text-white grid place-items-center mb-4 shadow-blue">
                  <Icon size={18} strokeWidth={2.4} />
                </div>
                <h3 className="font-display font-bold text-ink text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{f.body}</p>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-12 flex justify-center">
          <a href="#download" className="btn-primary" data-testid="leagues-cta-create">
            {t("leagues.cta")}
            <ArrowRight size={18} />
          </a>
        </div>
      </div>
    </section>
  );
}
