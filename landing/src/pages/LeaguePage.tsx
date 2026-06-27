import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Trophy,
  Users,
  CalendarDays,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  Star,
  Zap,
  Target,
  Lock,
} from "lucide-react";
import { getStoredUser } from "@/lib/authStorage";

const BACKEND_URL =
  (import.meta as any).env?.VITE_BACKEND_URL ||
  "https://fanta-auth-fix.preview.emergentagent.com";

// ─── Configura qui la lega ─────────────────────────────────────────────────
const LEAGUE = {
  name: "Lega FantaPronostic",       // TODO: nome definitivo
  season: "Stagione 2025/26",
  price: 20,                          // TODO: prezzo in EUR
  spots: 20,                          // TODO: posti disponibili
  spotsLeft: 14,                      // TODO: aggiorna dinamicamente
  leagueId: "7e044748-6221-495e-af7a-6d6b9e11bcde",
  prizes: [
    { place: 1, label: "1° Posto", amount: 150, icon: "🥇" },
    { place: 2, label: "2° Posto", amount: 70,  icon: "🥈" },
    { place: 3, label: "3° Posto", amount: 30,  icon: "🥉" },
  ],
  rules: [
    "Ogni giornata devi inserire il pronostico (1X2) per ogni partita entro il fischio d'inizio.",
    "Pronostico esatto: 2 punti. Puoi usare la Carta Jolly una volta per raddoppiare il punteggio di una giornata.",
    "La classifica è aggiornata in tempo reale dopo ogni giornata di campionato.",
    "Al termine della stagione, i tre classificati ricevono il premio tramite bonifico o PayPal.",
    "Vietato cedere o condividere l'accesso. Il profilo è personale e non trasferibile.",
    "In caso di parità a fine stagione, conta il maggior numero di pronostici esatti.",
  ],
  howItWorks: [
    {
      title: "Acquista l'accesso",
      desc: "Paga la quota con carta o bonifico tramite Stripe. Ricevi subito la conferma via email.",
    },
    {
      title: "Entra nella lega",
      desc: "Scarica FantaPronostic, accedi con la stessa email usata al pagamento e trovati già dentro la lega.",
    },
    {
      title: "Pronostica e vinci",
      desc: "Ogni giornata inserisci i tuoi pronostici, scala la classifica e conquista i premi finali.",
    },
  ],
};
// ──────────────────────────────────────────────────────────────────────────────

export default function LeaguePage() {
  const [searchParams] = useSearchParams();
  const paymentStatus = searchParams.get("payment");

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const storedUser = getStoredUser();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const totalPrizePool = LEAGUE.prizes.reduce((s, p) => s + p.amount, 0);

  const handlePay = async () => {
    if (!email.trim() || !email.includes("@")) {
      setError("Inserisci un'email valida per ricevere la conferma.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/payments/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          league_id: LEAGUE.leagueId,
          success_url: `${window.location.origin}/lega?payment=success`,
          cancel_url: `${window.location.origin}/lega?payment=cancelled`,
        }),
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

  const stepIcons = [
    <ShieldCheck size={24} />,
    <Zap size={24} />,
    <Target size={24} />,
  ];

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

      {/* Payment feedback banners */}
      {paymentStatus === "success" && (
        <div className="bg-green-50 border-b border-green-200">
          <div className="container-x py-4 flex items-center gap-3 text-green-800">
            <CheckCircle2 size={20} className="shrink-0" />
            <p className="text-sm font-semibold">
              Pagamento completato! Controlla la tua email — riceverai a breve le istruzioni per accedere alla lega.
            </p>
          </div>
        </div>
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

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden bg-white">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-brand-orange/10 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-brand-blue/10 blur-3xl" />
          </div>
          <div className="container-x py-16 md:py-24 relative">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-orange/10 px-4 py-1.5 text-xs font-bold text-brand-orange uppercase tracking-widest mb-6">
                <Star size={12} />
                {LEAGUE.season}
              </span>
              <h1 className="font-display font-bold text-4xl md:text-6xl tracking-tightest text-ink leading-[1.05]">
                {LEAGUE.name}
              </h1>
              <p className="mt-5 text-lg text-muted leading-relaxed max-w-xl">
                La lega privata a pagamento di FantaPronostic. Pronostici, classifica in tempo reale
                e un montepremi reale per i migliori tre classificati.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <div className="flex items-center gap-2 rounded-2xl bg-bg-soft border border-line px-4 py-3">
                  <Trophy size={18} className="text-brand-orange" />
                  <span className="text-sm font-semibold text-ink">Montepremi €{totalPrizePool}</span>
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-bg-soft border border-line px-4 py-3">
                  <Users size={18} className="text-brand-blue" />
                  <span className="text-sm font-semibold text-ink">
                    {LEAGUE.spotsLeft} posti su {LEAGUE.spots} disponibili
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-bg-soft border border-line px-4 py-3">
                  <CalendarDays size={18} className="text-ink2" />
                  <span className="text-sm font-semibold text-ink">Serie A 2025/26</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PREMI */}
        <section className="container-x py-16">
          <p className="overline text-center">Montepremi</p>
          <h2 className="font-display font-bold text-3xl md:text-4xl text-center text-ink mt-3 tracking-tightest">
            Cosa puoi vincere
          </h2>
          <p className="text-center text-muted mt-3 max-w-md mx-auto">
            I premi vengono assegnati al termine della stagione ai tre migliori classificati.
          </p>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {LEAGUE.prizes.map((p) => (
              <div
                key={p.place}
                className={`card p-6 text-center flex flex-col items-center gap-3 ${
                  p.place === 1
                    ? "border-brand-orange shadow-cta ring-2 ring-brand-orange/20"
                    : ""
                }`}
              >
                <span className="text-4xl">{p.icon}</span>
                <span className="text-xs font-bold uppercase tracking-widest text-muted">
                  {p.label}
                </span>
                <span className="font-display font-bold text-3xl text-ink">€{p.amount}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-muted mt-6">
            Montepremi totale garantito: <strong>€{totalPrizePool}</strong> · Erogato tramite bonifico o PayPal
          </p>
        </section>

        {/* COME FUNZIONA */}
        <section className="bg-white border-y border-line">
          <div className="container-x py-16">
            <p className="overline text-center">Come funziona</p>
            <h2 className="font-display font-bold text-3xl md:text-4xl text-center text-ink mt-3 tracking-tightest">
              Tre passi per iniziare
            </h2>
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {LEAGUE.howItWorks.map((s, i) => (
                <div key={i} className="flex flex-col items-center text-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-brand-orange/10 grid place-items-center text-brand-orange">
                    {stepIcons[i]}
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-muted">
                    Step {i + 1}
                  </span>
                  <h3 className="font-display font-bold text-lg text-ink">{s.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* REGOLAMENTO */}
        <section className="container-x py-16">
          <div className="max-w-2xl mx-auto">
            <p className="overline">Regolamento</p>
            <h2 className="font-display font-bold text-3xl text-ink mt-3 tracking-tightest">
              Le regole del gioco
            </h2>
            <ul className="mt-8 flex flex-col gap-4">
              {LEAGUE.rules.map((r, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-brand-orange shrink-0 mt-0.5" />
                  <span className="text-sm text-ink2 leading-relaxed">{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ACQUISTA */}
        <section className="bg-white border-t border-line">
          <div className="container-x py-16">
            <div className="max-w-md mx-auto">
              <div className="card p-8 flex flex-col gap-5">
                <div className="text-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">
                    Quota di iscrizione
                  </p>
                  <div className="flex items-end justify-center gap-1">
                    <span className="font-display font-bold text-5xl text-ink">€{LEAGUE.price}</span>
                    <span className="text-muted text-sm mb-2">una tantum</span>
                  </div>
                  <p className="text-xs text-muted mt-2">
                    {LEAGUE.spotsLeft} posti rimanenti su {LEAGUE.spots}
                  </p>
                </div>

                <div className="h-px bg-line" />

                <ul className="flex flex-col gap-2.5">
                  {[
                    "Accesso illimitato per tutta la stagione",
                    "Classifica in tempo reale",
                    "Carta Jolly e bonus speciali",
                    "Partecipazione al montepremi",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-ink2">
                      <CheckCircle2 size={15} className="text-brand-orange shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>

                <div className="h-px bg-line" />

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
                  <p className="text-xs text-muted mt-2 flex items-start gap-1.5">
                    <Lock size={11} className="shrink-0 mt-0.5" />
                    Usa la stessa email che userai su FantaPronostic. Riceverai la conferma qui.
                  </p>
                </div>

                {error && (
                  <p className="text-sm text-red-600 font-medium" data-testid="league-error">
                    {error}
                  </p>
                )}

                <button
                  onClick={handlePay}
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
                      Acquista accesso — €{LEAGUE.price}
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>

                <p className="text-center text-xs text-muted flex items-center justify-center gap-1.5">
                  <ShieldCheck size={13} />
                  Pagamento sicuro tramite Stripe · Nessun dato della carta salvato sul sito
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="container-x py-16">
          <div className="max-w-2xl mx-auto">
            <p className="overline">FAQ</p>
            <h2 className="font-display font-bold text-3xl text-ink mt-3 tracking-tightest">
              Domande frequenti
            </h2>
            <div className="mt-8 flex flex-col gap-6">
              {[
                {
                  q: "Non ho ancora l'app. Posso pagare lo stesso?",
                  a: "Sì. Inserisci la tua email, completa il pagamento e ricevi la conferma. Poi scarica FantaPronostic e registrati con la stessa email — troverai già la lega disponibile.",
                },
                {
                  q: "Come ricevo il montepremi se vinco?",
                  a: "A fine stagione ti contatteremo all'email usata per l'iscrizione per concordare il metodo di pagamento (bonifico o PayPal).",
                },
                {
                  q: "Posso trasferire il mio accesso a qualcun altro?",
                  a: "No. L'accesso è personale e legato all'email di pagamento. Eventuali abusi comportano l'esclusione dalla lega senza rimborso.",
                },
                {
                  q: "È previsto un rimborso se mi ritiro?",
                  a: "La quota non è rimborsabile una volta effettuato il pagamento e ottenuto l'accesso alla lega.",
                },
              ].map((faq, i) => (
                <div key={i} className="border-b border-line pb-6 last:border-0">
                  <h3 className="font-semibold text-ink text-base">{faq.q}</h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-white">
        <div className="container-x py-8 text-center text-xs text-muted">
          © {new Date().getFullYear()} FantaPronostic. Tutti i diritti riservati.
        </div>
      </footer>
    </div>
  );
}
