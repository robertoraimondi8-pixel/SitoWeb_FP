import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Link as LinkIcon, Layers, Settings2, Activity, ArrowRight, Copy } from "lucide-react";

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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          {/* Left — copy */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7 }}
            className="lg:col-span-6"
          >
            <span className="overline">{t("leagues.overline")}</span>
            <h2 className="font-display font-bold text-4xl md:text-5xl lg:text-6xl mt-4 tracking-tightest text-ink leading-[1.05]">
              {t("leagues.title")}
            </h2>
            <p className="mt-6 text-muted text-base md:text-lg leading-relaxed max-w-xl">
              {t("leagues.subtitle")}
            </p>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {features.map((f, i) => {
                const Icon = ICONS[i];
                return (
                  <motion.div
                    key={f.title}
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
                    className="card p-5 hover:-translate-y-1"
                    data-testid={`league-feature-${i + 1}`}
                  >
                    <div className="h-9 w-9 rounded-xl bg-brand-blue text-white grid place-items-center mb-3">
                      <Icon size={16} strokeWidth={2.4} />
                    </div>
                    <h3 className="font-display font-bold text-ink mb-1">{f.title}</h3>
                    <p className="text-sm text-muted leading-relaxed">{f.body}</p>
                  </motion.div>
                );
              })}
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              <a href="#download" className="btn-primary" data-testid="leagues-cta-create">
                {t("leagues.cta")}
                <ArrowRight size={18} />
              </a>
            </div>
          </motion.div>

          {/* Right — dashboard mockup */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="lg:col-span-6 relative"
          >
            <div className="relative rounded-3xl bg-white border border-line shadow-card p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-brand-yellow" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
                <span className="chip">FantaPronostic · Lega</span>
              </div>

              <h3 className="font-display text-2xl md:text-3xl font-bold text-ink tracking-tight">
                I Campioni del Bar
              </h3>
              <p className="text-xs text-muted mt-1">12 partecipanti · Modalità Campionato</p>

              <div className="mt-6 rounded-2xl bg-brand-blue-50 border border-brand-blue/15 p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-brand-blue font-bold">
                    Codice invito
                  </p>
                  <p className="font-display text-2xl md:text-3xl font-bold text-brand-blue tracking-[0.2em] mt-1">
                    FP-7X92
                  </p>
                </div>
                <button
                  className="h-10 w-10 rounded-xl bg-white border border-brand-blue/20 grid place-items-center text-brand-blue hover:bg-brand-blue hover:text-white transition-colors"
                  aria-label="Copia codice"
                  data-testid="invite-copy-btn"
                >
                  <Copy size={16} />
                </button>
              </div>

              <div className="mt-6 space-y-2">
                {[
                  { pos: 1, name: "Marco R.", pts: 47, diff: "+3" },
                  { pos: 2, name: "Luca B.", pts: 44, diff: "+1" },
                  { pos: 3, name: "Sara T.", pts: 41, diff: "0" },
                  { pos: 4, name: "Tu", pts: 39, diff: "-2", you: true },
                ].map((r) => (
                  <div
                    key={r.pos}
                    className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm border ${
                      r.you
                        ? "bg-brand-orange-50 border-brand-orange/25"
                        : "bg-bg-soft border-line"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-7 w-7 rounded-full grid place-items-center text-xs font-bold ${
                          r.pos === 1
                            ? "bg-brand-yellow text-ink"
                            : r.you
                              ? "bg-brand-orange text-white"
                              : "bg-white text-muted border border-line"
                        }`}
                      >
                        {r.pos}
                      </span>
                      <span className="font-semibold text-ink2">{r.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-semibold ${
                          r.diff.startsWith("+")
                            ? "text-emerald-600"
                            : r.diff.startsWith("-")
                              ? "text-red-500"
                              : "text-muted"
                        }`}
                      >
                        {r.diff}
                      </span>
                      <span className="font-display font-bold text-ink tabular-nums">
                        {r.pts}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Decorative glow */}
            <div className="absolute -z-10 inset-0 rounded-[32px] bg-brand-blue/10 blur-3xl" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
