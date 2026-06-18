import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";

const BACKEND_URL =
  (import.meta as any).env?.VITE_BACKEND_URL ||
  "https://fanta-auth-fix.preview.emergentagent.com";

type Step = "form" | "verify" | "done";

type FormState = {
  email: string;
  password: string;
  confirmPassword: string;
  first_name: string;
  last_name: string;
  username: string;
  date_of_birth: string;
  address: string;
  city: string;
  country: string;
  postal_code: string;
  accepted_privacy: boolean;
  accepted_terms: boolean;
};

const initialForm: FormState = {
  email: "",
  password: "",
  confirmPassword: "",
  first_name: "",
  last_name: "",
  username: "",
  date_of_birth: "",
  address: "",
  city: "",
  country: "",
  postal_code: "",
  accepted_privacy: false,
  accepted_terms: false,
};

export default function RegisterPage() {
  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [resendStatus, setResendStatus] = useState<"idle" | "loading" | "sent">("idle");

  const update = (k: keyof FormState, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmitRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Le password non coincidono");
      return;
    }
    if (!form.accepted_privacy) {
      setError("È necessario accettare la Privacy Policy");
      return;
    }
    if (!form.accepted_terms) {
      setError("È necessario accettare i Termini e Condizioni");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        email: form.email.trim(),
        password: form.password,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        accepted_privacy: form.accepted_privacy,
        accepted_terms: form.accepted_terms,
        language: "it",
      };
      if (form.username.trim()) body.username = form.username.trim();
      if (form.date_of_birth) body.date_of_birth = form.date_of_birth;
      if (form.address.trim()) body.address = form.address.trim();
      if (form.city.trim()) body.city = form.city.trim();
      if (form.country.trim()) body.country = form.country.trim();
      if (form.postal_code.trim()) body.postal_code = form.postal_code.trim();

      const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        setError("Troppi tentativi, riprova tra qualche minuto.");
        return;
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.detail || "Registrazione non riuscita. Riprova.");
        return;
      }

      setStep("verify");
    } catch {
      setError("Errore di connessione. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  const onSubmitVerify = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.detail || "Codice non valido o scaduto.");
        return;
      }
      setStep("done");
    } catch {
      setError("Errore di connessione. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    if (resendStatus === "loading") return;
    setResendStatus("loading");
    try {
      await fetch(`${BACKEND_URL}/api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email.trim() }),
      });
      setResendStatus("sent");
      setTimeout(() => setResendStatus("idle"), 5000);
    } catch {
      setResendStatus("idle");
    }
  };

  return (
    <div className="min-h-screen bg-bg-soft" data-testid="register-page">
      <header className="bg-white border-b border-line">
        <div className="container-x py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5" data-testid="register-header-logo">
            <img src="/brand-icon.png" alt="FantaPronostic" className="h-9 w-9 rounded-xl" />
            <span className="font-display font-bold text-[17px] tracking-tight">
              <span className="text-brand-orange">Fanta</span>
              <span className="text-brand-blue">Pronostic</span>
            </span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-ink2 hover:text-brand-blue transition-colors"
            data-testid="register-back-home"
          >
            <ArrowLeft size={16} />
            Torna alla home
          </Link>
        </div>
      </header>

      <main className="container-x py-16 md:py-20">
        <div className="max-w-xl mx-auto">
          <p className="overline">Crea il tuo account</p>
          <h1 className="font-display font-bold text-4xl md:text-5xl mt-4 tracking-tightest text-ink">
            Registrati
          </h1>
          <p className="mt-4 text-muted text-base leading-relaxed">
            Crea un account gratuito per iniziare a pronosticare con i tuoi amici.
          </p>

          {step === "form" && (
            <form
              onSubmit={onSubmitRegister}
              className="mt-10 card p-6 md:p-8 flex flex-col gap-4"
              data-testid="register-form"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Nome"
                  value={form.first_name}
                  onChange={(v) => update("first_name", v)}
                  testid="register-input-first-name"
                  maxLength={50}
                />
                <Field
                  label="Cognome"
                  value={form.last_name}
                  onChange={(v) => update("last_name", v)}
                  testid="register-input-last-name"
                  maxLength={50}
                />
              </div>

              <Field
                label="Email"
                type="email"
                value={form.email}
                onChange={(v) => update("email", v)}
                testid="register-input-email"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Password (min. 8 caratteri)"
                  type="password"
                  value={form.password}
                  onChange={(v) => update("password", v)}
                  testid="register-input-password"
                  minLength={8}
                />
                <Field
                  label="Conferma password"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(v) => update("confirmPassword", v)}
                  testid="register-input-confirm-password"
                  minLength={8}
                />
              </div>

              <Field
                label="Username (opzionale)"
                value={form.username}
                onChange={(v) => update("username", v)}
                testid="register-input-username"
                required={false}
                maxLength={20}
              />

              <Field
                label="Data di nascita (opzionale)"
                type="date"
                value={form.date_of_birth}
                onChange={(v) => update("date_of_birth", v)}
                testid="register-input-dob"
                required={false}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Città (opzionale)"
                  value={form.city}
                  onChange={(v) => update("city", v)}
                  testid="register-input-city"
                  required={false}
                />
                <Field
                  label="Paese (opzionale)"
                  value={form.country}
                  onChange={(v) => update("country", v)}
                  testid="register-input-country"
                  required={false}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Indirizzo (opzionale)"
                  value={form.address}
                  onChange={(v) => update("address", v)}
                  testid="register-input-address"
                  required={false}
                />
                <Field
                  label="CAP (opzionale)"
                  value={form.postal_code}
                  onChange={(v) => update("postal_code", v)}
                  testid="register-input-postal-code"
                  required={false}
                />
              </div>

              <label className="flex items-start gap-3 text-sm text-ink2 mt-2">
                <input
                  type="checkbox"
                  checked={form.accepted_privacy}
                  onChange={(e) => update("accepted_privacy", e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-line accent-brand-blue"
                  data-testid="register-checkbox-privacy"
                />
                <span>
                  Accetto la{" "}
                  <Link to="/privacy" className="text-brand-blue font-semibold hover:underline">
                    Privacy Policy
                  </Link>
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm text-ink2">
                <input
                  type="checkbox"
                  checked={form.accepted_terms}
                  onChange={(e) => update("accepted_terms", e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-line accent-brand-blue"
                  data-testid="register-checkbox-terms"
                />
                <span>Accetto i Termini e Condizioni</span>
              </label>

              {error && (
                <p className="text-sm text-red-600 font-medium" data-testid="register-error">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary justify-center mt-2 disabled:opacity-70 disabled:cursor-wait"
                data-testid="register-submit"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Creazione account…
                  </>
                ) : (
                  <>
                    Crea account
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          )}

          {step === "verify" && (
            <form
              onSubmit={onSubmitVerify}
              className="mt-10 card p-6 md:p-8 flex flex-col gap-4"
              data-testid="verify-form"
            >
              <p className="text-sm text-ink2 leading-relaxed">
                Abbiamo inviato un codice a 6 cifre a <strong>{form.email}</strong>. Inseriscilo
                qui sotto per completare la registrazione. Il codice è valido per 30 minuti.
              </p>

              <Field
                label="Codice di verifica"
                value={code}
                onChange={setCode}
                testid="verify-input-code"
                maxLength={6}
              />

              {error && (
                <p className="text-sm text-red-600 font-medium" data-testid="verify-error">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary justify-center mt-2 disabled:opacity-70 disabled:cursor-wait"
                data-testid="verify-submit"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Verifica in corso…
                  </>
                ) : (
                  <>
                    Verifica email
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onResend}
                disabled={resendStatus === "loading"}
                className="text-sm font-semibold text-brand-blue hover:underline self-start disabled:opacity-60"
                data-testid="verify-resend"
              >
                {resendStatus === "sent"
                  ? "Codice inviato di nuovo"
                  : resendStatus === "loading"
                  ? "Invio in corso…"
                  : "Non hai ricevuto il codice? Invia di nuovo"}
              </button>
            </form>
          )}

          {step === "done" && (
            <div
              className="mt-10 card p-8 flex flex-col items-center text-center gap-4"
              data-testid="register-success"
            >
              <div className="h-14 w-14 rounded-full bg-brand-orange-50 grid place-items-center text-brand-orange">
                <Check size={28} />
              </div>
              <h2 className="font-display font-bold text-2xl text-ink">Email verificata!</h2>
              <p className="text-muted text-sm leading-relaxed">
                Il tuo account è pronto. Scarica l'app per iniziare a pronosticare.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                <a
                  href="https://apps.apple.com/it/app/fantapronostic/id6760613936"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-blue"
                  data-testid="register-success-ios"
                >
                  App Store
                </a>
                <a
                  href="https://play.google.com/store/apps/details?id=com.fantapronostic.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                  data-testid="register-success-android"
                >
                  Google Play
                </a>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-line bg-white">
        <div className="container-x py-8 text-center text-xs text-muted">
          © {new Date().getFullYear()} FantaPronostic. Tutti i diritti riservati.
        </div>
      </footer>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  testid,
  required = true,
  minLength,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  testid: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-muted font-bold mb-2 block">
        {label}
      </label>
      <input
        required={required}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        minLength={minLength}
        maxLength={maxLength}
        className="w-full rounded-2xl border border-line bg-bg-soft px-5 py-3.5 text-ink placeholder:text-muted focus:outline-none focus:border-brand-blue focus:bg-white transition-colors"
        data-testid={testid}
      />
    </div>
  );
}
