import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
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
  "https://fanta-auth-fix.preview.emergentagent.com";

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

  const countdown = useCountdown(SUPER_LEAGUE.openingDate);
  const isOpen = countdown.isOver;

  useEffect(() => {
    window.scrollTo(0, 0);
    const codeFromUrl = searchParams.get("codice");
    if (codeFromUrl) setDiscountCode(codeFromUrl.trim());
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
    try {
      const path = window.location.pathname;
      const body: Record<string, unknown> = {
        email: email.trim(),
        league_id: SUPER_LEAGUE.leagueId,
        success_url: `${window.location.origin}${path}?payment=success`,
        cancel_url: `${window.location.origin}${path}?payment=cancelled`,
      };
      if (discountCode.trim()) body.discount_code = discountCode.trim();

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
      if (data?.url) window.location.href = data.url;
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
      const res = await fetch(`${BACKEND_URL}/api/newsletter/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: preEmail.trim(),
          language: "it",
          source: "super-league-preiscrizione",
        }),
      });
      if (!res.ok) throw new Error();
      setPreStatus("ok");
      setPreEmail("");
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
        <main>
          {/* ══ HERO (scuro, cinematografico) ══════════════════════════════ */}
          <section className="relative overflow-hidden bg-[#050f24] min-h-[92vh] flex items-center">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${SUPER_LEAGUE.heroImage})` }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(5,15,36,0.80) 0%, rgba(5,15,36,0.42) 32%, rgba(5,15,36,0.72) 74%, #050f24 100%)",
              }}
            />
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[620px] h-[380px] rounded-full bg-brand-orange/20 blur-[130px]" />

            {/* Top bar sopra la foto */}
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

            <div className="relative z-10 container-x py-28 md:py-32 text-center">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-4 py-1.5 text-[11px] font-bold text-white/90 uppercase tracking-[0.18em] backdrop-blur-md"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" />
                {SUPER_LEAGUE.season}
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.08 }}
                className="mt-7 font-display font-bold text-[44px] sm:text-6xl md:text-7xl lg:text-[86px] leading-[0.92] tracking-tightest text-white uppercase text-balance"
              >
                FantaPronostic
                <span className="block relative w-fit mx-auto text-brand-orange">
                  Super League
                  <Underline />
                </span>
              </motion.h1>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.22 }}
                className="mt-9 flex flex-col items-center gap-4"
              >
                <div className="inline-flex items-center gap-2.5 rounded-full bg-brand-orange px-6 py-3 shadow-cta">
                  <Trophy size={20} className="text-white" />
                  <span className="font-display font-bold text-lg md:text-xl text-white">
                    Montepremi {SUPER_LEAGUE.prizePool}
                  </span>
                </div>
                {!isOpen && (
                  <a
                    href="#acquista"
                    className="group inline-flex items-center gap-2 rounded-full bg-white/[0.07] border border-brand-orange/50 px-5 py-2.5 backdrop-blur-md hover:bg-white/[0.12] transition-colors"
                  >
                    <span className="text-base">🎟️</span>
                    <span className="text-sm md:text-[15px] font-bold text-white">
                      Pre-iscriviti ora e ottieni il{" "}
                      <span className="text-brand-orange">10% di sconto</span>
                    </span>
                    <ArrowRight size={15} className="text-white/70 group-hover:translate-x-0.5 transition-transform" />
                  </a>
                )}
              </motion.div>

              {/* Countdown */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.34 }}
                className="mt-11"
              >
                <p className="text-white/55 text-xs font-bold uppercase tracking-[0.2em] mb-4">
                  {isOpen ? "Iscrizioni aperte" : "Apertura iscrizioni tra"}
                </p>
                {!isOpen && (
                  <div className="flex items-center justify-center gap-2.5 md:gap-3.5">
                    <CountdownBox value={countdown.days} label="Giorni" />
                    <CountdownBox value={countdown.hours} label="Ore" />
                    <CountdownBox value={countdown.minutes} label="Min" />
                    <CountdownBox value={countdown.seconds} label="Sec" />
                  </div>
                )}
                <p className="mt-6 inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-white/75">
                  <CalendarDays size={15} className="text-brand-orange" />
                  Si parte il <strong className="text-white">{SUPER_LEAGUE.startLabel}</strong>
                  <span className="text-white/30">·</span>
                  Piano editoriale + accesso da{" "}
                  <strong className="text-white">{SUPER_LEAGUE.price}€</strong>
                </p>
              </motion.div>

              {/* 5 leghe */}
              <motion.div {...reveal} transition={{ duration: 0.6, delay: 0.1 }} className="mt-12">
                <p className="text-white/45 text-[11px] font-bold uppercase tracking-[0.2em] mb-4">
                  Le partite delle 5 grandi leghe europee
                </p>
                <div className="flex items-center justify-center gap-2 md:gap-2.5 flex-wrap">
                  {LEAGUES.map((l) => (
                    <div
                      key={l.name}
                      className="flex items-center gap-2 rounded-full bg-white/[0.07] border border-white/12 px-3.5 py-2 backdrop-blur-md"
                    >
                      <span className="text-lg leading-none">{l.flag}</span>
                      <span className="text-[13px] font-semibold text-white/90">{l.name}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              <div className="mt-11">
                <a
                  href="#acquista"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-ink hover:-translate-y-0.5 transition-transform shadow-soft"
                >
                  {isOpen ? "Acquista ora" : "Pre-iscriviti e risparmia il 10%"}
                  <ArrowRight size={16} />
                </a>
              </div>

              {/* Main sponsor */}
              <div className="mt-12 flex flex-col items-center gap-3">
                <span className="text-white/40 text-[10px] font-bold uppercase tracking-[0.25em]">
                  Main Sponsor
                </span>
                <a href={SPONSOR.url} target="_blank" rel="noopener noreferrer" aria-label={SPONSOR.name}>
                  <img
                    src={SPONSOR.logo}
                    alt={SPONSOR.name}
                    className="h-14 w-14 object-contain opacity-90 hover:opacity-100 transition-opacity"
                  />
                </a>
              </div>
            </div>
          </section>

          {/* ══ COME SI GIOCA (chiaro) ═════════════════════════════════════ */}
          <section className="section-pad bg-bg-soft">
            <div className="container-x">
              <motion.div {...reveal} className="text-center max-w-2xl mx-auto">
                <p className="overline justify-center">Come si gioca</p>
                <h2 className="mt-4 font-display font-bold text-3xl md:text-5xl tracking-tightest text-ink text-balance">
                  Multipronostico, tutti contro tutti
                </h2>
                <p className="mt-4 text-muted leading-relaxed">
                  Ogni giornata circa 12 partite selezionate da FantaPronostic. Per ogni partita puoi
                  indovinare più pronostici: ognuno vale punti separatamente.
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
                    title: "Acquista il Piano",
                    desc: "Acquista il Piano editoriale digitale (39€). Ricevi il prodotto e il codice di accesso via email.",
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

          {/* ══ PREMI (scuro, accento) ═════════════════════════════════════ */}
          <section
            className="relative overflow-hidden section-pad"
            style={{
              background:
                "radial-gradient(120% 100% at 50% 0%, #14315f 0%, #0a1f45 55%, #050f24 100%)",
            }}
          >
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[300px] rounded-full bg-brand-orange/15 blur-[120px]" />
            <div className="container-x relative">
              <motion.div {...reveal} className="max-w-5xl mx-auto">
                <img
                  src={SUPER_LEAGUE.prizesImage}
                  alt="I premi in palio della FantaPronostic Super League: 1° Apple Pack (iPhone Pro, AirPods, Apple Watch), 2° MacBook Neo 13, 3° PlayStation 5 Slim"
                  className="w-full h-auto rounded-3xl border border-white/10 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.6)]"
                />
              </motion.div>

              <p className="text-center text-white/40 text-xs mt-6 max-w-xl mx-auto">
                Montepremi {SUPER_LEAGUE.prizePool}. Le immagini dei premi sono puramente illustrative
                e non rappresentano necessariamente il prodotto reale (colore, modello e
                configurazione possono variare). I marchi appartengono ai rispettivi titolari.
              </p>

              {/* Premio settimanale */}
              <motion.div
                {...reveal}
                className="mt-10 max-w-4xl mx-auto rounded-3xl bg-white/[0.05] border border-white/12 p-6 flex items-start gap-4 backdrop-blur-sm"
              >
                <div className="h-11 w-11 rounded-2xl bg-brand-orange/15 grid place-items-center text-brand-orange shrink-0">
                  <Gift size={20} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-white">Premio settimanale</h3>
                  <p className="text-sm text-white/60 mt-1 leading-relaxed">
                    Ogni giornata, chi ottiene il punteggio più alto vince l'accesso gratuito
                    all'edizione successiva della Super League. Dalla seconda vittoria consecutiva,
                    un buono Amazon da 20€.
                  </p>
                </div>
              </motion.div>
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
                      ricevono un <strong className="text-ink">buono sconto esclusivo</strong>, da
                      usare sullo store online e nel punto vendita Shopy Cool.
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

          {/* ══ ACQUISTA / PRE-ISCRIZIONE (chiaro) ═════════════════════════ */}
          <section id="acquista" className="section-pad bg-bg-soft scroll-mt-16">
            <div className="container-x">
              <div className="max-w-md mx-auto">
                {isOpen ? (
                  <PurchaseCard
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
                  <PreRegisterCard
                    preEmail={preEmail}
                    setPreEmail={setPreEmail}
                    preStatus={preStatus}
                    onPreRegister={handlePreRegister}
                  />
                )}
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
      )}

      <footer className="border-t border-line bg-white">
        <div className="container-x py-8 text-center text-xs text-muted">
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
  onPreRegister,
}: {
  preEmail: string;
  setPreEmail: (v: string) => void;
  preStatus: "idle" | "loading" | "ok" | "err";
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
          adesso: è gratis e ti dà diritto al <strong>10% di sconto</strong> sul Pass.
        </p>
      </div>

      <div className="rounded-2xl bg-brand-orange/5 border border-brand-orange/20 p-4 text-xs text-ink2 leading-relaxed">
        La pre-iscrizione non comporta alcun pagamento: dà solo diritto allo sconto del 10% quando
        le iscrizioni saranno aperte.
      </div>

      {preStatus === "ok" ? (
        <div className="flex flex-col items-center text-center gap-3 py-2">
          <div className="h-12 w-12 rounded-full bg-green-100 grid place-items-center text-green-600">
            <CheckCircle2 size={24} />
          </div>
          <p className="font-semibold text-ink">Pre-iscrizione registrata!</p>
          <p className="text-sm text-muted">
            Ti avviseremo all'apertura delle iscrizioni con il tuo codice sconto.
          </p>
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
            <p className="text-sm text-red-600 font-medium">Inserisci un'email valida e riprova.</p>
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
  return (
    <div className="card p-8 flex flex-col gap-5">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Cosa ricevi</p>
        <div className="font-display font-bold text-5xl text-ink">€{SUPER_LEAGUE.price}</div>
        <p className="text-xs text-muted mt-2">Pagamento unico · nessun rinnovo automatico</p>
      </div>

      <div className="rounded-2xl bg-bg-soft border border-line p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={17} className="text-brand-orange shrink-0 mt-0.5" />
          <span className="text-sm text-ink2 leading-relaxed">
            <strong className="text-ink">Piano editoriale digitale 2026/2027</strong> — contenuti,
            statistiche e approfondimenti di tutta la stagione
          </span>
        </div>
        <div className="flex items-start gap-3">
          <CheckCircle2 size={17} className="text-brand-orange shrink-0 mt-0.5" />
          <span className="text-sm text-ink2 leading-relaxed">
            <strong className="text-ink">Accesso alla Super League 2026/2027</strong> — incluso, con
            codice riscattabile nell'app
          </span>
        </div>
      </div>

      <div className="h-px bg-line" />

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
        <div>
          <label className="text-xs uppercase tracking-widest text-muted font-bold mb-2 block">
            Conferma email
          </label>
          <input
            type="email"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder="nome@esempio.it"
            className="w-full rounded-2xl border border-line bg-bg-soft px-5 py-3.5 text-ink placeholder:text-muted focus:outline-none focus:border-brand-blue focus:bg-white transition-colors"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-muted font-bold mb-2 block">
            Codice sconto (facoltativo)
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
        <p className="text-xs text-muted flex items-start gap-1.5">
          <Lock size={11} className="shrink-0 mt-0.5" />
          Riceverai il prodotto e il codice di accesso su questa email.
        </p>
      </div>

      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

      <button
        onClick={onPay}
        disabled={loading}
        className="btn-primary justify-center disabled:opacity-70 disabled:cursor-wait"
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Reindirizzamento…
          </>
        ) : (
          <>
            Acquista il Piano — €{SUPER_LEAGUE.price}
            <ArrowRight size={18} />
          </>
        )}
      </button>

      <p className="text-center text-xs text-muted flex items-center justify-center gap-1.5">
        <ShieldCheck size={13} />
        Pagamento sicuro tramite Stripe · Nessun dato della carta salvato sul sito
      </p>
    </div>
  );
}

// ─── Success screen ───────────────────────────────────────────────────────────
function SuccessScreen() {
  return (
    <main className="container-x py-24 md:py-28">
      <div className="max-w-lg mx-auto">
        <div className="card p-8 md:p-10 flex flex-col items-center text-center gap-6">
          <div className="h-16 w-16 rounded-full bg-green-100 grid place-items-center text-green-600">
            <CheckCircle2 size={32} />
          </div>
          <div>
            <h1 className="font-display font-bold text-3xl text-ink tracking-tightest">
              Pagamento effettuato!
            </h1>
            <p className="mt-2 text-muted text-sm">
              Benvenuto nella Super League. Ecco cosa fare adesso:
            </p>
          </div>

          <div className="w-full flex flex-col gap-4 text-left">
            <div className="flex items-start gap-4 rounded-2xl bg-bg-soft border border-line p-4">
              <div className="h-10 w-10 rounded-xl bg-brand-orange/10 grid place-items-center text-brand-orange shrink-0">
                <Mail size={20} />
              </div>
              <div>
                <p className="font-semibold text-sm text-ink">Controlla la tua email</p>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">
                  Ti arriverà una mail con il prodotto editoriale e il codice univoco per entrare
                  nella lega. Controlla anche la cartella spam.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-2xl bg-bg-soft border border-line p-4">
              <div className="h-10 w-10 rounded-xl bg-brand-blue/10 grid place-items-center text-brand-blue shrink-0">
                <Smartphone size={20} />
              </div>
              <div>
                <p className="font-semibold text-sm text-ink">Scarica l'app</p>
                <p className="text-xs text-muted mt-0.5 mb-3 leading-relaxed">
                  Scarica FantaPronostic, registrati o accedi al tuo account.
                </p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="https://apps.apple.com/it/app/fantapronostic/id6760613936"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-blue text-xs px-3 py-1.5"
                  >
                    App Store
                  </a>
                  <a
                    href="https://play.google.com/store/apps/details?id=com.fantapronostic.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    Google Play
                  </a>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-2xl bg-bg-soft border border-line p-4">
              <div className="h-10 w-10 rounded-xl bg-brand-orange/10 grid place-items-center text-brand-orange shrink-0">
                <Key size={20} />
              </div>
              <div>
                <p className="font-semibold text-sm text-ink">Accedi alla lega</p>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">
                  Usa il tuo codice univoco per entrare nella Super League dall'app. Il codice è
                  valido una volta sola.
                </p>
              </div>
            </div>
          </div>

          <Link to="/" className="text-sm font-semibold text-ink2 hover:text-brand-blue transition-colors">
            Torna alla home
          </Link>
        </div>
      </div>
    </main>
  );
}
