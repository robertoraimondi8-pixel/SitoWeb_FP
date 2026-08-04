import { useEffect, useRef, useState } from "react";
import { openAppStore, IOS_URL, ANDROID_URL } from "@/lib/storeLinks";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { track } from "@vercel/analytics";
import {
  ArrowLeft,
  ArrowRight,
  Trophy,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  Zap,
  Target,
  Lock,
  Mail,
  Smartphone,
  Key,
  ChevronDown,
  Gift,
  Newspaper,
  CalendarDays,
} from "lucide-react";
import {
  SUPER_LEAGUE, LEAGUES, SCORING, REGOLAMENTO, SPONSOR, findSuperLeagueCreator,
} from "@/data/superLeague";

const BACKEND_URL =
  (import.meta as any).env?.VITE_BACKEND_URL ||
  "https://api.fantapronostic.com";

// ─── Countdown ────────────────────────────────────────────────────────────────
function useCountdown(targetIso: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const target = new Date(targetIso).getTime();
  const diff = Math.max(0, target - now);
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    isOver: diff === 0,
  };
}

function CountdownBox({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="min-w-[62px] md:min-w-[76px] rounded-2xl bg-white/[0.07] border border-white/15 px-3 py-3.5 text-center backdrop-blur-md">
        <span className="font-display font-bold text-3xl md:text-[40px] leading-none text-white tabular-nums">
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <span className="text-[10px] md:text-[11px] uppercase tracking-[0.18em] font-bold text-white/50">
        {label}
      </span>
    </div>
  );
}

// Hand-drawn underline (stessa cifra stilistica della Home)
function Underline({ color = "#F58220" }: { color?: string }) {
  return (
    <svg
      className="absolute -bottom-2.5 left-0 w-full"
      viewBox="0 0 200 12"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M2 9C40 3 80 3 120 5C160 7 180 7 198 3"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Bandiere SVG (le emoji-bandiera non si vedono su Windows/desktop)
function Flag({ code }: { code: string }) {
  const common = "block h-4 w-6 rounded-[3px] ring-1 ring-black/10 shrink-0";
  switch (code) {
    case "it":
      return (
        <svg viewBox="0 0 3 2" className={common} aria-hidden="true">
          <rect width="1" height="2" x="0" fill="#009246" />
          <rect width="1" height="2" x="1" fill="#fff" />
          <rect width="1" height="2" x="2" fill="#CE2B37" />
        </svg>
      );
    case "fr":
      return (
        <svg viewBox="0 0 3 2" className={common} aria-hidden="true">
          <rect width="1" height="2" x="0" fill="#0055A4" />
          <rect width="1" height="2" x="1" fill="#fff" />
          <rect width="1" height="2" x="2" fill="#EF4135" />
        </svg>
      );
    case "de":
      return (
        <svg viewBox="0 0 3 3" className={common} aria-hidden="true">
          <rect width="3" height="1" y="0" fill="#000" />
          <rect width="3" height="1" y="1" fill="#DD0000" />
          <rect width="3" height="1" y="2" fill="#FFCE00" />
        </svg>
      );
    case "es":
      return (
        <svg viewBox="0 0 3 2" className={common} aria-hidden="true">
          <rect width="3" height="2" fill="#AA151B" />
          <rect width="3" height="1" y="0.5" fill="#F1BF00" />
        </svg>
      );
    case "en":
      return (
        <svg viewBox="0 0 5 3" className={common} aria-hidden="true">
          <rect width="5" height="3" fill="#fff" />
          <rect width="5" height="0.6" y="1.2" fill="#CE1124" />
          <rect width="0.6" height="3" x="2.2" fill="#CE1124" />
        </svg>
      );
    default:
      return null;
  }
}

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.55 },
};

export default function LeaguePage() {
  const [searchParams] = useSearchParams();
  const paymentStatus = searchParams.get("payment");

  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openArticle, setOpenArticle] = useState<number | null>(null);

  const [preEmail, setPreEmail] = useState("");
  const [preStatus, setPreStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [preCode, setPreCode] = useState("");
  const [preAlready, setPreAlready] = useState(false);

  const countdown = useCountdown(SUPER_LEAGUE.openingDate);
  // Override per test: /super-league?pay=1 mostra subito il pagamento Stripe.
  const forcePay = searchParams.get("pay") === "1";
  const isOpen = countdown.isOver || forcePay;

  // Creator del link: ?creator=<slug>. Se riconosciuto, la pagina lo cita e
  // precompila il suo codice sconto, così l'utente non deve digitarlo.
  const creatorParam = searchParams.get("creator");
  const creator = findSuperLeagueCreator(creatorParam);
  const [showStickyCta, setShowStickyCta] = useState(false);
  const [showRules, setShowRules] = useState(false);
  // Stesso rilevamento della Community League: su mobile un solo link, che
  // punta allo store giusto. Su desktop non si può indovinare, quindi due.
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");

  useEffect(() => {
    window.scrollTo(0, 0);
    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/i.test(ua)) setPlatform("ios");
    else if (/Android/i.test(ua)) setPlatform("android");
    // ?codice= esplicito ha la precedenza sul codice del creator.
    const codeFromUrl = searchParams.get("codice");
    if (codeFromUrl) setDiscountCode(codeFromUrl.trim());
    else if (creator?.code) setDiscountCode(creator.code);

    // Track landing view
    if (creatorParam) {
      track("creator_landing_view", {
        creator: creator?.slug || creatorParam,
        recognised: Boolean(creator),
      });
    } else {
      track("landing_view");
    }

    // Sticky CTA visibility
    const handleScroll = () => {
      setShowStickyCta(window.scrollY > window.innerHeight * 0.8);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [searchParams]);

  const handlePay = async () => {
    if (!email.trim() || !email.includes("@")) {
      setError("Inserisci un'email valida.");
      return;
    }
    if (email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      setError("Le due email non coincidono. Controlla e riprova.");
      return;
    }
    setError("");
    setLoading(true);
    track("checkout_started", { discount: Boolean(discountCode.trim()), creator: creatorParam || null });
    try {
      const path = window.location.pathname;
      const body: Record<string, unknown> = {
        email: email.trim(),
        league_id: SUPER_LEAGUE.leagueId,
        // {CHECKOUT_SESSION_ID} è un segnaposto che Stripe sostituisce al
        // ritorno: senza di esso la pagina di successo non può recuperare il
        // codice d'accesso reale e resterebbe con il solo messaggio email.
        success_url: `${window.location.origin}${path}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${window.location.origin}${path}?payment=cancelled`,
        metadata: creatorParam ? { creator: creatorParam } : undefined,
      };
      if (discountCode.trim()) body.discount_code = discountCode.trim().toUpperCase();

      const res = await fetch(`${BACKEND_URL}/api/payments/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.detail || "Errore durante la creazione del pagamento. Riprova.");
        return;
      }
      if (data?.url) {
        track("purchase_cta_click", { creator: creatorParam || null });
        window.location.href = data.url;
      }
      else setError("Risposta non valida dal server. Riprova.");
    } catch {
      setError("Errore di connessione. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  const handlePreRegister = async () => {
    if (!preEmail.trim() || !preEmail.includes("@")) {
      setPreStatus("err");
      return;
    }
    setPreStatus("loading");
    try {
      const res = await fetch(`${BACKEND_URL}/api/leagues/pre-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: preEmail.trim(),
          league_id: SUPER_LEAGUE.leagueId,
          language: "it",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error();
      setPreCode(data?.code || "");
      setPreAlready(Boolean(data?.already_registered));
      setPreStatus("ok");
      setPreEmail("");
      track("preregister", { already: Boolean(data?.already_registered) });
    } catch {
      setPreStatus("err");
    }
  };

  return (
    <div className="min-h-screen bg-bg-base">
      {paymentStatus === "success" && (
        <header className="bg-white border-b border-line">
          <div className="container-x py-5 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5">
              <img src="/brand-icon.png" alt="FantaPronostic" className="h-9 w-9 rounded-xl" />
              <span className="font-display font-bold text-[17px] tracking-tight text-ink">
                Fanta<span className="text-brand-orange">Pronostic</span>
              </span>
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-ink2 hover:text-brand-blue transition-colors"
            >
              <ArrowLeft size={16} />
              Home
            </Link>
          </div>
        </header>
      )}

      {paymentStatus === "cancelled" && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="container-x py-4 flex items-center gap-3 text-amber-800">
            <XCircle size={20} className="shrink-0" />
            <p className="text-sm font-semibold">
              Pagamento annullato. Nessun addebito è stato effettuato. Puoi riprovare quando vuoi.
            </p>
          </div>
        </div>
      )}

      {paymentStatus === "success" ? (
        <SuccessScreen />
      ) : (
        <>
        <main>
          {/* ══ HERO (NEW: 2 colonne desktop, premi centrali) ═══════════════ */}
          <section className="relative flex items-center overflow-hidden bg-[#050f24] pt-16 md:pt-8">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${SUPER_LEAGUE.heroImage})` }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(5,15,36,0.82) 0%, rgba(5,15,36,0.50) 35%, rgba(5,15,36,0.78) 75%, #050f24 100%)",
              }}
            />
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[620px] h-[380px] rounded-full bg-brand-orange/20 blur-[130px]" />

            {/* Top bar */}
            <div className="absolute top-0 inset-x-0 z-20">
              <div className="container-x py-5 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2.5">
                  <img src="/brand-icon.png" alt="FantaPronostic" className="h-9 w-9 rounded-xl" />
                  <span className="font-display font-bold text-[17px] tracking-tight text-white">
                    Fanta<span className="text-brand-orange">Pronostic</span>
                  </span>
                </Link>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white transition-colors"
                >
                  <ArrowLeft size={16} />
                  Home
                </Link>
              </div>
            </div>

            {/* Hero compatto e centrato: l'immagine dei premi arriva subito sotto,
                a piena larghezza, quindi qui non va ripetuta. */}
            <div className="relative z-10 container-x py-14 md:py-16">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center"
              >
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-4 py-1.5 text-[11px] font-bold text-white/90 uppercase tracking-[0.18em] backdrop-blur-md">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" />
                  {SUPER_LEAGUE.season}
                </div>

                <h1 className="font-display font-bold text-[clamp(2.1rem,7vw,3.75rem)] leading-[0.95] tracking-tightest text-white">
                  FantaPronostic
                  <span className="block relative mx-auto w-fit text-brand-orange">
                    Super League 2026/2027
                    <Underline />
                  </span>
                </h1>

                <p className="text-white/85 text-base md:text-lg leading-relaxed">
                  Pronostica le partite delle 5 grandi leghe europee, scala la classifica e gioca per{" "}
                  <strong className="text-white">oltre 5.000€ in premi</strong>.
                </p>

                <p className="text-sm md:text-base font-semibold text-brand-orange">
                  In palio: <strong className="text-white">Apple Pack · MacBook · PlayStation 5</strong>{" "}
                  + premi settimanali
                </p>

                {/* Le tre informazioni che decidono l'acquisto, su una riga sola. */}
                <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-white/80">
                  <CalendarDays size={15} className="text-brand-orange shrink-0" />
                  <span>Inizio <strong className="text-white">4 settembre 2026</strong></span>
                  <span className="text-white/30">·</span>
                  <span><strong className="text-white">Pass 39€</strong>, pagamento unico</span>
                  <span className="text-white/30">·</span>
                  <span>Nessun rinnovo</span>
                </p>

                {/* CTA: porta al form, non all'inizio della sezione. */}
                <div className="mt-2 flex w-full flex-col items-center gap-3">
                  <a
                    href="#checkout-form"
                    onClick={() => track("purchase_cta_click", { placement: "hero", creator: creatorParam })}
                    className="flex min-h-[60px] w-[calc(100%-2rem)] max-w-md items-center justify-center gap-2 rounded-full bg-brand-orange px-8 font-display font-bold text-[17px] text-white shadow-cta transition-transform hover:-translate-y-1 sm:w-auto sm:px-10"
                  >
                    Acquista il Pass — 39€
                    <ArrowRight size={19} />
                  </a>
                  <p className="flex items-center justify-center gap-1.5 text-xs text-white/60">
                    <ShieldCheck size={13} />
                    Pagamento sicuro con Stripe · Accesso inviato subito · Nessun rinnovo
                  </p>

                  {/* Secondario e discreto: l'obiettivo della pagina resta l'acquisto. */}
                  {platform === "other" ? (
                    <p className="text-xs text-white/50">
                      Hai già il Pass?{" "}
                      <a
                        href={IOS_URL}
                        rel="noopener noreferrer"
                        onClick={() => {
                          openAppStore();
                          track("store_cta_click", { store: "apple", cta_placement: "hero_secondary" });
                        }}
                        className="font-semibold text-white/80 underline underline-offset-2 hover:text-white"
                      >
                        Scarica su App Store
                      </a>{" "}
                      o{" "}
                      <a
                        href={ANDROID_URL}
                        rel="noopener noreferrer"
                        onClick={() => track("store_cta_click", { store: "google", cta_placement: "hero_secondary" })}
                        className="font-semibold text-white/80 underline underline-offset-2 hover:text-white"
                      >
                        Google Play
                      </a>
                    </p>
                  ) : (
                    <a
                      href={platform === "android" ? ANDROID_URL : IOS_URL}
                      rel="noopener noreferrer"
                      onClick={() => {
                        if (platform === "ios") openAppStore();
                        track("store_cta_click", {
                          store: platform === "android" ? "google" : "apple",
                          cta_placement: "hero_secondary",
                        });
                      }}
                      className="text-xs font-semibold text-white/60 underline underline-offset-2 transition-colors hover:text-white"
                    >
                      Hai già il Pass? Scarica l'app gratis
                    </a>
                  )}
                </div>

                {creator && (
                  <p className="text-xs font-semibold text-brand-orange">
                    Sei stato invitato da: <strong className="text-white">{creator.name}</strong>
                    {creator.code && (
                      <>
                        {" · "}
                        <span className="text-white">
                          il suo codice sconto è già inserito
                        </span>
                      </>
                    )}
                  </p>
                )}
              </motion.div>
            </div>
          </section>

          {/* ══ PREMI — l'immagine parla da sola, niente card che la ripetono ═ */}
          <section className="bg-white py-8 md:py-14">
            {/* Su mobile l'immagine esce dal container per guadagnare larghezza:
                è 16:9, quindi ogni pixel in più la rende più leggibile. */}
            <div className="mx-auto max-w-5xl px-2 md:px-4">
              <img
                src={SUPER_LEAGUE.prizesImage}
                alt="I premi della Super League: 1° Apple Pack, 2° MacBook, 3° PlayStation 5"
                width={1920}
                height={1080}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="h-auto w-full rounded-2xl md:rounded-3xl"
              />
              <p className="mt-3 px-2 text-center font-display font-bold text-base text-ink md:text-lg">
                1° Apple Pack · 2° MacBook · 3° PlayStation 5
              </p>
              <p className="mt-1 px-2 text-center text-xs text-muted">
                Montepremi {SUPER_LEAGUE.prizePool}. Modelli e configurazioni possono variare secondo
                disponibilità; i dettagli di consegna sono nel regolamento.
              </p>

              {/* Premio settimanale: fascia, non card alta. */}
              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-brand-orange/30 bg-brand-orange/5 px-4 py-3">
                <span className="text-xl leading-none">🎁</span>
                <p className="text-sm leading-snug text-ink2">
                  <strong className="text-ink">Ogni settimana:</strong> il punteggio più alto vince
                  l'accesso gratuito all'edizione successiva; dalla seconda vittoria consecutiva, un
                  buono Amazon da 20€.
                </p>
              </div>
            </div>
          </section>

          {/* ══ COME PARTECIPARE — fascia in 3 passi ═══════════════════════ */}
          <section className="py-8 md:py-12 bg-bg-soft">
            <div className="container-x">
              <h2 className="text-center font-display font-bold text-2xl md:text-3xl tracking-tightest text-ink">
                Come partecipare
              </h2>
              <ol className="mx-auto mt-5 flex max-w-3xl flex-col gap-2 md:flex-row md:gap-3">
                {[
                  ["Acquista il Pass", "39€, codice via email"],
                  ["Scarica l'app", "Registrati e inserisci il codice"],
                  ["Pronostica", "Ogni giornata, scala la classifica"],
                ].map(([title, desc], i) => (
                  <li
                    key={title}
                    className="flex flex-1 items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3"
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-orange/10 font-display font-bold text-sm text-brand-orange tabular-nums">
                      {i + 1}
                    </span>
                    <span className="leading-tight">
                      <span className="block font-semibold text-ink text-sm">{title}</span>
                      <span className="block text-xs text-muted">{desc}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* ══ MODALITÀ DI GIOCO — sintesi + dettaglio a scomparsa ════════ */}
          <section className="py-8 md:py-12">
            <div className="container-x">
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="font-display font-bold text-2xl md:text-3xl tracking-tightest text-ink">
                  Formato misto, tutti contro tutti
                </h2>
                <p className="mt-3 text-sm md:text-base text-muted leading-relaxed">
                  Circa 12 partite a giornata dalle 5 grandi leghe europee. Pronostici singoli e
                  multipli, partite X3 e classifica aggiornata per tutta la stagione.
                </p>
              </div>

              <div className="mx-auto mt-5 max-w-2xl">
                <button
                  type="button"
                  onClick={() => setShowRules((v) => !v)}
                  className="card flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-bg-soft"
                >
                  <span className="text-sm font-semibold text-ink">Scopri punteggio e regole</span>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-muted transition-transform ${showRules ? "rotate-180" : ""}`}
                  />
                </button>

                {showRules && (
                  <div className="card mt-2 p-5">
                    <ul className="flex flex-col divide-y divide-line">
                      {SCORING.map((s) => (
                        <li key={s.label} className="flex items-center justify-between py-2.5">
                          <span className="text-sm text-ink2">{s.label}</span>
                          <span className="chip-orange">
                            {s.points} {s.points === 1 ? "punto" : "punti"}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex items-center justify-between rounded-xl bg-bg-soft px-4 py-2.5">
                      <span className="text-sm font-semibold text-ink">Massimo per partita</span>
                      <span className="font-display font-bold text-ink tabular-nums">9 punti</span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-muted">
                      <strong className="text-ink">Partite X3:</strong> i punti di quella partita
                      valgono il triplo, fino a 27 punti.
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      <strong className="text-ink">Pronostici bloccati:</strong> si inseriscono entro
                      il fischio d'inizio della prima partita, poi la giornata non è più modificabile.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ══ CHECKOUT (NEW: 2 colonne su desktop) ═══════════════════════ */}
          <section id="acquista" className="scroll-mt-16 bg-bg-soft py-10 md:py-14">
            <div className="container-x">
              <h2 className="mx-auto mb-6 max-w-2xl text-center font-display font-bold text-2xl md:text-4xl tracking-tightest text-ink">
                Entra nella Super League
              </h2>

              <div className="max-w-5xl mx-auto">
                {isOpen ? (
                  <CheckoutLayout
                    email={email}
                    setEmail={setEmail}
                    confirmEmail={confirmEmail}
                    setConfirmEmail={setConfirmEmail}
                    discountCode={discountCode}
                    setDiscountCode={setDiscountCode}
                    loading={loading}
                    error={error}
                    onPay={handlePay}
                  />
                ) : (
                  <div className="max-w-md mx-auto">
                    <PreRegisterCard
                      preEmail={preEmail}
                      setPreEmail={setPreEmail}
                      preStatus={preStatus}
                      preCode={preCode}
                      preAlready={preAlready}
                      onPreRegister={handlePreRegister}
                    />
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ══ BONUS SHOPY COOL — compatto, una volta sola, dopo il checkout ═ */}
          <section className="py-8 md:py-10">
            <div className="container-x">
              <div className="mx-auto flex max-w-3xl items-center gap-4 rounded-2xl border border-brand-orange/20 bg-brand-orange/5 p-4 md:p-5">
                <a href={SPONSOR.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  <img
                    src={SPONSOR.logo}
                    alt={SPONSOR.name}
                    className="h-14 w-14 object-contain md:h-16 md:w-16"
                  />
                </a>
                <div className="min-w-0">
                  <p className="font-display font-bold text-ink">
                    Bonus {SPONSOR.name} — primi {SPONSOR.perkLimit} iscritti
                  </p>
                  <p className="mt-1 text-sm leading-snug text-muted">
                    Buono da {SPONSOR.voucher}€ su una spesa minima di {SPONSOR.minSpend}€, online e in
                    negozio.{" "}
                    <a
                      href={SPONSOR.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-brand-orange hover:underline"
                    >
                      Scopri di più
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ══ FAQ (chiaro) ═══════════════════════════════════════════════ */}
          <section className="section-pad bg-bg-soft">
            <div className="container-x">
              <motion.div {...reveal} className="max-w-2xl mx-auto text-center">
                <p className="overline justify-center">FAQ</p>
                <h2 className="mt-4 font-display font-bold text-3xl md:text-4xl tracking-tightest text-ink">
                  Domande frequenti
                </h2>
              </motion.div>
              <div className="mt-10 max-w-2xl mx-auto flex flex-col gap-6">
                {FAQ.map((faq, i) => (
                  <div key={i} className="border-b border-line pb-6 last:border-0">
                    <h3 className="font-semibold text-ink text-base">{faq.q}</h3>
                    <p className="mt-2 text-sm text-muted leading-relaxed">{faq.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ══ REGOLAMENTO (chiaro) ═══════════════════════════════════════ */}
          <section className="section-pad">
            <div className="container-x">
              <motion.div {...reveal} className="max-w-2xl mx-auto text-center">
                <p className="overline justify-center">Regolamento</p>
                <h2 className="mt-4 font-display font-bold text-3xl md:text-4xl tracking-tightest text-ink">
                  Regolamento completo
                </h2>
                <p className="mt-3 text-muted">
                  Super League 2026/2027 · {REGOLAMENTO.length} articoli
                </p>
              </motion.div>

              <div className="mt-10 max-w-2xl mx-auto flex flex-col gap-2.5">
                {REGOLAMENTO.map((art) => {
                  const open = openArticle === art.n;
                  return (
                    <div key={art.n} className="card overflow-hidden">
                      <button
                        onClick={() => setOpenArticle(open ? null : art.n)}
                        className="w-full flex items-center justify-between gap-3 p-5 text-left hover:bg-bg-soft transition-colors"
                      >
                        <span className="text-sm font-semibold text-ink">
                          <span className="text-brand-orange">Art. {art.n}</span> · {art.title}
                        </span>
                        <ChevronDown
                          size={18}
                          className={`text-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                        />
                      </button>
                      {open && (
                        <div className="px-5 pb-5 -mt-1">
                          <p className="text-sm text-ink2 leading-relaxed whitespace-pre-line">
                            {art.body}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </main>

        {/* Sticky CTA bar su mobile (appare dopo scroll) */}
        {isOpen && showStickyCta && (
          <div className="fixed bottom-0 inset-x-0 z-40 md:hidden border-t border-line bg-white">
            <div className="container-x py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-ink">Pass Super League</p>
                <p className="text-xs text-muted">39€ · Pagamento unico</p>
              </div>
              <a
                href="#checkout-form"
                onClick={() => track("purchase_cta_click", { placement: "sticky_bar", creator: creatorParam })}
                className="btn-primary min-h-[52px] whitespace-nowrap px-7 text-[16px] font-bold"
              >
                Acquista
              </a>
            </div>
          </div>
        )}
        </>
      )}

      <footer className="border-t border-line bg-white">
        <div className="container-x py-8 pb-24 md:pb-8 text-center text-xs text-muted">
          © {new Date().getFullYear()} FantaPronostic. Tutti i diritti riservati.
        </div>
      </footer>
    </div>
  );
}

const FAQ = [
  {
    q: "Cosa acquisto esattamente?",
    a: "Acquisti il Piano editoriale digitale 2026/2027 (contenuti statistici, approfondimenti e aggiornamenti della stagione). L'accesso alla Super League 2026/2027 è incluso nel piano: dopo il pagamento ricevi via email il prodotto e il codice da riscattare nell'app.",
  },
  {
    q: "Come funziona lo sconto del 10%?",
    a: "Se ti sei pre-iscritto ricevi un codice sconto personale via email. Inseriscilo nel campo 'Codice sconto' al momento dell'acquisto (o arrivi già col codice dal link email): lo sconto viene applicato automaticamente al checkout. Se non hai un codice, paghi il prezzo pieno.",
  },
  {
    q: "Non ho ancora l'app. Posso acquistare lo stesso?",
    a: "Sì. Completa l'acquisto con la tua email, poi scarica FantaPronostic, registrati o accedi e inserisci il codice ricevuto via email per entrare nella Super League.",
  },
  {
    q: "Il pagamento si rinnova automaticamente?",
    a: "No. È un pagamento unico per la stagione 2026/2027, senza rinnovo automatico e senza addebiti ricorrenti.",
  },
  {
    q: "Come vengono selezionate le partite?",
    a: "Ogni giornata è composta indicativamente da 12 partite scelte da FantaPronostic, anche da campionati e competizioni differenti. L'elenco viene pubblicato nell'app prima dell'apertura dei pronostici.",
  },
  {
    q: "Come ricevo il premio se vinco?",
    a: "A fine stagione i vincitori vengono contattati all'email dell'account. I premi finali (Apple Pack, MacBook, PS5) vengono consegnati previa verifica dell'identità. Consulta il regolamento per tutti i dettagli.",
  },
  {
    q: "Posso partecipare con più account?",
    a: "No. Ogni acquisto dà accesso a un solo account e la partecipazione con account multipli, dati falsi o sistemi automatizzati comporta l'esclusione senza rimborso.",
  },
];

// ─── Pre-iscrizione card ──────────────────────────────────────────────────────
function PreRegisterCard({
  preEmail,
  setPreEmail,
  preStatus,
  preCode,
  preAlready,
  onPreRegister,
}: {
  preEmail: string;
  setPreEmail: (v: string) => void;
  preStatus: "idle" | "loading" | "ok" | "err";
  preCode: string;
  preAlready: boolean;
  onPreRegister: () => void;
}) {
  return (
    <div className="card p-8 flex flex-col gap-5">
      <div className="text-center">
        <div className="h-14 w-14 rounded-2xl bg-brand-orange/10 grid place-items-center text-brand-orange mx-auto mb-4">
          <Newspaper size={26} />
        </div>
        <h3 className="font-display font-bold text-2xl text-ink">Pre-iscriviti ora</h3>
        <p className="text-sm text-muted mt-2 leading-relaxed">
          Le iscrizioni aprono il <strong>{SUPER_LEAGUE.openingLabel}</strong>. Pre-iscriviti
          adesso: è gratis, ti dà il <strong>10% di sconto</strong> sul Pass e, per i primi{" "}
          <strong>100</strong>, un <strong>buono Shopy Cool da 39€</strong>.
        </p>
      </div>

      <div className="rounded-2xl bg-brand-orange/5 border border-brand-orange/20 p-4 text-xs text-ink2 leading-relaxed">
        La pre-iscrizione non comporta alcun pagamento: dà diritto allo sconto del 10% e, per i
        primi 100, al buono Shopy Cool da 39€ (su spesa minima di 600€) — di fatto è come entrare
        gratis.
      </div>

      {preStatus === "ok" ? (
        <div className="flex flex-col items-center text-center gap-3 py-2">
          <div className="h-12 w-12 rounded-full bg-green-100 grid place-items-center text-green-600">
            <CheckCircle2 size={24} />
          </div>
          <p className="font-semibold text-ink">
            {preAlready ? "Sei già pre-iscritto!" : "Controlla la tua email!"}
          </p>
          <p className="text-sm text-muted">
            Ti abbiamo inviato il tuo <strong>codice sconto del 10%</strong>. Se non lo trovi,
            controlla lo spam.
          </p>
          {preCode && (
            <div className="mt-1 w-full rounded-2xl border border-dashed border-brand-orange/50 bg-brand-orange/5 px-4 py-3">
              <p className="text-[11px] uppercase tracking-widest text-muted font-bold">
                Il tuo codice
              </p>
              <p className="mt-1 font-display font-bold text-xl text-brand-orange tabular-nums select-all">
                {preCode}
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted font-bold mb-2 block">
              La tua email
            </label>
            <input
              type="email"
              value={preEmail}
              onChange={(e) => setPreEmail(e.target.value)}
              placeholder="nome@esempio.it"
              className="w-full rounded-2xl border border-line bg-bg-soft px-5 py-3.5 text-ink placeholder:text-muted focus:outline-none focus:border-brand-blue focus:bg-white transition-colors"
            />
          </div>
          {preStatus === "err" && (
            <p className="text-sm text-red-600 font-medium">
              Non è stato possibile completare la pre-iscrizione. Controlla l'email e la connessione,
              poi riprova.
            </p>
          )}
          <button
            onClick={onPreRegister}
            disabled={preStatus === "loading"}
            className="btn-primary justify-center disabled:opacity-70 disabled:cursor-wait"
          >
            {preStatus === "loading" ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Invio…
              </>
            ) : (
              <>
                Pre-iscriviti e risparmia il 10%
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}

// ─── Checkout Layout (2 colonne desktop) ──────────────────────────────────────
function CheckoutLayout({
  email,
  setEmail,
  confirmEmail,
  setConfirmEmail,
  discountCode,
  setDiscountCode,
  loading,
  error,
  onPay,
}: {
  email: string;
  setEmail: (v: string) => void;
  confirmEmail: string;
  setConfirmEmail: (v: string) => void;
  discountCode: string;
  setDiscountCode: (v: string) => void;
  loading: boolean;
  error: string;
  onPay: () => void;
}) {
  return (
    // Su mobile il form viene prima: prezzo, email e pulsante devono essere
    // la prima cosa visibile dopo il click sul CTA. Su desktop torna a sinistra.
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-10">
      <motion.div
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="order-2 flex flex-col gap-8 md:order-1"
      >
        <div>
          <h3 className="mb-6 hidden font-display font-bold text-2xl text-ink md:block">
            Cosa ricevi
          </h3>
          <p className="mb-4 font-display font-bold text-lg text-ink md:hidden">
            Cosa comprende il Pass
          </p>
          <ul className="flex flex-col gap-5">
            <li className="flex items-start gap-4">
              <Trophy size={20} className="text-brand-orange shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-ink">Montepremi {SUPER_LEAGUE.prizePool}</p>
                <p className="text-sm text-muted mt-1">Competisci per tutta la stagione 2026/2027</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <Gift size={20} className="text-brand-orange shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-ink">Premi settimanali</p>
                <p className="text-sm text-muted mt-1">Accesso gratuito stagione prossima, poi buoni Amazon 20€</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <Newspaper size={20} className="text-brand-orange shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-ink">Piano editoriale digitale incluso</p>
                <p className="text-sm text-muted mt-1">Contenuti statistici e approfondimenti della stagione</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <CheckCircle2 size={20} className="text-brand-orange shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-ink">Pagamento unico · Nessun rinnovo</p>
                <p className="text-sm text-muted mt-1">39€ una volta sola, senza addebiti ricorrenti</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <Zap size={20} className="text-brand-orange shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-ink">Accesso inviato immediatamente</p>
                <p className="text-sm text-muted mt-1">Codice univoco via email, riscattabile subito nell'app</p>
              </div>
            </li>
          </ul>
        </div>
      </motion.div>

      {/* Form pagamento */}
      <motion.div
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="order-1 md:order-2"
      >
        <PurchaseCard
          email={email}
          setEmail={setEmail}
          confirmEmail={confirmEmail}
          setConfirmEmail={setConfirmEmail}
          discountCode={discountCode}
          setDiscountCode={setDiscountCode}
          loading={loading}
          error={error}
          onPay={onPay}
        />
      </motion.div>
    </div>
  );
}

// ─── Purchase card ────────────────────────────────────────────────────────────
function PurchaseCard({
  email,
  setEmail,
  confirmEmail,
  setConfirmEmail,
  discountCode,
  setDiscountCode,
  loading,
  error,
  onPay,
}: {
  email: string;
  setEmail: (v: string) => void;
  confirmEmail: string;
  setConfirmEmail: (v: string) => void;
  discountCode: string;
  setDiscountCode: (v: string) => void;
  loading: boolean;
  error: string;
  onPay: () => void;
}) {
  // Con un codice già presente (link creator o ?codice=) il campo nasce aperto:
  // l'utente deve poter vedere e correggere ciò che sta per essere applicato.
  const [showDiscount, setShowDiscount] = useState(Boolean(discountCode));
  const cardRef = useRef<HTMLDivElement | null>(null);
  const prefilled = useRef(Boolean(discountCode));

  useEffect(() => {
    if (discountCode && !prefilled.current) {
      prefilled.current = true;
      setShowDiscount(true);
    }
  }, [discountCode]);

  // checkout_form_view: registrato una sola volta, quando il form entra davvero
  // nello schermo — non al montaggio, altrimenti conterebbe anche chi non scorre.
  useEffect(() => {
    const node = cardRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          track("checkout_form_view");
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div
      id="checkout-form"
      ref={cardRef}
      // scroll-mt tiene il titolo della scheda sotto la barra fissa dopo il salto.
      className="card flex scroll-mt-24 flex-col gap-6 p-6 md:scroll-mt-16 md:p-10"
    >
      {/* Prezzo in evidenza */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Pass Super League 2026/2027</p>
        <div className="font-display font-bold text-5xl text-ink md:text-6xl">€{SUPER_LEAGUE.price}</div>
        <p className="text-sm text-muted mt-3 leading-relaxed">
          Il Pass comprende il Piano editoriale digitale 2026/2027 e l'accesso alla FantaPronostic Super League.
        </p>
      </div>

      {/* Form */}
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-xs uppercase tracking-widest text-muted font-bold mb-2 block">
            La tua email
          </label>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@esempio.it"
            className="w-full rounded-2xl border border-line bg-bg-soft px-5 py-3.5 text-ink placeholder:text-muted focus:outline-none focus:border-brand-blue focus:bg-white transition-colors"
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-widest text-muted font-bold mb-2 block">
            Conferma email
          </label>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder="nome@esempio.it"
            className="w-full rounded-2xl border border-line bg-bg-soft px-5 py-3.5 text-ink placeholder:text-muted focus:outline-none focus:border-brand-blue focus:bg-white transition-colors"
          />
          <p className="mt-2 text-xs text-muted">
            Il codice di accesso arriva a questo indirizzo: lo chiediamo due volte per evitare
            errori di battitura.
          </p>
        </div>

        {/* Collapsible: Codice sconto */}
        {!showDiscount && (
          <button
            type="button"
            onClick={() => setShowDiscount(true)}
            className="text-sm text-muted hover:text-brand-blue transition-colors text-left font-semibold"
          >
            Hai un codice sconto?
          </button>
        )}

        {showDiscount && (
          <div>
            <label className="text-xs uppercase tracking-widest text-muted font-bold mb-2 block">
              Codice sconto
            </label>
            <input
              type="text"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value)}
              placeholder="Es. SUPER10-XXXXXX"
              className="w-full rounded-2xl border border-line bg-bg-soft px-5 py-3.5 text-ink placeholder:text-muted uppercase focus:outline-none focus:border-brand-blue focus:bg-white transition-colors"
            />
            {discountCode.trim() && (
              <p className="text-xs text-green-700 font-medium mt-2 flex items-center gap-1.5">
                <CheckCircle2 size={12} className="shrink-0" />
                Codice applicato: lo sconto verrà calcolato al checkout.
              </p>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

      {/* CTA Principale */}
      <button
        onClick={onPay}
        disabled={loading}
        className="btn-primary justify-center disabled:opacity-70 disabled:cursor-wait py-4 text-base font-bold"
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Reindirizzamento…
          </>
        ) : (
          <>
            Continua al pagamento sicuro — €{SUPER_LEAGUE.price}
            <ArrowRight size={18} />
          </>
        )}
      </button>

      {/* Security badge */}
      <p className="text-center text-xs text-muted flex items-center justify-center gap-1.5">
        <ShieldCheck size={13} />
        Pagamento sicuro Stripe · Nessun dato della carta salvato
      </p>
    </div>
  );
}

// ─── Success screen ───────────────────────────────────────────────────────────
function SuccessScreen() {
  const [searchParams] = useSearchParams();
  const sessionId = (searchParams.get("session_id") || "").trim();

  // Il codice d'accesso nasce nel webhook Stripe, che arriva pochi istanti dopo
  // il ritorno sul sito. Finché non c'è, si aspetta: mai un valore inventato.
  const [state, setState] = useState<"loading" | "ready" | "email">(
    sessionId.startsWith("cs_") ? "loading" : "email",
  );
  const [access, setAccess] = useState<{ code: string; join_url?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    track("payment_success_page_view");
  }, []);

  useEffect(() => {
    if (!sessionId.startsWith("cs_")) return;
    let stopped = false;
    const deadline = Date.now() + 20000;   // ~20s, poi si rimanda all'email

    const poll = async () => {
      try {
        const res = await fetch(
          `${BACKEND_URL}/api/payments/session-code?session_id=${encodeURIComponent(sessionId)}`,
        );
        const data = await res.json().catch(() => ({}));
        if (stopped) return;
        if (res.ok && data?.status === "ready" && data?.code) {
          setAccess({ code: data.code, join_url: data.join_url });
          setState("ready");
          return;
        }
      } catch {
        /* rete instabile: si riprova finché resta tempo */
      }
      if (stopped) return;
      if (Date.now() >= deadline) setState("email");
      else setTimeout(poll, 2000);
    };

    poll();
    return () => {
      stopped = true;
    };
  }, [sessionId]);

  const handleCopyCode = () => {
    if (!access?.code) return;
    navigator.clipboard.writeText(access.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="container-x py-16 md:py-24">
      <div className="mx-auto max-w-2xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="card flex flex-col items-center gap-8 p-8 text-center md:p-12"
        >
          <div className="grid h-20 w-20 place-items-center rounded-full bg-green-100 text-green-600">
            <CheckCircle2 size={40} />
          </div>

          <div>
            <h1 className="font-display font-bold text-4xl tracking-tightest text-ink md:text-5xl">
              Pagamento completato!
            </h1>
            <p className="mt-3 text-lg text-muted">
              Il tuo accesso alla Super League è pronto.
            </p>
          </div>

          {/* Codice d'accesso: mostrato solo quando è quello vero. */}
          {state === "loading" && (
            <div className="flex w-full items-center gap-3 rounded-2xl border border-line bg-bg-soft p-6 text-left">
              <Loader2 size={20} className="shrink-0 animate-spin text-brand-orange" />
              <p className="text-sm text-ink2">
                Stiamo preparando il tuo codice d'accesso… ci vogliono pochi secondi.
              </p>
            </div>
          )}

          {state === "ready" && access && (
            <div className="w-full rounded-2xl border-2 border-brand-orange bg-brand-orange/5 p-8">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted">
                Il tuo codice di accesso
              </p>
              <div className="mb-4 select-all font-display font-bold text-3xl tracking-[0.15em] text-brand-orange">
                {access.code}
              </div>
              <button
                onClick={handleCopyCode}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-orange px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-orange/90"
              >
                {copied ? (
                  <>
                    <CheckCircle2 size={18} />
                    Codice copiato!
                  </>
                ) : (
                  <>📋 Copia codice</>
                )}
              </button>
            </div>
          )}

          {/* Nessun session_id, o webhook in ritardo: l'email resta la via sicura. */}
          {state === "email" && (
            <div className="w-full rounded-2xl border border-line bg-bg-soft p-6 text-left">
              <div className="mb-2 flex items-center gap-2">
                <Mail size={18} className="text-brand-orange" />
                <p className="font-semibold text-ink">Ti abbiamo inviato il codice per email</p>
              </div>
              <p className="text-sm leading-relaxed text-muted">
                Controlla la posta (anche lo spam): trovi il prodotto editoriale e il codice univoco
                per entrare nella Super League. Se non arriva entro qualche minuto, scrivici.
              </p>
            </div>
          )}

          {/* Ingresso in lega: il link diretto esiste solo con il codice vero. */}
          <div className="flex w-full flex-col gap-3">
            {state === "ready" && access?.join_url ? (
              <a
                href={access.join_url}
                onClick={() => track("deeplink_click", { placement: "success_screen" })}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-8 py-4 font-display font-bold text-lg text-white transition-colors hover:bg-ink/90"
              >
                Apri FantaPronostic ed entra nella lega
                <ArrowRight size={20} />
              </a>
            ) : (
              <p className="text-sm text-muted">
                Scarica l'app e inserisci il codice ricevuto per entrare nella lega.
              </p>
            )}
          </div>

          <div className="flex w-full flex-col gap-3 border-t border-line pt-4">
            <p className="text-sm font-semibold text-muted">Non hai ancora l'app?</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href="https://apps.apple.com/it/app/fantapronostic/id6760613936"
                rel="noopener noreferrer"
                onClick={openAppStore}
                className="btn-blue flex-1 justify-center text-sm"
              >
                Scarica su App Store
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=com.fantapronostic.app"
                rel="noopener noreferrer"
                className="btn-primary flex-1 justify-center text-sm"
              >
                Scarica su Google Play
              </a>
            </div>
          </div>

          <div className="w-full rounded-2xl border border-line bg-bg-soft p-6 text-center">
            <p className="mb-1 text-sm font-semibold text-ink">Hai problemi?</p>
            <p className="text-xs text-muted">
              Contatta il nostro supporto:{" "}
              <a href="mailto:info@fantapronostic.com" className="text-brand-blue hover:underline">
                info@fantapronostic.com
              </a>
            </p>
          </div>

          <Link to="/" className="text-sm font-semibold text-muted transition-colors hover:text-brand-blue">
            Torna alla home
          </Link>
        </motion.div>
      </div>
    </main>
  );
}
