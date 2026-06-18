import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";

const BACKEND_URL =
  (import.meta as any).env?.VITE_BACKEND_URL ||
  "https://fanta-auth-fix.preview.emergentagent.com";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (res.status === 429) {
        setError("Troppi tentativi, riprova tra qualche minuto.");
        return;
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.detail || "Email o password non validi.");
        return;
      }

      setDone(true);
    } catch {
      setError("Errore di connessione. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-soft" data-testid="login-page">
      <header className="bg-white border-b border-line">
        <div className="container-x py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5" data-testid="login-header-logo">
            <img src="/brand-icon.png" alt="FantaPronostic" className="h-9 w-9 rounded-xl" />
            <span className="font-display font-bold text-[17px] tracking-tight">
              <span className="text-brand-orange">Fanta</span>
              <span className="text-brand-blue">Pronostic</span>
            </span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-ink2 hover:text-brand-blue transition-colors"
            data-testid="login-back-home"
          >
            <ArrowLeft size={16} />
            Torna alla home
          </Link>
        </div>
      </header>

      <main className="container-x py-16 md:py-20">
        <div className="max-w-xl mx-auto">
          <p className="overline">Bentornato</p>
          <h1 className="font-display font-bold text-4xl md:text-5xl mt-4 tracking-tightest text-ink">
            Accedi
          </h1>
          <p className="mt-4 text-muted text-base leading-relaxed">
            Accedi al tuo account FantaPronostic.
          </p>

          {!done && (
            <form
              onSubmit={onSubmit}
              className="mt-10 card p-6 md:p-8 flex flex-col gap-4"
              data-testid="login-form"
            >
              <Field
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                testid="login-input-email"
              />

              <Field
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                testid="login-input-password"
              />

              {error && (
                <p className="text-sm text-red-600 font-medium" data-testid="login-error">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary justify-center mt-2 disabled:opacity-70 disabled:cursor-wait"
                data-testid="login-submit"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Accesso in corso…
                  </>
                ) : (
                  <>
                    Accedi
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <p className="text-sm text-ink2 text-center mt-2">
                Non hai un account?{" "}
                <Link to="/register" className="text-brand-blue font-semibold hover:underline">
                  Registrati
                </Link>
              </p>
            </form>
          )}

          {done && (
            <div
              className="mt-10 card p-8 flex flex-col items-center text-center gap-4"
              data-testid="login-success"
            >
              <div className="h-14 w-14 rounded-full bg-brand-orange-50 grid place-items-center text-brand-orange">
                <Check size={28} />
              </div>
              <h2 className="font-display font-bold text-2xl text-ink">Accesso effettuato!</h2>
              <p className="text-muted text-sm leading-relaxed">
                Apri l'app FantaPronostic per continuare a pronosticare.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                <a
                  href="https://apps.apple.com/it/app/fantapronostic/id6760613936"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-blue"
                  data-testid="login-success-ios"
                >
                  App Store
                </a>
                <a
                  href="https://play.google.com/store/apps/details?id=com.fantapronostic.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                  data-testid="login-success-android"
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  testid: string;
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-muted font-bold mb-2 block">
        {label}
      </label>
      <input
        required
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-line bg-bg-soft px-5 py-3.5 text-ink placeholder:text-muted focus:outline-none focus:border-brand-blue focus:bg-white transition-colors"
        data-testid={testid}
      />
    </div>
  );
}
