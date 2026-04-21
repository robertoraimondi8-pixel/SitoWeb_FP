import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Users, Swords, Crown, Check, ArrowUpRight } from "lucide-react";

const ICONS = [Users, Swords, Crown];
const GLOWS = [
  "from-emerald-500/20 via-brand/10 to-transparent",
  "from-amber-500/20 via-gold/10 to-transparent",
  "from-violet-500/20 via-brand/10 to-transparent",
];

export function GameModes() {
  const { t } = useTranslation();
  const cards = t("modes.cards", { returnObjects: true }) as {
    tag: string;
    title: string;
    punch: string;
    body: string;
    perfect_for: string;
    bullets: string[];
  }[];

  return (
    <section
      id="modes"
      className="relative section-pad bg-bg-surface/30"
      data-testid="game-modes-section"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="container-x">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mb-14 md:mb-20"
        >
          <span className="overline">{t("modes.overline")}</span>
          <h2 className="font-display font-bold text-4xl md:text-5xl lg:text-6xl mt-4 tracking-tight text-ink">
            {t("modes.title")}
          </h2>
          <p className="mt-5 text-muted text-base md:text-lg leading-relaxed">
            {t("modes.subtitle")}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
          {cards.map((card, i) => {
            const Icon = ICONS[i];
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: i * 0.12 }}
                className="group relative rounded-3xl overflow-hidden bg-bg-card border border-white/5 hover:border-brand/40 transition-all duration-500 hover:-translate-y-2"
                data-testid={`mode-card-${i + 1}`}
              >
                {/* Glow */}
                <div
                  className={`absolute -top-32 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-gradient-to-b ${GLOWS[i]} blur-3xl opacity-60 group-hover:opacity-100 transition-opacity`}
                />

                <div className="relative p-8 md:p-10 flex flex-col h-full">
                  <div className="flex items-start justify-between mb-8">
                    <div className="h-14 w-14 rounded-2xl bg-ink/5 border border-white/10 grid place-items-center">
                      <Icon size={24} className="text-brand" strokeWidth={2} />
                    </div>
                    <span className="chip">{card.tag}</span>
                  </div>

                  <h3 className="font-display text-3xl md:text-4xl font-bold text-ink tracking-tight leading-tight">
                    {card.title}
                  </h3>
                  <p className="mt-3 font-display text-base md:text-lg text-brand font-medium italic">
                    "{card.punch}"
                  </p>

                  <p className="mt-5 text-muted leading-relaxed text-sm">{card.body}</p>

                  <div className="mt-7 space-y-2.5">
                    {card.bullets.map((b) => (
                      <div key={b} className="flex items-center gap-2.5 text-sm text-ink/90">
                        <span className="h-5 w-5 rounded-full bg-brand/10 border border-brand/30 grid place-items-center">
                          <Check size={12} className="text-brand" strokeWidth={3} />
                        </span>
                        {b}
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto pt-8 border-t border-white/5 flex items-center justify-between">
                    <p className="text-xs text-muted/80 max-w-[60%] leading-snug">
                      {card.perfect_for}
                    </p>
                    <span className="h-10 w-10 rounded-full bg-white/5 border border-white/10 grid place-items-center group-hover:bg-brand group-hover:border-brand group-hover:text-bg-base transition-all">
                      <ArrowUpRight size={16} />
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
