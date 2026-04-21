import { useState, FormEvent } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, Mail } from "lucide-react";

export function Newsletter() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSent(true);
    setTimeout(() => setSent(false), 4000);
    setEmail("");
  };

  return (
    <section
      id="download"
      className="relative section-pad overflow-hidden"
      data-testid="newsletter-section"
    >
      <div className="absolute inset-0 bg-radial-brand opacity-50" />
      <div className="container-x relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="relative rounded-[32px] overflow-hidden border border-white/10"
        >
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30"
            style={{ backgroundImage: "url(/stadium.png)" }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-bg-surface via-bg-surface/95 to-bg-card" />
          <div className="absolute inset-0 grain" />

          <div className="relative p-8 md:p-14 lg:p-20 flex flex-col items-center text-center">
            <div className="h-14 w-14 rounded-2xl bg-brand/10 border border-brand/30 grid place-items-center mb-6">
              <Mail className="text-brand" size={22} />
            </div>
            <span className="overline">{t("newsletter.overline")}</span>
            <h2 className="font-display font-bold text-4xl md:text-5xl lg:text-6xl mt-4 tracking-tight text-ink max-w-3xl">
              {t("newsletter.title")}
            </h2>
            <p className="mt-5 text-muted text-base md:text-lg leading-relaxed max-w-xl">
              {t("newsletter.subtitle")}
            </p>

            <form
              onSubmit={onSubmit}
              className="mt-10 w-full max-w-xl flex flex-col sm:flex-row gap-3"
              data-testid="newsletter-form"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("newsletter.placeholder")}
                className="flex-1 rounded-full border border-white/10 bg-white/[0.04] px-6 py-4 text-ink placeholder:text-muted/70 focus:outline-none focus:border-brand focus:bg-white/[0.06] transition-colors"
                data-testid="newsletter-input"
              />
              <button
                type="submit"
                className="btn-primary whitespace-nowrap"
                data-testid="newsletter-submit"
              >
                {sent ? (
                  <>
                    <Check size={18} />
                    {t("newsletter.success")}
                  </>
                ) : (
                  <>
                    {t("newsletter.cta")}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <p className="mt-4 text-xs text-muted/70">{t("newsletter.privacy")}</p>

            {/* Store badges */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 opacity-70 cursor-not-allowed" data-testid="app-store-badge">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="text-ink">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09M12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                <div className="text-left">
                  <p className="text-[10px] uppercase tracking-wider text-muted">{t("footer.coming_soon")}</p>
                  <p className="text-sm font-semibold text-ink leading-tight">App Store</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 opacity-70 cursor-not-allowed" data-testid="play-store-badge">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="text-ink">
                  <path d="M3.6 20.84V3.16c0-.77.85-1.24 1.5-.83l14.57 8.84c.61.37.61 1.26 0 1.63L5.1 21.66c-.65.41-1.5-.06-1.5-.82M13.64 12 5.6 7.12v9.75L13.64 12z" />
                </svg>
                <div className="text-left">
                  <p className="text-[10px] uppercase tracking-wider text-muted">{t("footer.coming_soon")}</p>
                  <p className="text-sm font-semibold text-ink leading-tight">Google Play</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
