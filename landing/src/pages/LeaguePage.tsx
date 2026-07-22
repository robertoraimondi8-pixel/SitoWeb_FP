import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Trophy,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  Star,
  Zap,
  Target,
  Lock,
  Mail,
  Smartphone,
  Key,
  ChevronDown,
  Gift,
  Newspaper,
} from "lucide-react";
import {
  SUPER_LEAGUE,
  LEAGUES,
  PRIZES,
  SCORING,
  REGOLAMENTO,
} from "@/data/superLeague";

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
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return { days, hours, minutes, seconds, isOver: diff === 0 };
}

function CountdownBox({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="min-w-[64px] rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm px-3 py-3 text-center">
        <span className="font-display font-bold text-3xl md:text-4xl text-white tabular-nums">
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <span className="mt-2 text-[11px] uppercase tracking-widest font-bold text-white/60">
        {label}
      </span>
    </div>
  );
}

export default function LeaguePage() {
  const [searchParams] = useSearchParams();
  const paymentStatus = searchParams.get("payment");

  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openArticle, setOpenArticle] = useState<number | null>(null);

  // Pre-iscrizione (fase prima dell'apertura)
  const [preEmail, setPreEmail] = useState("");
  const [preStatus, setPreStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");

  const countdown = useCountdown(SUPER_LEAGUE.openingDate);
  // Le iscrizioni (pagamento) sono aperte quando il countdown è terminato.
  const isOpen = countdown.isOver;

  useEffect(() => {
    window.scrollTo(0, 0);
    const codeFromUrl = searchParams.get("codice");
    if (codeFromUrl) setDiscountCode(codeFromUrl.trim());
  }, [searchParams]);

  const totalPrizeMax = 9; // punti max partita ordinaria

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
      if (data?.url) {
        window.location.href = data.url;
      } else {
        setError("Risposta non valida dal server. Riprova.");
      }
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
    <div className="min-h-screen bg-bg-soft" data-testid="league-page">
      {/* Header */}
      <header className="bg-white border-b border-line">
        <div className="container-x py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5" data-testid="league-header-logo">
            <img src="/brand-icon.png" alt="FantaPronostic" className="h-9 w-9 rounded-xl" />
            <span className="font-display font-bold text-[17px] tracking-tight">
              <span className="text-brand-orange">Fanta</span>
              <span className="text-brand-blue">Pronostic</span>
            </span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-ink2 hover:text-brand-blue transition-colors"
          >
            <ArrowLeft size={16} />
            Torna alla home
          </Link>
        </div>
      </header>

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
          {/* ── HERO ─────────────────────────────────────────────────────── */}
          <section
            className="relative overflow-hidden"
            style={{
              background:
                "radial-gradient(120% 90% at 50% 0%, #14315f 0%, #0a1f45 45%, #050f24 100%)",
            }}
          >
            {/* Stars */}
            <div
              className="absolute inset-0 opacity-40 pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(1px 1px at 20% 30%, #fff, transparent), radial-gradient(1px 1px at 60% 20%, #fff, transparent), radial-gradient(1px 1px at 80% 40%, #fff, transparent), radial-gradient(1px 1px at 35% 15%, #fff, transparent), radial-gradient(1px 1px at 90% 25%, #fff, transparent)",
                backgroundSize: "100% 100%",
              }}
            />
            <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-brand-orange/20 blur-[120px] pointer-events-none" />

            <div className="container-x py-16 md:py-24 relative text-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-1.5 text-xs font-bold text-white/90 uppercase tracking-widest mb-6 backdrop-blur-sm">
                <Star size={12} className="text-brand-orange" />
                {SUPER_LEAGUE.season}
              </span>

              <h1 className="font-display font-black text-5xl md:text-7xl tracking-tightest text-white leading-[0.95] uppercase">
                FantaPronostic
                <br />
                <span className="text-brand-orange">Super League</span>
              </h1>

              <div className="mt-8 inline-flex items-center gap-2.5 rounded-full bg-brand-orange px-6 py-3 shadow-cta">
                <Trophy size={20} className="text-white" />
                <span className="font-display font-bold text-lg md:text-xl text-white">
                  Montepremi {SUPER_LEAGUE.prizePool}
                </span>
              </div>

              {!isOpen && (
                <div className="mt-5 flex justify-center">
                  <a
                    href="#acquista"
                    className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-brand-orange/60 px-5 py-2.5 backdrop-blur-sm hover:bg-white/15 transition-colors"
                    data-testid="hero-prereg-badge"
                  >
                    <span className="text-lg">🎟️</span>
                    <span className="text-sm md:text-base font-bold text-white">
                      Pre-iscriviti ora e ottieni il{" "}
                      <span className="text-brand-orange">10% di sconto</span>
                    </span>
                  </a>
                </div>
              )}

              {/* Countdown */}
              <div className="mt-10">
                <p className="text-white/70 text-sm font-semibold uppercase tracking-widest mb-4">
                  {isOpen ? "Iscrizioni aperte!" : "Apertura iscrizioni tra"}
                </p>
                {!isOpen && (
                  <div className="flex items-center justify-center gap-3 md:gap-4">
                    <CountdownBox value={countdown.days} label="Giorni" />
                    <CountdownBox value={countdown.hours} label="Ore" />
                    <CountdownBox value={countdown.minutes} label="Min" />
                    <CountdownBox value={countdown.seconds} label="Sec" />
                  </div>
                )}
                <p className="mt-5 text-white/80 text-sm">
                  Si parte il <strong className="text-white">{SUPER_LEAGUE.startLabel}</strong> ·
                  Piano editoriale + accesso da{" "}
                  <strong className="text-white">{SUPER_LEAGUE.price}€</strong>
                </p>
              </div>

              {/* 5 leghe */}
              <div className="mt-12">
                <p className="text-white/70 text-sm font-semibold uppercase tracking-widest mb-4">
                  Pronostica le partite delle 5 grandi leghe europee
                </p>
                <div className="flex items-center justify-center gap-3 md:gap-4 flex-wrap">
                  {LEAGUES.map((l) => (
                    <div
                      key={l.name}
                      className="flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-2 backdrop-blur-sm"
                    >
                      <span className="text-xl">{l.flag}</span>
                      <span className="text-sm font-semibold text-white">{l.name}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-white/50 text-xs max-w-md mx-auto">
                  Le partite potranno appartenere a campionati e competizioni differenti,
                  selezionate da FantaPronostic.
                </p>
              </div>

              {/* CTA scroll */}
              <a
                href="#acquista"
                className="mt-10 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-ink hover:bg-white/90 transition-colors"
                data-testid="hero-cta"
              >
                {isOpen ? "Acquista ora" : "Pre-iscriviti e risparmia il 10%"}
                <ArrowRight size={16} />
              </a>
            </div>
          </section>

          {/* ── PREMI ────────────────────────────────────────────────────── */}
          <section className="relative overflow-hidden py-16 md:py-20"
            style={{
              background:
                "radial-gradient(120% 100% at 50% 0%, #14315f 0%, #0a1f45 55%, #050f24 100%)",
            }}
          >
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-brand-orange/15 blur-[120px] pointer-events-none" />
            <div className="container-x relative">
              <p className="text-center text-brand-orange text-xs font-bold uppercase tracking-[0.2em]">
                Premi finali
              </p>
              <h2 className="font-display font-bold text-3xl md:text-5xl text-center text-white mt-3 tracking-tightest">
                Cosa puoi vincere
              </h2>
              <p className="text-center text-white/60 mt-3 max-w-md mx-auto">
                Montepremi {SUPER_LEAGUE.prizePool}. I premi vengono assegnati ai tre migliori
                classificati a fine stagione.
              </p>

              <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto md:items-end">
                {PRIZES.map((p) => (
                  <div
                    key={p.place}
                    className={`relative rounded-3xl p-6 flex flex-col items-center gap-4 text-center border transition-transform hover:-translate-y-1 ${
                      p.place === 1
                        ? "md:order-2 md:-mt-6 bg-gradient-to-b from-white to-white border-brand-orange shadow-[0_20px_60px_-15px_rgba(255,122,0,0.5)] ring-1 ring-brand-orange/40"
                        : p.place === 2
                        ? "md:order-1 bg-white/95 border-white/20"
                        : "md:order-3 bg-white/95 border-white/20"
                    }`}
                  >
                    {p.place === 1 && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-orange px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white whitespace-nowrap">
                        Premio top
                      </span>
                    )}

                    {/* Immagine premio (con fallback automatico all'icona) */}
                    <PrizeMedia image={p.image} icon={p.icon} title={p.title} highlight={p.place === 1} />

                    <div>
                      <span className="text-xs font-bold uppercase tracking-widest text-muted">
                        {p.label}
                      </span>
                      <h3 className="font-display font-bold text-xl text-ink mt-1">{p.title}</h3>
                    </div>

                    {p.items.length > 0 && (
                      <ul className="flex flex-col gap-1.5 w-full">
                        {p.items.map((it) => (
                          <li
                            key={it}
                            className="text-sm text-ink2 flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle2 size={13} className="text-brand-orange shrink-0" />
                            {it}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>

              {PRIZES.some((p) => p.image) && (
                <p className="text-center text-white/45 text-xs mt-8 max-w-xl mx-auto">
                  Le immagini dei premi sono puramente illustrative e non rappresentano
                  necessariamente il prodotto reale (colore, modello, configurazione e versione
                  possono variare). I marchi e i prodotti appartengono ai rispettivi titolari.
                </p>
              )}
            </div>
          </section>

          {/* ── PREMIO SETTIMANALE ───────────────────────────────────────── */}
          <section className="container-x py-10">

            {/* Premio settimanale */}
            <div className="mt-6 max-w-4xl mx-auto card p-6 flex items-start gap-4 bg-brand-blue/5 border-brand-blue/20">
              <div className="h-11 w-11 rounded-xl bg-brand-blue/10 grid place-items-center text-brand-blue shrink-0">
                <Gift size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-ink">Premio settimanale</h3>
                <p className="text-sm text-muted mt-1 leading-relaxed">
                  Ogni giornata, chi ottiene il punteggio più alto vince l'accesso gratuito
                  all'edizione successiva della Super League. Dalla seconda vittoria consecutiva,
                  un buono Amazon da 20€.
                </p>
              </div>
            </div>
          </section>

          {/* ── COME SI GIOCA ────────────────────────────────────────────── */}
          <section className="bg-white border-y border-line">
            <div className="container-x py-16">
              <p className="overline text-center">Come si gioca</p>
              <h2 className="font-display font-bold text-3xl md:text-4xl text-center text-ink mt-3 tracking-tightest">
                Multipronostico, tutti contro tutti
              </h2>
              <p className="text-center text-muted mt-3 max-w-xl mx-auto">
                Ogni giornata ~12 partite selezionate da FantaPronostic. Per ogni partita puoi
                indovinare più pronostici: ognuno vale punti separatamente.
              </p>

              {/* Scoring table */}
              <div className="mt-10 max-w-lg mx-auto card p-6">
                <h3 className="font-display font-bold text-lg text-ink mb-4">Punteggi per partita</h3>
                <ul className="flex flex-col gap-3">
                  {SCORING.map((s) => (
                    <li key={s.label} className="flex items-center justify-between">
                      <span className="text-sm text-ink2">{s.label}</span>
                      <span className="font-display font-bold text-brand-orange">
                        {s.points} {s.points === 1 ? "punto" : "punti"}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="h-px bg-line my-4" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink">Massimo per partita</span>
                  <span className="font-display font-bold text-ink">{totalPrizeMax} punti</span>
                </div>
                <div className="mt-4 rounded-2xl bg-brand-orange/10 p-4 flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-brand-orange/20 grid place-items-center text-brand-orange shrink-0 font-display font-bold text-sm">
                    x3
                  </div>
                  <p className="text-sm text-ink2 leading-relaxed">
                    <strong>Partite X3:</strong> alcune partite hanno il moltiplicatore x3. Tutti i
                    punti di quella partita valgono il triplo (fino a 27 punti).
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ── COME PARTECIPARE ─────────────────────────────────────────── */}
          <section className="container-x py-16">
            <p className="overline text-center">In 3 passi</p>
            <h2 className="font-display font-bold text-3xl md:text-4xl text-center text-ink mt-3 tracking-tightest">
              Come partecipare
            </h2>
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {[
                {
                  icon: <ShieldCheck size={24} />,
                  title: "Acquista il Pass",
                  desc: "Acquista il Piano editoriale digitale (39€). Ricevi il prodotto e il codice di accesso via email.",
                },
                {
                  icon: <Zap size={24} />,
                  title: "Scarica l'app",
                  desc: "Scarica FantaPronostic, registrati o accedi e inserisci il codice ricevuto via email.",
                },
                {
                  icon: <Target size={24} />,
                  title: "Pronostica e vinci",
                  desc: "Ogni giornata inserisci i tuoi pronostici, scala la classifica e conquista i premi.",
                },
              ].map((s, i) => (
                <div key={i} className="flex flex-col items-center text-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-brand-orange/10 grid place-items-center text-brand-orange">
                    {s.icon}
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-muted">
                    Step {i + 1}
                  </span>
                  <h3 className="font-display font-bold text-lg text-ink">{s.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── ACQUISTA / PRE-ISCRIZIONE ────────────────────────────────── */}
          <section id="acquista" className="bg-white border-t border-line scroll-mt-20">
            <div className="container-x py-16">
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

          {/* ── REGOLAMENTO ──────────────────────────────────────────────── */}
          <section className="container-x py-16">
            <div className="max-w-2xl mx-auto">
              <p className="overline text-center">Regolamento</p>
              <h2 className="font-display font-bold text-3xl text-center text-ink mt-3 tracking-tightest">
                Regolamento completo
              </h2>
              <p className="text-center text-muted mt-3 mb-8">
                Super League 2026/2027 · {REGOLAMENTO.length} articoli
              </p>

              <div className="flex flex-col gap-2">
                {REGOLAMENTO.map((art) => {
                  const open = openArticle === art.n;
                  return (
                    <div key={art.n} className="card overflow-hidden">
                      <button
                        onClick={() => setOpenArticle(open ? null : art.n)}
                        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-bg-soft transition-colors"
                        data-testid={`regolamento-art-${art.n}`}
                      >
                        <span className="text-sm font-semibold text-ink">
                          <span className="text-brand-orange">Art. {art.n}</span> — {art.title}
                        </span>
                        <ChevronDown
                          size={18}
                          className={`text-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                        />
                      </button>
                      {open && (
                        <div className="px-4 pb-4 -mt-1">
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

          {/* ── FAQ ──────────────────────────────────────────────────────── */}
          <section className="bg-white border-t border-line">
            <div className="container-x py-16">
              <div className="max-w-2xl mx-auto">
                <p className="overline text-center">FAQ</p>
                <h2 className="font-display font-bold text-3xl text-center text-ink mt-3 tracking-tightest">
                  Domande frequenti
                </h2>
                <div className="mt-8 flex flex-col gap-6">
                  {[
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
                  ].map((faq, i) => (
                    <div key={i} className="border-b border-line pb-6 last:border-0">
                      <h3 className="font-semibold text-ink text-base">{faq.q}</h3>
                      <p className="mt-2 text-sm text-muted leading-relaxed">{faq.a}</p>
                    </div>
                  ))}
                </div>
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

// ─── Prize media (immagine con fallback all'icona) ────────────────────────────
function PrizeMedia({
  image,
  icon,
  title,
  highlight,
}: {
  image: string;
  icon: string;
  title: string;
  highlight: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (image && !failed) {
    return (
      <div className="h-36 w-full grid place-items-center">
        <img
          src={image}
          alt={title}
          onError={() => setFailed(true)}
          className="max-h-36 max-w-full object-contain"
        />
      </div>
    );
  }
  return (
    <div
      className={`h-24 w-24 rounded-2xl grid place-items-center text-5xl ${
        highlight ? "bg-brand-orange/10" : "bg-bg-soft"
      }`}
    >
      {icon}
    </div>
  );
}

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
              data-testid="prereg-input-email"
            />
          </div>
          {preStatus === "err" && (
            <p className="text-sm text-red-600 font-medium">
              Inserisci un'email valida e riprova.
            </p>
          )}
          <button
            onClick={onPreRegister}
            disabled={preStatus === "loading"}
            className="btn-primary justify-center disabled:opacity-70 disabled:cursor-wait"
            data-testid="prereg-button"
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
        <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">
          Cosa ricevi
        </p>
        <div className="flex items-end justify-center gap-1">
          <span className="font-display font-bold text-5xl text-ink">€{SUPER_LEAGUE.price}</span>
        </div>
        <p className="text-xs text-muted mt-2">Pagamento unico · nessun rinnovo automatico</p>
      </div>

      <div className="rounded-2xl bg-bg-soft border border-line p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={17} className="text-brand-orange shrink-0 mt-0.5" />
          <span className="text-sm text-ink2 leading-relaxed">
            <strong className="text-ink">Piano editoriale digitale 2026/2027</strong> — contenuti
            statistici, approfondimenti e aggiornamenti di tutta la stagione
          </span>
        </div>
        <div className="flex items-start gap-3">
          <CheckCircle2 size={17} className="text-brand-orange shrink-0 mt-0.5" />
          <span className="text-sm text-ink2 leading-relaxed">
            <strong className="text-ink">Accesso alla Super League 2026/2027</strong> — incluso nel
            piano, con codice riscattabile nell'app
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
            data-testid="league-input-email"
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
            data-testid="league-input-confirm-email"
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
            data-testid="league-input-discount"
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

      {error && (
        <p className="text-sm text-red-600 font-medium" data-testid="league-error">
          {error}
        </p>
      )}

      <button
        onClick={onPay}
        disabled={loading}
        className="btn-primary justify-center disabled:opacity-70 disabled:cursor-wait"
        data-testid="league-pay-button"
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
    <main className="container-x py-16 md:py-24">
      <div className="max-w-lg mx-auto">
        <div className="card p-8 md:p-10 flex flex-col items-center text-center gap-6">
          <div className="h-16 w-16 rounded-full bg-green-100 grid place-items-center text-green-600">
            <CheckCircle2 size={32} />
          </div>
          <div>
            <h1 className="font-display font-bold text-3xl text-ink tracking-tightest">
              Pagamento effettuato!
            </h1>
            <p className="mt-2 text-muted text-sm">Benvenuto nella Super League. Ecco cosa fare adesso:</p>
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
                    data-testid="success-ios-link"
                  >
                    App Store
                  </a>
                  <a
                    href="https://play.google.com/store/apps/details?id=com.fantapronostic.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary text-xs px-3 py-1.5"
                    data-testid="success-android-link"
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
