import { useState, useEffect } from "react";
import { openAppStore } from "@/lib/storeLinks";
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
import { SUPER_LEAGUE, LEAGUES, SCORING, REGOLAMENTO, SPONSOR } from "@/data/superLeague";

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

  // Creator personalizzazione (da URL o session)
  const creatorParam = searchParams.get("creator");
  const [mobileSlideIndex, setMobileSlideIndex] = useState(0);
  const [showStickyCta, setShowStickyCta] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    const codeFromUrl = searchParams.get("codice");
    if (codeFromUrl) setDiscountCode(codeFromUrl.trim());

    // Track landing view
    if (creatorParam) {
      track("creator_landing_view", { creator: creatorParam });
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
        success_url: `${window.location.origin}${path}?payment=success`,
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
          <section className="relative overflow-hidden bg-[#050f24] min-h-screen flex items-center pt-20 md:pt-0">
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

            {/* Main content: 2 colonne su desktop */}
            <div className="relative z-10 container-x py-12 md:py-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">

                {/* COLONNA SX: Testo, benefici, CTA */}
                <motion.div
                  initial={{ opacity: 0, x: -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.7 }}
                  className="flex flex-col gap-6 text-center md:text-left"
                >
                  {/* Badge */}
                  <div className="flex justify-center md:justify-start">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-4 py-1.5 text-[11px] font-bold text-white/90 uppercase tracking-[0.18em] backdrop-blur-md">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" />
                      {SUPER_LEAGUE.season}
                    </div>
                  </div>

                  {/* Titolo */}
                  <h1 className="font-display font-bold text-[clamp(2.2rem,5vw,3.5rem)] leading-[0.95] tracking-tightest text-white">
                    FantaPronostic
                    <span className="block relative w-fit text-brand-orange">
                      Super League 2026/2027
                      <Underline />
                    </span>
                  </h1>

                  {/* Sottotitolo con promessa */}
                  <p className="text-white/85 text-base md:text-lg leading-relaxed max-w-md">
                    Pronostica le partite delle 5 grandi leghe europee, scala la classifica e gioca per{" "}
                    <strong className="text-white">oltre 5.000€ in premi</strong>.
                  </p>

                  {/* Premi in evidenza (visibili su mobile come riga) */}
                  <p className="text-sm md:text-base text-brand-orange font-semibold">
                    In palio: <strong className="text-white">Apple Pack · MacBook · PlayStation 5</strong> + premi settimanali
                  </p>

                  {/* Info cruciali */}
                  <div className="flex flex-col gap-2 text-sm text-white/75 md:text-base">
                    <p className="flex items-center justify-center md:justify-start gap-2">
                      <CalendarDays size={16} className="text-brand-orange shrink-0" />
                      <strong className="text-white">Inizio 4 settembre 2026</strong>
                    </p>
                    <p className="flex items-center justify-center md:justify-start gap-2">
                      <span className="text-base">💰</span>
                      <strong className="text-white">Pass stagione 39€ · Pagamento unico</strong>
                    </p>
                    <p className="flex items-center justify-center md:justify-start gap-2">
                      <span className="text-base">✓</span>
                      <strong className="text-white">Nessun rinnovo automatico</strong>
                    </p>
                  </div>

                  {/* CTA Principale */}
                  <div className="flex flex-col items-center md:items-start gap-4 pt-4">
                    <a
                      href="#acquista"
                      onClick={() => track("purchase_cta_click", { placement: "hero", creator: creatorParam })}
                      className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-8 py-4 font-display font-bold text-base text-white shadow-cta hover:-translate-y-1 transition-transform w-full md:w-auto justify-center md:justify-start"
                    >
                      Acquista il Pass — 39€
                      <ArrowRight size={18} />
                    </a>
                    <p className="text-xs text-white/60 flex items-center justify-center md:justify-start gap-1.5">
                      <ShieldCheck size={13} />
                      Pagamento sicuro con Stripe · Accesso inviato subito · Nessun rinnovo
                    </p>
                  </div>

                  {creatorParam && (
                    <p className="text-xs text-brand-orange font-semibold mt-2">
                      Invito di <strong className="text-white">{creatorParam}</strong>
                    </p>
                  )}
                </motion.div>

                {/* COLONNA DX: Premi (desktop) oppure slider (mobile) */}
                <motion.div
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.7, delay: 0.1 }}
                  className="hidden md:flex flex-col items-center gap-6"
                >
                  {/* Desktop: mostra i premi fissi */}
                  <img
                    src={SUPER_LEAGUE.prizesImage}
                    alt="Premi: 1° Apple Pack, 2° MacBook, 3° PlayStation 5"
                    className="w-full max-w-sm rounded-2xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]"
                  />
                  <p className="text-xs text-white/50 text-center">
                    I modelli e le configurazioni possono variare.
                  </p>
                </motion.div>
              </div>

              {/* Mobile: slider compatto dei premi (solo visibile su mobile) */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="md:hidden flex flex-col items-center gap-4 mt-8"
              >
                <div className="relative w-full max-w-xs overflow-hidden rounded-2xl">
                  <img
                    src={SUPER_LEAGUE.prizesImage}
                    alt="Premi"
                    className="w-full h-auto"
                  />
                </div>
                <p className="text-xs text-white/50 text-center">
                  Swipe per i dettagli premi
                </p>
              </motion.div>
            </div>
          </section>

          {/* ══ PREMI COMPLETI (subito dopo hero, chiaro e trasparente) ═════ */}
          <section className="section-pad bg-white">
            <div className="container-x">
              <motion.div {...reveal} className="text-center max-w-2xl mx-auto mb-12">
                <p className="overline justify-center">I premi in palio</p>
                <h2 className="mt-4 font-display font-bold text-3xl md:text-5xl tracking-tightest text-ink">
                  Montepremi oltre 5.000€
                </h2>
                <p className="mt-4 text-muted leading-relaxed">
                  Competisci per tutta la stagione 2026/2027 e vinci premi importanti, dal primo giorno.
                </p>
              </motion.div>

              {/* Tre premi principali */}
              <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                {[
                  {
                    pos: "1°",
                    name: "Apple Pack",
                    desc: "iPhone Pro · AirPods Pro · Apple Watch",
                    color: "border-brand-orange ring-2 ring-brand-orange/20 shadow-cta",
                  },
                  {
                    pos: "2°",
                    name: "MacBook Neo 13",
                    desc: "Laptop premium per la nuova era",
                    color: "border-brand-blue ring-2 ring-brand-blue/20",
                  },
                  {
                    pos: "3°",
                    name: "PlayStation 5 Slim",
                    desc: "Console next-gen ultima generazione",
                    color: "border-purple-500 ring-2 ring-purple-500/20",
                  },
                ].map((prize, i) => (
                  <motion.div
                    key={i}
                    {...reveal}
                    transition={{ duration: 0.55, delay: i * 0.08 }}
                    className={`card p-8 text-center flex flex-col gap-4 border-2 ${prize.color}`}
                  >
                    <span className="font-display font-bold text-5xl text-ink/40">{prize.pos}</span>
                    <h3 className="font-display font-bold text-2xl text-ink">{prize.name}</h3>
                    <p className="text-sm text-muted leading-relaxed flex-1">{prize.desc}</p>
                    <p className="text-xs text-muted/70 border-t border-line pt-4">
                      Consegnato al termine della stagione
                    </p>
                  </motion.div>
                ))}
              </div>

              {/* Premio settimanale */}
              <motion.div
                {...reveal}
                className="mt-12 max-w-2xl mx-auto rounded-3xl border-2 border-brand-orange/30 bg-brand-orange/5 p-8"
              >
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-brand-orange/20 grid place-items-center text-brand-orange shrink-0 font-display font-bold text-xl">
                    🎁
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-2xl text-ink">Premio settimanale</h3>
                    <p className="mt-2 text-ink2 leading-relaxed">
                      Ogni giornata, il punteggio più alto vince un accesso gratuito all'edizione successiva della Super League. Dalla seconda vittoria consecutiva, un buono Amazon da 20€.
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Nota trasparenza */}
              <p className="text-center text-muted text-xs mt-10 max-w-2xl mx-auto">
                I modelli e le configurazioni esatte dei premi possono variare in base alla disponibilità al momento dell'assegnazione.
                Consulta il regolamento per tutti i dettagli di consegna e vincoli.
              </p>
            </div>
          </section>

          {/* ══ FASCIA FIDUCIA (minimalista) ════════════════════════════════ */}
          <section className="bg-ink py-6 md:py-8">
            <div className="container-x">
              <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 text-center md:text-left">
                <div className="flex flex-col items-center gap-2">
                  <ShieldCheck size={20} className="text-brand-orange" />
                  <p className="text-xs text-white/80">
                    <strong>Pagamento sicuro</strong>
                    <br />
                    Stripe certificato
                  </p>
                </div>
                <div className="h-10 w-px bg-white/15 hidden md:block" />
                <div className="flex flex-col items-center gap-2">
                  <span className="text-2xl">💰</span>
                  <p className="text-xs text-white/80">
                    <strong>Accesso immediato</strong>
                    <br />
                    Codice inviato subito
                  </p>
                </div>
                <div className="h-10 w-px bg-white/15 hidden md:block" />
                <div className="flex flex-col items-center gap-2">
                  <span className="text-2xl">✓</span>
                  <p className="text-xs text-white/80">
                    <strong>Nessun rinnovo</strong>
                    <br />
                    Pagamento unico
                  </p>
                </div>
              </div>
            </div>
          </section>


          {/* ══ VIDEO/DEMO DELL'APP (chiaro) ═══════════════════════════════ */}
          <section className="section-pad">
            <div className="container-x">
              <motion.div {...reveal} className="text-center max-w-2xl mx-auto mb-12">
                <p className="overline justify-center">Entra in lega</p>
                <h2 className="mt-4 font-display font-bold text-3xl md:text-5xl tracking-tightest text-ink">
                  Mettiti alla prova ogni settimana
                </h2>
                <p className="mt-4 text-muted leading-relaxed">
                  Circa 12 partite selezionate a giornata, pronostici singoli e multipli, partite X3 e classifica aggiornata durante la stagione.
                </p>
              </motion.div>

              {/* Placeholder video/mockup */}
              <motion.div {...reveal} className="max-w-4xl mx-auto rounded-3xl overflow-hidden bg-gradient-to-b from-brand-orange/10 to-transparent border border-line">
                <div className="aspect-video bg-ink/5 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="h-20 w-20 rounded-full bg-brand-orange/20 grid place-items-center text-brand-orange">
                      <Smartphone size={40} />
                    </div>
                    <p className="text-lg font-semibold text-ink">Demo dell'app in arrivo</p>
                    <p className="text-sm text-muted max-w-xs">
                      Video interattivo che mostra apertura dell'app, pagina Super League, pronostici, classifica.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </section>

          {/* ══ COME SI GIOCA (chiaro) ═════════════════════════════════════ */}
          <section className="section-pad bg-bg-soft">
            <div className="container-x">
              <motion.div {...reveal} className="text-center max-w-2xl mx-auto">
                <p className="overline justify-center">Come si gioca</p>
                <h2 className="mt-4 font-display font-bold text-3xl md:text-5xl tracking-tightest text-ink text-balance">
                  Formato misto, tutti contro tutti
                </h2>
                <p className="mt-4 text-muted leading-relaxed">
                  Ogni giornata circa 12 partite selezionate da FantaPronostic. Alcune partite sono a
                  pronostico singolo, altre a multipronostico (più pronostici sulla stessa partita,
                  ognuno vale punti separatamente).
                </p>
              </motion.div>

              <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto items-start">
                {/* Punteggi */}
                <motion.div {...reveal} className="card p-7">
                  <h3 className="font-display font-bold text-lg text-ink">Punti per pronostico</h3>
                  <ul className="mt-5 flex flex-col divide-y divide-line">
                    {SCORING.map((s) => (
                      <li key={s.label} className="flex items-center justify-between py-3">
                        <span className="text-sm text-ink2">{s.label}</span>
                        <span className="chip-orange">
                          {s.points} {s.points === 1 ? "punto" : "punti"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex items-center justify-between rounded-2xl bg-bg-soft px-4 py-3">
                    <span className="text-sm font-semibold text-ink">Massimo per partita</span>
                    <span className="font-display font-bold text-ink tabular-nums">9 punti</span>
                  </div>
                </motion.div>

                {/* X3 + regole chiave */}
                <motion.div {...reveal} transition={{ duration: 0.55, delay: 0.08 }} className="flex flex-col gap-4">
                  <div className="card p-7 flex items-start gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-brand-orange/10 grid place-items-center shrink-0 font-display font-bold text-brand-orange">
                      x3
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-lg text-ink">Partite X3</h3>
                      <p className="mt-1.5 text-sm text-muted leading-relaxed">
                        Alcune partite hanno il moltiplicatore x3: tutti i punti di quella partita
                        valgono il triplo, fino a <strong className="text-ink">27 punti</strong>.
                      </p>
                    </div>
                  </div>
                  <div className="card p-7 flex items-start gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-brand-blue/10 grid place-items-center shrink-0 text-brand-blue">
                      <Lock size={20} />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-lg text-ink">Pronostici bloccati</h3>
                      <p className="mt-1.5 text-sm text-muted leading-relaxed">
                        Inserisci i pronostici entro il fischio d'inizio della prima partita. Dopo, la
                        giornata si blocca e non è più modificabile.
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </section>

          {/* ══ COME PARTECIPARE (chiaro) ══════════════════════════════════ */}
          <section className="section-pad">
            <div className="container-x">
              <motion.div {...reveal} className="text-center max-w-xl mx-auto">
                <p className="overline justify-center">In 3 passi</p>
                <h2 className="mt-4 font-display font-bold text-3xl md:text-5xl tracking-tightest text-ink">
                  Come partecipare
                </h2>
              </motion.div>

              <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                {[
                  {
                    icon: <ShieldCheck size={22} />,
                    title: "Acquista il Pass",
                    desc: "Acquista il Pass (39€) e ricevi via email il codice di ingresso alla lega.",
                  },
                  {
                    icon: <Zap size={22} />,
                    title: "Scarica l'app",
                    desc: "Scarica FantaPronostic, registrati o accedi e inserisci il codice ricevuto via email.",
                  },
                  {
                    icon: <Target size={22} />,
                    title: "Pronostica e vinci",
                    desc: "Ogni giornata inserisci i tuoi pronostici, scala la classifica e conquista i premi.",
                  },
                ].map((s, i) => (
                  <motion.div
                    key={i}
                    {...reveal}
                    transition={{ duration: 0.55, delay: i * 0.08 }}
                    className="card p-7 relative"
                  >
                    <span className="absolute top-6 right-7 font-display font-bold text-4xl text-line2/80 tabular-nums">
                      {i + 1}
                    </span>
                    <div className="h-12 w-12 rounded-2xl bg-brand-orange/10 grid place-items-center text-brand-orange">
                      {s.icon}
                    </div>
                    <h3 className="mt-5 font-display font-bold text-lg text-ink">{s.title}</h3>
                    <p className="mt-2 text-sm text-muted leading-relaxed">{s.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* ══ MAIN SPONSOR — SHOPY COOL (chiaro) ═════════════════════════ */}
          <section className="section-pad">
            <div className="container-x">
              <motion.div
                {...reveal}
                className="max-w-4xl mx-auto rounded-3xl border border-brand-orange/25 overflow-hidden"
                style={{
                  background:
                    "linear-gradient(135deg, #FFF6EE 0%, #FFFFFF 55%, #FFF9F3 100%)",
                }}
              >
                <div className="p-8 md:p-10 flex flex-col md:flex-row items-center gap-8">
                  {/* Logo */}
                  <div className="shrink-0">
                    <a href={SPONSOR.url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={SPONSOR.logo}
                        alt={SPONSOR.name}
                        className="h-28 w-28 md:h-32 md:w-32 object-contain"
                      />
                    </a>
                  </div>

                  {/* Testo */}
                  <div className="flex-1 text-center md:text-left">
                    <p className="overline justify-center md:justify-start">Main Sponsor</p>
                    <h2 className="mt-3 font-display font-bold text-2xl md:text-3xl tracking-tightest text-ink">
                      In collaborazione con{" "}
                      <span className="text-brand-orange">Shopy Cool</span>
                    </h2>
                    <p className="mt-3 text-muted leading-relaxed">
                      La Super League nasce insieme a Shopy Cool. I{" "}
                      <strong className="text-ink">primi {SPONSOR.perkLimit} iscritti</strong>{" "}
                      ricevono un{" "}
                      <strong className="text-ink">
                        buono Shopy Cool da {SPONSOR.voucher}€
                      </strong>{" "}
                      (su una spesa minima di {SPONSOR.minSpend}€), da usare sullo store online e nel
                      punto vendita Shopy Cool.
                    </p>

                    <div className="mt-5 flex flex-col sm:flex-row items-center gap-3 md:justify-start justify-center">
                      <span className="chip-orange">
                        <Gift size={13} />
                        Riservato ai primi {SPONSOR.perkLimit} iscritti
                      </span>
                      <a
                        href={SPONSOR.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary"
                      >
                        Visita Shopy Cool
                        <ArrowRight size={16} />
                      </a>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </section>

          {/* ══ CHECKOUT (NEW: 2 colonne su desktop) ═══════════════════════ */}
          <section id="acquista" className="section-pad bg-bg-soft scroll-mt-16">
            <div className="container-x">
              <motion.div {...reveal} className="text-center max-w-2xl mx-auto mb-12">
                <h2 className="font-display font-bold text-3xl md:text-4xl tracking-tightest text-ink">
                  Entra nella Super League
                </h2>
              </motion.div>

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

          {/* ══ BONUS SHOPY COOL (dopo checkout, secundario) ════════════════ */}
          <section className="section-pad">
            <div className="container-x">
              <motion.div
                {...reveal}
                className="max-w-3xl mx-auto rounded-3xl border border-brand-orange/20 bg-brand-orange/5 overflow-hidden"
              >
                <div className="p-8 md:p-10 flex flex-col md:flex-row items-center gap-8">
                  {/* Logo */}
                  <div className="shrink-0">
                    <a href={SPONSOR.url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={SPONSOR.logo}
                        alt={SPONSOR.name}
                        className="h-24 w-24 md:h-28 md:w-28 object-contain"
                      />
                    </a>
                  </div>

                  {/* Testo */}
                  <div className="flex-1 text-center md:text-left">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-orange px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-white md:mb-2">
                      <Gift size={12} />
                      Bonus primi {SPONSOR.perkLimit} iscritti
                    </span>
                    <h3 className="mt-2 font-display font-bold text-2xl text-ink">
                      Bonus {SPONSOR.name}
                    </h3>
                    <p className="mt-2 text-muted leading-relaxed">
                      I primi {SPONSOR.perkLimit} iscritti ricevono un buono {SPONSOR.name} da{" "}
                      <strong>{SPONSOR.voucher}€</strong> (su spesa minima di {SPONSOR.minSpend}€), da usare
                      online e in negozio.
                    </p>
                    <a
                      href={SPONSOR.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-orange hover:text-brand-orange/80 transition-colors"
                    >
                      Scopri di più su Shopy Cool
                      <ArrowRight size={16} />
                    </a>
                  </div>
                </div>
              </motion.div>
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
                href="#acquista"
                onClick={() => track("purchase_cta_click", { placement: "sticky_bar", creator: creatorParam })}
                className="btn-primary whitespace-nowrap px-6 py-3 text-sm font-bold"
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
      {/* Colonna SX: Benefits e info */}
      <motion.div
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col gap-8"
      >
        <div>
          <h3 className="font-display font-bold text-2xl text-ink mb-6">
            Cosa ricevi
          </h3>
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

      {/* Colonna DX: Form pagamento */}
      <motion.div
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
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
  const [showDiscount, setShowDiscount] = useState(false);

  return (
    <div className="card p-8 md:p-10 flex flex-col gap-6">
      {/* Prezzo in evidenza */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Pass Super League 2026/2027</p>
        <div className="font-display font-bold text-6xl text-ink">€{SUPER_LEAGUE.price}</div>
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@esempio.it"
            className="w-full rounded-2xl border border-line bg-bg-soft px-5 py-3.5 text-ink placeholder:text-muted focus:outline-none focus:border-brand-blue focus:bg-white transition-colors"
          />
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
  const [copiedCode, setCopiedCode] = useState(false);
  const accessCode = "SUPER-XXXX-XXXX"; // Placeholder — il backend lo passerà via URL

  useEffect(() => {
    track("payment_succeeded");
  }, []);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(accessCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <main className="container-x py-16 md:py-24">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="card p-8 md:p-12 flex flex-col items-center text-center gap-8"
        >
          {/* Success icon */}
          <div className="h-20 w-20 rounded-full bg-green-100 grid place-items-center text-green-600">
            <CheckCircle2 size={40} />
          </div>

          {/* Header */}
          <div>
            <h1 className="font-display font-bold text-4xl md:text-5xl text-ink tracking-tightest">
              Pagamento completato!
            </h1>
            <p className="mt-3 text-lg text-muted">
              Il tuo accesso alla Super League è pronto.
            </p>
          </div>

          {/* Email confirmazione */}
          <div className="w-full rounded-2xl border border-line bg-bg-soft p-6 text-left">
            <p className="text-xs uppercase tracking-widest text-muted font-bold mb-2">Email di conferma</p>
            <p className="font-semibold text-ink">Controlla anche lo spam</p>
            <p className="text-sm text-muted mt-1 leading-relaxed">
              Ti abbiamo inviato il prodotto editoriale e il codice univoco per entrare nella Super League.
            </p>
          </div>

          {/* Access code prominente */}
          <div className="w-full rounded-2xl border-2 border-brand-orange bg-brand-orange/5 p-8">
            <p className="text-xs uppercase tracking-widest text-muted font-bold mb-3">Il tuo codice di accesso</p>
            <div className="font-display font-bold text-3xl text-brand-orange tabular-nums mb-4 select-all">
              {accessCode}
            </div>
            <button
              onClick={handleCopyCode}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-orange px-6 py-3 font-semibold text-white hover:bg-brand-orange/90 transition-colors"
            >
              {copiedCode ? (
                <>
                  <CheckCircle2 size={18} />
                  Codice copiato!
                </>
              ) : (
                <>
                  📋 Copia codice
                </>
              )}
            </button>
          </div>

          {/* CTA principale: app */}
          <div className="w-full flex flex-col gap-3">
            <a
              href="fantapronostic://super-league-redeem"
              onClick={() => track("deeplink_click", { placement: "success_screen" })}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-8 py-4 font-display font-bold text-lg text-white hover:bg-ink/90 transition-colors"
            >
              Apri FantaPronostic ed entra nella lega
              <ArrowRight size={20} />
            </a>
            <p className="text-xs text-muted">
              Se hai già l'app, si aprirà sulla pagina di riscatto.
            </p>
          </div>

          {/* App store fallback */}
          <div className="w-full flex flex-col gap-3 pt-4 border-t border-line">
            <p className="text-sm font-semibold text-muted">Non hai ancora l'app?</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="https://apps.apple.com/it/app/fantapronostic/id6760613936"
                rel="noopener noreferrer"
                onClick={openAppStore}
                className="flex-1 btn-blue justify-center text-sm"
              >
                Scarica su App Store
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=com.fantapronostic.app"
                rel="noopener noreferrer"
                className="flex-1 btn-primary justify-center text-sm"
              >
                Scarica su Google Play
              </a>
            </div>
          </div>

          {/* Support */}
          <div className="w-full rounded-2xl bg-bg-soft border border-line p-6 text-center">
            <p className="text-sm font-semibold text-ink mb-1">Hai problemi?</p>
            <p className="text-xs text-muted">
              Contatta il nostro supporto: <a href="mailto:support@fantapronostic.com" className="text-brand-blue hover:underline">support@fantapronostic.com</a>
            </p>
          </div>

          {/* Back to home */}
          <Link to="/" className="text-sm font-semibold text-muted hover:text-brand-blue transition-colors">
            Torna alla home
          </Link>
        </motion.div>
      </div>
    </main>
  );
}
