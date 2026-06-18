import { useState, FormEvent } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, Mail } from "lucide-react";

const BACKEND_URL =
  (import.meta as any).env?.VITE_BACKEND_URL ||
  "https://fanta-auth-fix.preview.emergentagent.com";

export function Newsletter() {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch(`${BACKEND_URL}/api/newsletter/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          language: (i18n.language || "it").slice(0, 2),
          source: "landing",
        }),
      });
      if (!res.ok) throw new Error("subscribe failed");
      setStatus("ok");
      setEmail("");
      setTimeout(() => setStatus("idle"), 5000);
    } catch (err) {
      setStatus("err");
      setTimeout(() => setStatus("idle"), 5000);
    }
  };

  return (
    <section
      id="download"
      className="relative section-pad overflow-hidden"
      data-testid="newsletter-section"
    >
      <div className="container-x">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="relative rounded-[32px] overflow-hidden"
          style={{ background: "linear-gradient(135deg, #1E4FD8 0%, #0A2570 100%)" }}
        >
          {/* Grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          {/* Orange glow */}
          <div className="absolute -top-40 -right-40 h-[400px] w-[400px] rounded-full bg-brand-orange/40 blur-[120px]" />
          {/* Stadium */}

          <div className="relative p-8 md:p-14 lg:p-20 flex flex-col items-center text-center text-white">
            <div className="h-14 w-14 rounded-2xl bg-white/15 border border-white/25 grid place-items-center mb-6 backdrop-blur-sm">
              <Mail size={22} />
            </div>
            <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] font-bold text-brand-yellow">
              <span className="inline-block h-[2px] w-8 bg-brand-yellow" />
              {t("newsletter.overline")}
            </span>
            <h2 className="font-display font-bold text-4xl md:text-5xl lg:text-6xl mt-4 tracking-tightest max-w-3xl">
              {t("newsletter.title")}
            </h2>
            <p className="mt-5 text-white/80 text-base md:text-lg leading-relaxed max-w-xl">
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
                className="flex-1 rounded-full border border-white/20 bg-white/10 px-6 py-4 text-white placeholder:text-white/50 focus:outline-none focus:border-brand-yellow focus:bg-white/15 transition-colors backdrop-blur-sm"
                data-testid="newsletter-input"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-orange px-7 py-4 font-semibold text-white hover:bg-brand-orange-600 transition-colors whitespace-nowrap shadow-cta disabled:opacity-70 disabled:cursor-wait"
                data-testid="newsletter-submit"
              >
                {status === "ok" ? (
                  <>
                    <Check size={18} />
                    {t("newsletter.success")}
                  </>
                ) : status === "err" ? (
                  <>Riprova</>
                ) : status === "loading" ? (
                  <>Invio…</>
                ) : (
                  <>
                    {t("newsletter.cta")}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <p className="mt-4 text-xs text-white/60">{t("newsletter.privacy")}</p>

            {/* Store badges — live links */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://apps.apple.com/it/app/fantapronostic/id6760613936"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 hover:bg-white hover:border-white transition-all backdrop-blur-sm"
                data-testid="app-store-badge"
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" className="text-white group-hover:text-ink transition-colors">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09M12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                <div className="text-left">
                  <p className="text-[10px] uppercase tracking-wider text-white/70 group-hover:text-ink/60 transition-colors">
                    Scarica su
                  </p>
                  <p className="text-base font-semibold text-white group-hover:text-ink leading-tight transition-colors">
                    App Store
                  </p>
                </div>
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=com.fantapronostic.app"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 hover:bg-white hover:border-white transition-all backdrop-blur-sm"
                data-testid="play-store-badge"
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" className="text-white group-hover:text-ink transition-colors">
                  <path d="M3.6 20.84V3.16c0-.77.85-1.24 1.5-.83l14.57 8.84c.61.37.61 1.26 0 1.63L5.1 21.66c-.65.41-1.5-.06-1.5-.82M13.64 12 5.6 7.12v9.75L13.64 12z" />
                </svg>
                <div className="text-left">
                  <p className="text-[10px] uppercase tracking-wider text-white/70 group-hover:text-ink/60 transition-colors">
                    Disponibile su
                  </p>
                  <p className="text-base font-semibold text-white group-hover:text-ink leading-tight transition-colors">
                    Google Play
                  </p>
                </div>
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
