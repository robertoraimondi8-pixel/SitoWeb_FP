import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CalendarDays, Download, ShieldCheck, Swords, Target, Trophy } from "lucide-react";
import { openAppStore } from "@/lib/storeLinks";
import { usePlatform, storeUrlFor } from "@/lib/usePlatform";
import { trackStoreClick } from "@/lib/tracking";

// Dati della lega in un posto solo: la pagina non ripete numeri a mano.
const FP_CHAMPIONS = {
  name: "F.P Champions League",
  prizePool: "500€",
  closingLabel: "12 ottobre",
  bonus: 10,
  heroImage: "/fp-champions-arena.webp",
};

const TITLE = `${FP_CHAMPIONS.name} | FantaPronostic`;
const DESCRIPTION =
  "Partecipa gratis alla F.P Champions League in modalità Arena 1vs1. " +
  "Montepremi totale 500€ in buoni Amazon.";

const reveal = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5 },
};

/**
 * Titolo e descrizione della pagina.
 *
 * Il sito e' una SPA con meta statici in index.html: qui si sovrascrivono al
 * montaggio e si ripristinano all'uscita, come gia' fa la pagina Privacy. Per i
 * social (Instagram, TikTok) questo NON basta, perche' i loro crawler leggono
 * l'HTML servito: vedi la nota nel README della pagina.
 */
function usePageMeta(title: string, description: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    const tag = document.querySelector('meta[name="description"]');
    const previousDescription = tag?.getAttribute("content") ?? null;
    tag?.setAttribute("content", description);

    return () => {
      document.title = previousTitle;
      if (tag && previousDescription !== null) tag.setAttribute("content", previousDescription);
    };
  }, [title, description]);
}

/**
 * Pulsante di download. Su mobile porta allo store giusto, su desktop si sdoppia
 * perche' la piattaforma non e' deducibile.
 *
 * `placement` distingue nel tracciamento quale dei CTA ha convertito.
 */
function DownloadCta({ placement, className = "" }: { placement: string; className?: string }) {
  const platform = usePlatform();

  const base =
    "flex min-h-[60px] items-center justify-center gap-2.5 rounded-full bg-brand-orange px-8 " +
    "font-display font-bold text-[17px] text-white shadow-cta transition-transform hover:-translate-y-1";

  if (platform === "other") {
    return (
      <div className={`flex flex-col gap-3 sm:flex-row sm:justify-center ${className}`}>
        <a
          href={storeUrlFor("ios")}
          rel="noopener noreferrer"
          onClick={() => {
            openAppStore();
            trackStoreClick("apple", placement);
          }}
          className={base}
        >
          <Download size={19} aria-hidden="true" />
          Scarica su App Store
        </a>
        <a
          href={storeUrlFor("android")}
          rel="noopener noreferrer"
          onClick={() => trackStoreClick("google", placement)}
          className={`${base} bg-brand-blue hover:bg-brand-blue-600`}
        >
          <Download size={19} aria-hidden="true" />
          Scarica su Google Play
        </a>
      </div>
    );
  }

  return (
    <a
      href={storeUrlFor(platform)}
      rel="noopener noreferrer"
      onClick={() => {
        if (platform === "ios") openAppStore();
        trackStoreClick(platform === "android" ? "google" : "apple", placement);
      }}
      className={`${base} w-full ${className}`}
    >
      Scarica l'app gratis
      <ArrowRight size={19} aria-hidden="true" />
    </a>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[12px] font-bold text-white backdrop-blur-md">
      {children}
    </span>
  );
}

const STEPS = [
  { icon: <Download size={20} />, title: "Scarica l'app", text: "Installa FantaPronostic gratis sul tuo telefono." },
  { icon: <Trophy size={20} />, title: "Entra nella lega", text: "Iscriviti alla F.P Champions League direttamente dall'app." },
  { icon: <Target size={20} />, title: "Pronostica le partite", text: "Scegli i tuoi pronostici e accumula punti giornata dopo giornata." },
  { icon: <Swords size={20} />, title: "Sfida 1vs1", text: "Ogni giornata affronti un avversario casuale: se vinci ottieni +10, se perdi −10." },
];

const OUTCOMES = [
  { label: "Vinci", value: "+10", note: "punti bonus", tone: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10" },
  { label: "Pareggi", value: "0", note: "punti", tone: "text-white/80 border-white/25 bg-white/5" },
  { label: "Perdi", value: "−10", note: "punti malus", tone: "text-red-400 border-red-400/40 bg-red-400/10" },
];

export default function ChampionsLeaguePage() {
  usePageMeta(TITLE, DESCRIPTION);
  const [showStickyCta, setShowStickyCta] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    // La barra fissa compare solo dopo il primo schermo, dove il CTA grande
    // e' gia' visibile: prima sarebbe una ripetizione che ruba spazio.
    const onScroll = () => setShowStickyCta(window.scrollY > window.innerHeight * 0.75);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-bg-base">
      <main>
        {/* ══ HERO ═══════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden bg-[#050f24] pt-16 md:pt-8">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 90% at 50% 0%, #17347a 0%, #0a1c45 45%, #050f24 100%)",
            }}
          />
          <div className="absolute -top-28 left-1/2 h-[340px] w-[560px] -translate-x-1/2 rounded-full bg-brand-orange/20 blur-[130px]" />

          {/* Barra superiore */}
          <div className="absolute inset-x-0 top-0 z-20">
            <div className="container-x flex items-center justify-between py-5">
              <Link to="/" className="flex items-center gap-2.5">
                <img src="/brand-icon.png" alt="" className="h-9 w-9 rounded-xl" />
                <span className="font-display text-[17px] font-bold tracking-tight text-white">
                  Fanta<span className="text-brand-orange">Pronostic</span>
                </span>
              </Link>
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 transition-colors hover:text-white"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                Home
              </Link>
            </div>
          </div>

          <div className="container-x relative z-10 py-14 md:py-16">
            <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Pill>🎟️ Iscrizione gratuita</Pill>
                <Pill>🏆 {FP_CHAMPIONS.prizePool} in buoni Amazon</Pill>
                <Pill>⚔️ Arena 1vs1</Pill>
              </div>

              <h1 className="font-display text-[clamp(2.2rem,8vw,4rem)] font-bold leading-[0.95] tracking-tightest text-white">
                F.P <span className="text-brand-orange">Champions League</span>
              </h1>

              <p className="text-base leading-relaxed text-white/85 md:text-lg">
                La nuova lega gratuita di FantaPronostic in modalità Arena 1vs1.
              </p>

              <p className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-brand-yellow/40 bg-brand-yellow/10 px-4 py-2 text-sm font-semibold text-brand-yellow">
                <CalendarDays size={15} aria-hidden="true" />
                Iscrizioni gratuite fino al {FP_CHAMPIONS.closingLabel}
              </p>

              <div className="mt-2 flex w-full flex-col items-center gap-3">
                <DownloadCta placement="hero" className="max-w-md" />
                <p className="flex items-center justify-center gap-1.5 text-xs text-white/60">
                  <ShieldCheck size={13} aria-hidden="true" />
                  Disponibile su App Store e Google Play
                </p>
              </div>

              <img
                src={FP_CHAMPIONS.heroImage}
                alt="Due mascotte di FantaPronostic si sfidano in campo nella modalità Arena 1vs1"
                width={928}
                height={1152}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="mt-6 h-auto w-full max-w-sm rounded-2xl"
              />
            </div>
          </div>
        </section>

        {/* ══ COME FUNZIONA ══════════════════════════════════════════════ */}
        <section className="bg-white py-10 md:py-14">
          <div className="container-x">
            <motion.h2
              {...reveal}
              className="text-center font-display text-2xl font-bold tracking-tightest text-ink md:text-4xl"
            >
              Come funziona
            </motion.h2>

            <ol className="mx-auto mt-6 grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2">
              {STEPS.map((s, i) => (
                <motion.li
                  key={s.title}
                  {...reveal}
                  transition={{ duration: 0.45, delay: i * 0.05 }}
                  className="card flex items-start gap-4 p-5"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-orange/10 text-brand-orange">
                    {s.icon}
                  </span>
                  <span>
                    <span className="flex items-baseline gap-2">
                      <span className="font-display text-sm font-bold text-muted2 tabular-nums">{i + 1}</span>
                      <span className="font-display text-base font-bold text-ink">{s.title}</span>
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted">{s.text}</span>
                  </span>
                </motion.li>
              ))}
            </ol>
          </div>
        </section>

        {/* ══ ARENA 1vs1 ═════════════════════════════════════════════════ */}
        <section
          className="py-12 md:py-16"
          style={{
            background: "radial-gradient(120% 100% at 50% 0%, #17347a 0%, #0a1c45 55%, #050f24 100%)",
          }}
        >
          <div className="container-x">
            <motion.div {...reveal} className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-2xl font-bold tracking-tightest text-white md:text-4xl">
                Ogni giornata è una sfida
              </h2>
              <p className="mt-4 leading-relaxed text-white/75">
                Nella modalità Arena 1vs1 non giochi solo contro la classifica: ogni giornata
                affronti un avversario scelto casualmente. I tuoi pronostici decidono lo scontro.
              </p>
            </motion.div>

            <div className="mx-auto mt-8 grid max-w-2xl grid-cols-3 gap-3">
              {OUTCOMES.map((o) => (
                <motion.div
                  key={o.label}
                  {...reveal}
                  className={`rounded-2xl border px-3 py-5 text-center ${o.tone}`}
                >
                  <span className="block text-[11px] font-bold uppercase tracking-[0.14em] opacity-80">
                    {o.label}
                  </span>
                  <span className="mt-2 block font-display text-3xl font-bold tabular-nums">{o.value}</span>
                  <span className="mt-0.5 block text-[11px] opacity-70">{o.note}</span>
                </motion.div>
              ))}
            </div>

            <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-white/60">
              Vince chi totalizza più punti in classifica.
            </p>
          </div>
        </section>

        {/* ══ PREMI ══════════════════════════════════════════════════════ */}
        <section className="bg-bg-soft py-10 md:py-14">
          <div className="container-x">
            <motion.div {...reveal} className="mx-auto max-w-xl text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-orange/10 text-brand-orange mx-auto">
                <Trophy size={26} aria-hidden="true" />
              </span>
              <h2 className="mt-4 font-display text-2xl font-bold tracking-tightest text-ink md:text-4xl">
                {FP_CHAMPIONS.prizePool} di montepremi
              </h2>
              <p className="mt-3 leading-relaxed text-muted">
                In palio buoni Amazon per un valore totale di {FP_CHAMPIONS.prizePool}.
              </p>
            </motion.div>
          </div>
        </section>

        {/* ══ CTA FINALE ═════════════════════════════════════════════════ */}
        <section className="bg-white py-12 md:py-16">
          <div className="container-x">
            <motion.div {...reveal} className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
              <h2 className="font-display text-2xl font-bold tracking-tightest text-ink md:text-4xl">
                Che aspetti?
              </h2>
              <p className="leading-relaxed text-muted">
                Entra gratis nella F.P Champions League e mettiti alla prova.
              </p>
              <DownloadCta placement="final" className="mt-2 max-w-md" />
              <p className="text-xs text-muted">Disponibile su App Store e Google Play</p>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Barra fissa su mobile, dopo il primo schermo. */}
      {showStickyCta && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur-md md:hidden">
          <div className="container-x flex items-center justify-between gap-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">F.P Champions League</p>
              <p className="text-xs text-muted">Gratis · {FP_CHAMPIONS.prizePool} in premi</p>
            </div>
            <StickyCta />
          </div>
        </div>
      )}

      <footer className="border-t border-line bg-white">
        <div className="container-x py-8 pb-24 text-center text-xs text-muted md:pb-8">
          © {new Date().getFullYear()} FantaPronostic. Tutti i diritti riservati.
        </div>
      </footer>
    </div>
  );
}

/** Versione compatta del CTA per la barra fissa. */
function StickyCta() {
  const platform = usePlatform();
  return (
    <a
      href={storeUrlFor(platform)}
      rel="noopener noreferrer"
      onClick={() => {
        if (platform === "ios") openAppStore();
        trackStoreClick(platform === "android" ? "google" : "apple", "sticky_bar");
      }}
      className="inline-flex min-h-[48px] shrink-0 items-center justify-center rounded-full bg-brand-orange px-6 font-display text-[15px] font-bold text-white shadow-cta"
    >
      Scarica gratis
    </a>
  );
}
