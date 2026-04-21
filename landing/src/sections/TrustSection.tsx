import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Lock, RefreshCw, Radio, TrendingUp, UserPlus, ShieldCheck } from "lucide-react";

const ICONS = [Lock, RefreshCw, Radio, TrendingUp, UserPlus, ShieldCheck];

export function TrustSection() {
  const { t } = useTranslation();
  const bullets = t("trust.bullets", { returnObjects: true }) as {
    title: string;
    body: string;
  }[];

  return (
    <section
      id="trust"
      className="relative section-pad overflow-hidden"
      data-testid="trust-section"
    >
      {/* Subtle blue backdrop */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-brand-blue-50/30 to-white" />

      <div className="container-x relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mb-14 md:mb-20 text-center mx-auto"
        >
          <span className="overline">{t("trust.overline")}</span>
          <h2 className="font-display font-bold text-4xl md:text-5xl lg:text-6xl mt-4 tracking-tightest text-ink">
            {t("trust.title")}
          </h2>
          <p className="mt-5 text-muted text-base md:text-lg leading-relaxed">
            {t("trust.subtitle")}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {bullets.map((b, i) => {
            const Icon = ICONS[i];
            const isLive = i === 2 || i === 3; // live-related items get the orange accent
            return (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                className="card p-6 md:p-7 flex flex-col"
                data-testid={`trust-bullet-${i + 1}`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`h-11 w-11 rounded-xl grid place-items-center ${
                      isLive
                        ? "bg-brand-orange text-white"
                        : "bg-brand-blue text-white"
                    } shadow-soft`}
                  >
                    <Icon size={18} strokeWidth={2.4} />
                  </div>
                  {isLive && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-[11px] font-bold text-red-600 uppercase tracking-wider">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                      </span>
                      Live
                    </span>
                  )}
                </div>
                <h3 className="font-display text-lg md:text-xl font-bold text-ink tracking-tight leading-snug">
                  {b.title}
                </h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">{b.body}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
