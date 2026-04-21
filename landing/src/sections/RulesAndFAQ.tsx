import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";

type Item = { q: string; a: string };

function Accordion({ items, testidPrefix }: { items: Item[]; testidPrefix: string }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="flex flex-col gap-3">
      {items.map((it, i) => {
        const active = open === i;
        return (
          <div
            key={i}
            className={`rounded-2xl border transition-colors ${
              active ? "border-brand-blue/25 bg-brand-blue-50/40" : "border-line bg-white"
            }`}
            data-testid={`${testidPrefix}-item-${i + 1}`}
          >
            <button
              onClick={() => setOpen(active ? null : i)}
              className="w-full flex items-center justify-between gap-4 p-5 md:p-6 text-left"
              data-testid={`${testidPrefix}-toggle-${i + 1}`}
            >
              <span className="font-display text-base md:text-lg font-bold text-ink tracking-tight">
                {it.q}
              </span>
              <span
                className={`shrink-0 h-9 w-9 rounded-full grid place-items-center transition-all ${
                  active
                    ? "bg-brand-orange text-white rotate-45"
                    : "bg-brand-blue-50 text-brand-blue"
                }`}
              >
                <Plus size={16} />
              </span>
            </button>
            <AnimatePresence initial={false}>
              {active && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="px-5 md:px-6 pb-5 md:pb-6 text-muted leading-relaxed text-sm md:text-base max-w-3xl">
                    {it.a}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

export function Rules() {
  const { t } = useTranslation();
  const items = t("rules.items", { returnObjects: true }) as Item[];
  return (
    <section id="rules" className="relative section-pad" data-testid="rules-section">
      <div className="container-x">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-5"
          >
            <span className="overline">{t("rules.overline")}</span>
            <h2 className="font-display font-bold text-4xl md:text-5xl mt-4 tracking-tightest text-ink leading-[1.05]">
              {t("rules.title")}
            </h2>
            <p className="mt-5 text-muted text-base md:text-lg leading-relaxed">
              {t("rules.subtitle")}
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="lg:col-span-7"
          >
            <Accordion items={items} testidPrefix="rules" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export function FAQ() {
  const { t } = useTranslation();
  const items = t("faq.items", { returnObjects: true }) as Item[];
  return (
    <section
      id="faq"
      className="relative section-pad bg-bg-soft"
      data-testid="faq-section"
    >
      <div className="container-x">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mb-12 text-center mx-auto"
        >
          <span className="overline">{t("faq.overline")}</span>
          <h2 className="font-display font-bold text-4xl md:text-5xl mt-4 tracking-tightest text-ink">
            {t("faq.title")}
          </h2>
        </motion.div>
        <div className="max-w-3xl mx-auto">
          <Accordion items={items} testidPrefix="faq" />
        </div>
      </div>
    </section>
  );
}
