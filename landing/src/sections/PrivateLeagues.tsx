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
      <div className="absolute -left-40 top-1/3 h-[500px] w-[500px] rounded-full bg-brand/10 blur-[160px]" />
      <div className="absolute -right-40 bottom-0 h-[500px] w-[500px] rounded-full bg-gold/10 blur-[180px]" />

      <div className="container-x">
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
            <h2 className="font-display font-bold text-4xl md:text-5xl lg:text-6xl mt-4 tracking-tight text-ink leading-[1.05]">
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
                    className="rounded-2xl bg-white/[0.02] border border-white/5 p-5 hover:bg-white/[0.04] transition-colors"
                    data-testid={`league-feature-${i + 1}`}
                  >
                    <div className="h-9 w-9 rounded-xl bg-brand/10 border border-brand/20 grid place-items-center mb-3">
                      <Icon size={16} className="text-brand" />
                    </div>
                    <h3 className="font-semibold text-ink mb-1">{f.title}</h3>
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

          {/* Right — mockup card */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="lg:col-span-6 relative"
          >
            <div className="relative rounded-3xl bg-gradient-to-br from-bg-surface to-bg-card border border-white/10 p-6 md:p-8 shadow-card">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                </div>
                <span className="chip">FantaPronostic · Lega</span>
              </div>

              <h3 className="font-display text-2xl md:text-3xl font-bold text-ink tracking-tight">
                I Campioni del Bar
              </h3>
              <p className="text-xs text-muted mt-1">12 partecipanti · Modalità Campionato</p>

              <div className="mt-6 rounded-2xl bg-bg-base border border-white/5 p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted">Codice invito</p>
                  <p className="font-display text-2xl md:text-3xl font-bold text-brand tracking-[0.2em] mt-1">
                    FP-7X92
                  </p>
                </div>
                <button
                  className="h-10 w-10 rounded-xl bg-brand/10 border border-brand/20 grid place-items-center text-brand hover:bg-brand hover:text-bg-base transition-colors"
                  aria-label="Copia codice"
                  data-testid="invite-copy-btn"
                >
                  <Copy size={16} />
                </button>
              </div>

              {/* Leaderboard mock */}
              <div className="mt-6 space-y-2">
                {[
                  { pos: 1, name: "Marco R.", pts: 47, diff: "+3" },
                  { pos: 2, name: "Luca B.", pts: 44, diff: "+1" },
                  { pos: 3, name: "Sara T.", pts: 41, diff: "0" },
                  { pos: 4, name: "Tu", pts: 39, diff: "-2", you: true },
                ].map((r) => (
                  <div
                    key={r.pos}
                    className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm ${
                      r.you
                        ? "bg-brand/10 border border-brand/30"
                        : "bg-white/[0.02] border border-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-7 w-7 rounded-full grid place-items-center text-xs font-bold ${
                          r.pos === 1
                            ? "bg-gold/20 text-gold border border-gold/30"
                            : r.you
                              ? "bg-brand/20 text-brand border border-brand/30"
                              : "bg-white/5 text-muted border border-white/10"
                        }`}
                      >
                        {r.pos}
                      </span>
                      <span className={`font-medium ${r.you ? "text-ink" : "text-ink/80"}`}>
                        {r.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs ${r.diff.startsWith("+") ? "text-brand" : r.diff.startsWith("-") ? "text-red-400" : "text-muted"}`}
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
            {/* Decorative ring */}
            <div className="absolute -z-10 inset-0 rounded-[32px] bg-brand/20 blur-3xl opacity-30" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
