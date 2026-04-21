import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ShieldCheck, Zap, Target, Trophy } from "lucide-react";

const ICONS = [ShieldCheck, Zap, Target, Trophy];

export function Markets() {
  const { t } = useTranslation();
  const items = t("markets.items", { returnObjects: true }) as {
    name: string;
    desc: string;
  }[];

  return (
    <section
      id="markets"
      className="relative section-pad bg-bg-surface/30"
      data-testid="markets-section"
    >
      <div className="container-x">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mb-14"
        >
          <span className="overline">{t("markets.overline")}</span>
          <h2 className="font-display font-bold text-4xl md:text-5xl lg:text-6xl mt-4 tracking-tight text-ink">
            {t("markets.title")}
          </h2>
          <p className="mt-5 text-muted text-base md:text-lg leading-relaxed">
            {t("markets.subtitle")}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((item, i) => {
            const Icon = ICONS[i];
            return (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="group relative rounded-2xl bg-bg-card border border-white/5 p-6 md:p-7 hover:border-brand/30 transition-all hover:-translate-y-1"
                data-testid={`market-card-${i + 1}`}
              >
                <div className="h-11 w-11 rounded-xl bg-brand/10 border border-brand/20 grid place-items-center mb-5 group-hover:bg-brand group-hover:text-bg-base transition-colors">
                  <Icon size={18} className="text-brand group-hover:text-bg-base transition-colors" strokeWidth={2.2} />
                </div>
                <h3 className="font-display text-xl md:text-2xl font-bold text-ink tracking-tight">
                  {item.name}
                </h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">{item.desc}</p>
                <div className="absolute bottom-4 right-4 text-muted/30 font-display text-5xl font-bold leading-none">
                  0{i + 1}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
