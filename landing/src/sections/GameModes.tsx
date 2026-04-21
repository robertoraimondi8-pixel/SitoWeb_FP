import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Users, Swords, Crown, Check, ArrowUpRight } from "lucide-react";

const ICONS = [Users, Swords, Crown];
const ACCENTS = [
  { bg: "bg-brand-blue", text: "text-brand-blue", tint: "bg-brand-blue-50", border: "border-brand-blue/15" },
  { bg: "bg-brand-orange", text: "text-brand-orange", tint: "bg-brand-orange-50", border: "border-brand-orange/20" },
  { bg: "bg-brand-blue-700", text: "text-brand-blue-700", tint: "bg-brand-blue-50", border: "border-brand-blue-700/20" },
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
      className="relative section-pad bg-bg-soft"
      data-testid="game-modes-section"
    >
      <div className="container-x">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mb-14 md:mb-20 text-center mx-auto"
        >
          <span className="overline">{t("modes.overline")}</span>
          <h2 className="font-display font-bold text-4xl md:text-5xl lg:text-6xl mt-4 tracking-tightest text-ink">
            {t("modes.title")}
          </h2>
          <p className="mt-5 text-muted text-base md:text-lg leading-relaxed">
            {t("modes.subtitle")}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
          {cards.map((card, i) => {
            const Icon = ICONS[i];
            const A = ACCENTS[i];
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="group relative card overflow-hidden flex flex-col"
                data-testid={`mode-card-${i + 1}`}
              >
                {/* Top decorative strip */}
                <div className={`h-1.5 w-full ${A.bg}`} />

                <div className="p-8 md:p-9 flex flex-col h-full">
                  <div className="flex items-start justify-between mb-7">
                    <div
                      className={`h-14 w-14 rounded-2xl ${A.tint} ${A.text} grid place-items-center border ${A.border}`}
                    >
                      <Icon size={24} strokeWidth={2.2} />
                    </div>
                    <span className={`chip ${i === 1 ? "!bg-brand-orange-50 !border-brand-orange/20 !text-brand-orange-600" : ""}`}>
                      {card.tag}
                    </span>
                  </div>

                  <h3 className="font-display text-3xl md:text-[32px] font-bold text-ink tracking-tight leading-[1.1]">
                    {card.title}
                  </h3>
                  <p className={`mt-3 font-display text-base md:text-lg ${A.text} font-semibold italic leading-snug`}>
                    "{card.punch}"
                  </p>

                  <p className="mt-5 text-muted leading-relaxed text-sm">{card.body}</p>

                  <div className="mt-7 space-y-2.5">
                    {card.bullets.map((b) => (
                      <div key={b} className="flex items-center gap-2.5 text-sm text-ink2 font-medium">
                        <span className={`h-5 w-5 rounded-full ${A.tint} grid place-items-center`}>
                          <Check size={12} className={A.text} strokeWidth={3} />
                        </span>
                        {b}
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto pt-8 border-t border-line flex items-center justify-between">
                    <p className="text-xs text-muted max-w-[60%] leading-snug">
                      {card.perfect_for}
                    </p>
                    <span className={`h-10 w-10 rounded-full ${A.tint} grid place-items-center ${A.text} group-hover:${A.bg} group-hover:text-white transition-all`}>
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
