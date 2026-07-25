import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { track } from "@vercel/analytics";
import { ArrowRight, Trophy } from "lucide-react";

const IOS_URL = "https://apps.apple.com/it/app/fantapronostic/id6760613936";
const ANDROID_URL = "https://play.google.com/store/apps/details?id=com.fantapronostic.app";

// Loghi store come SVG (si vedono ovunque, niente immagini esterne)
function AppleLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.417 2.2-1.114 2.99-.84.95-2.2 1.68-3.34 1.59-.14-1.12.42-2.28 1.06-3.01.72-.82 2.02-1.46 3.13-1.55.02.06.03.12.03.18l.174-.19zM20.5 17.02c-.55 1.27-.82 1.83-1.53 2.95-.99 1.57-2.39 3.52-4.12 3.53-1.54.02-1.93-.99-4.02-.98-2.09.01-2.52.99-4.06.97-1.73-.02-3.05-1.78-4.04-3.35C-.98 15.7-.29 9.7 2.65 8.15c1.13-.6 2.16-.6 3.34-.6 1.2 0 1.96.6 3.34.6 1.34 0 2.15-.6 3.55-.6 1.06 0 2.18.29 3 .99-2.64 1.45-2.21 5.22.62 6.48-.13.42-.29.83-.6 1.6z" />
    </svg>
  );
}

function GooglePlayLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M3.6 2.3c-.24.25-.38.63-.38 1.13v17.14c0 .5.14.88.4 1.12l.06.06 9.6-9.6v-.22L3.66 2.24l-.06.06z" fill="#00D2FF" />
      <path d="M16.5 15.6l-3.2-3.2v-.22l3.2-3.2.07.04 3.8 2.16c1.08.61 1.08 1.62 0 2.24l-3.8 2.16-.07.04z" fill="#FFCE00" />
      <path d="M16.57 15.56L13.3 12.3l-9.6 9.6c.36.38.94.42 1.6.05l11.27-6.39z" fill="#FF3B30" />
      <path d="M16.57 9.04L5.3 2.65c-.66-.38-1.24-.33-1.6.05l9.6 9.6 3.27-3.26z" fill="#00C853" />
    </svg>
  );
}

export default function DownloadPage() {
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");

  useEffect(() => {
    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/i.test(ua)) setPlatform("ios");
    else if (/Android/i.test(ua)) setPlatform("android");
    track("download_page_view");
  }, []);

  const StoreButtons = (
    <div className="flex flex-col gap-3 w-full">
      <a
        href={IOS_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("download_ios_click")}
        className="group flex items-center justify-center gap-3 rounded-2xl bg-ink px-6 py-4 text-white transition-transform hover:-translate-y-0.5 shadow-soft"
        data-testid="download-ios"
      >
        <AppleLogo className="h-6 w-6" />
        <span className="text-left leading-tight">
          <span className="block text-[10px] uppercase tracking-widest text-white/60">Scarica su</span>
          <span className="block font-display font-bold text-lg -mt-0.5">App Store</span>
        </span>
      </a>

      <a
        href={ANDROID_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("download_android_click")}
        className="group flex items-center justify-center gap-3 rounded-2xl bg-white border border-line px-6 py-4 text-ink transition-transform hover:-translate-y-0.5 shadow-soft"
        data-testid="download-android"
      >
        <GooglePlayLogo className="h-6 w-6" />
        <span className="text-left leading-tight">
          <span className="block text-[10px] uppercase tracking-widest text-muted">Scarica su</span>
          <span className="block font-display font-bold text-lg -mt-0.5">Google Play</span>
        </span>
      </a>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg-soft flex flex-col">
      <main className="flex-1 flex items-center justify-center px-5 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm text-center"
        >
          {/* Icona app */}
          <img
            src="/brand-icon.png"
            alt="FantaPronostic"
            className="h-24 w-24 rounded-[22px] mx-auto shadow-card"
          />

          <h1 className="mt-6 font-display font-bold text-3xl tracking-tightest text-ink">
            Fanta<span className="text-brand-orange">Pronostic</span>
          </h1>
          <p className="mt-3 text-muted leading-relaxed">
            Pronostica le partite, sfida i tuoi amici nelle leghe e scala la classifica.
            Scarica l'app gratis.
          </p>

          {/* Store */}
          <div className="mt-8">{StoreButtons}</div>

          {platform !== "other" && (
            <p className="mt-3 text-xs text-muted">
              Sembra che tu sia su {platform === "ios" ? "iPhone" : "Android"}: usa il pulsante{" "}
              {platform === "ios" ? "App Store" : "Google Play"}.
            </p>
          )}

          {/* Link Super League */}
          <Link
            to="/lega"
            onClick={() => track("download_to_lega")}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-orange/10 border border-brand-orange/30 px-5 py-2.5 text-sm font-bold text-brand-orange-600 hover:bg-brand-orange/15 transition-colors"
            data-testid="download-lega-link"
          >
            <Trophy size={15} />
            Scopri la Super League
            <ArrowRight size={15} />
          </Link>

          <div className="mt-8">
            <Link to="/" className="text-xs font-semibold text-muted hover:text-brand-blue transition-colors">
              fantapronostic.com
            </Link>
          </div>
        </motion.div>
      </main>

      <footer className="py-6 text-center text-xs text-muted">
        © {new Date().getFullYear()} FantaPronostic
      </footer>
    </div>
  );
}
