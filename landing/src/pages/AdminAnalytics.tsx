import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RefreshCw, Loader2, LogOut } from "lucide-react";

const BACKEND_URL =
  (import.meta as any).env?.VITE_BACKEND_URL || "https://api.fantapronostic.com";

const TOKEN_KEY = "fp_analytics_token";

type Summary = {
  totals: { appstore: number; googleplay: number; total: number; views: number };
  today: { appstore: number; googleplay: number; total: number; views: number };
  creators: { creator: string; appstore: number; googleplay: number; total: number }[];
  top_pages: { page: string; views: number }[];
  daily: { day: string; appstore: number; googleplay: number; views: number }[];
  generated_at: string;
};

export default function AdminAnalytics() {
  const [token, setToken] = useState<string>(() => localStorage.getItem(TOKEN_KEY) || "");
  const [tokenInput, setTokenInput] = useState("");
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async (t: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/analytics/summary`, {
        headers: { "X-Analytics-Token": t },
      });
      if (res.status === 401) {
        setError("Token non valido.");
        setData(null);
        return;
      }
      if (!res.ok) {
        setError("Errore nel caricamento dei dati.");
        return;
      }
      const json = (await res.json()) as Summary;
      setData(json);
    } catch {
      setError("Errore di connessione.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const onLogin = () => {
    const t = tokenInput.trim();
    if (!t) return;
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
  };

  const onLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setData(null);
  };

  const maxDaily = useMemo(
    () => Math.max(1, ...(data?.daily || []).map((d) => d.appstore + d.googleplay)),
    [data],
  );

  // ── Login gate ──────────────────────────────────────────────────────────────
  if (!token || (error === "Token non valido." && !data)) {
    return (
      <div className="min-h-screen bg-bg-soft grid place-items-center px-5">
        <div className="card p-8 w-full max-w-sm flex flex-col gap-4">
          <h1 className="font-display font-bold text-2xl text-ink">Analytics — Accesso</h1>
          <p className="text-sm text-muted">Inserisci il token di amministrazione.</p>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onLogin()}
            placeholder="Token"
            className="w-full rounded-2xl border border-line bg-bg-soft px-5 py-3.5 text-ink focus:outline-none focus:border-brand-blue focus:bg-white"
          />
          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
          <button onClick={onLogin} className="btn-primary justify-center">
            Entra
          </button>
          <Link to="/" className="text-xs text-muted hover:text-brand-blue text-center">
            Torna alla home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-soft">
      <header className="bg-white border-b border-line">
        <div className="container-x py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-ink2 hover:text-brand-blue">
              <ArrowLeft size={18} />
            </Link>
            <span className="font-display font-bold text-lg text-ink">Analytics — Download</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(token)}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm font-semibold text-ink2 hover:bg-bg-soft"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Aggiorna
            </button>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm font-semibold text-ink2 hover:bg-bg-soft"
            >
              <LogOut size={14} />
              Esci
            </button>
          </div>
        </div>
      </header>

      <main className="container-x py-8">
        {error && <p className="text-sm text-red-600 font-medium mb-4">{error}</p>}

        {!data ? (
          <div className="py-20 text-center text-muted">
            <Loader2 size={24} className="animate-spin mx-auto" />
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {/* KPI visite */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Kpi label="Visite (totale)" value={data.totals.views ?? 0} accent="blue" />
              <Kpi label="Visite oggi" value={data.today.views ?? 0} accent="blue" />
              <Kpi label="Totale click store" value={data.totals.total} accent="orange" />
              <Kpi label="Click oggi" value={data.today.total} accent="orange"
                   sub={`${data.today.appstore} iOS · ${data.today.googleplay} Android`} />
            </div>

            {/* KPI click */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Kpi label="App Store (totale)" value={data.totals.appstore} accent="ink" />
              <Kpi label="Google Play (totale)" value={data.totals.googleplay} accent="green" />
              <Kpi label="App Store oggi" value={data.today.appstore} accent="ink" />
              <Kpi label="Google Play oggi" value={data.today.googleplay} accent="green" />
            </div>

            {/* Grafico giornaliero */}
            <div className="card p-6">
              <h2 className="font-display font-bold text-lg text-ink">Ultimi 30 giorni</h2>
              <div className="mt-2 flex items-center gap-4 text-xs text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-ink" /> App Store
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-green-600" /> Google Play
                </span>
              </div>
              <div className="mt-5 flex items-end gap-1 h-48">
                {data.daily.map((d) => {
                  const total = d.appstore + d.googleplay;
                  const h = (total / maxDaily) * 100;
                  const iosH = total ? (d.appstore / total) * h : 0;
                  const andH = total ? (d.googleplay / total) * h : 0;
                  return (
                    <div
                      key={d.day}
                      className="flex-1 flex flex-col justify-end group relative"
                      title={`${d.day}: ${d.appstore} iOS, ${d.googleplay} Android`}
                    >
                      <div className="w-full rounded-t bg-green-600" style={{ height: `${andH}%` }} />
                      <div className="w-full bg-ink" style={{ height: `${iosH}%` }} />
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block whitespace-nowrap rounded bg-ink text-white text-[10px] px-1.5 py-0.5">
                        {total}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-muted">
                <span>{data.daily[0]?.day.slice(5)}</span>
                <span>{data.daily[data.daily.length - 1]?.day.slice(5)}</span>
              </div>
            </div>

            {/* Pagine più viste */}
            <div className="card p-6">
              <h2 className="font-display font-bold text-lg text-ink">Pagine più viste</h2>
              {(!data.top_pages || data.top_pages.length === 0) ? (
                <p className="mt-3 text-sm text-muted">Ancora nessuna visita registrata.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted border-b border-line">
                        <th className="py-2 pr-4 font-semibold">Pagina</th>
                        <th className="py-2 pl-4 font-semibold text-right">Visite</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.top_pages.map((p) => (
                        <tr key={p.page} className="border-b border-line/60 last:border-0">
                          <td className="py-2.5 pr-4 font-medium text-ink break-all">{p.page}</td>
                          <td className="py-2.5 pl-4 text-right font-semibold tabular-nums">{p.views}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Per creator */}
            <div className="card p-6">
              <h2 className="font-display font-bold text-lg text-ink">Ripartizione per creator</h2>
              {data.creators.length === 0 ? (
                <p className="mt-3 text-sm text-muted">Ancora nessun click registrato.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted border-b border-line">
                        <th className="py-2 pr-4 font-semibold">Creator</th>
                        <th className="py-2 px-4 font-semibold text-right">App Store</th>
                        <th className="py-2 px-4 font-semibold text-right">Google Play</th>
                        <th className="py-2 px-4 font-semibold text-right">Totale</th>
                        <th className="py-2 pl-4 font-semibold text-right">Quota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.creators.map((c) => (
                        <tr key={c.creator} className="border-b border-line/60 last:border-0">
                          <td className="py-2.5 pr-4 font-medium text-ink">{c.creator}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums">{c.appstore}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums">{c.googleplay}</td>
                          <td className="py-2.5 px-4 text-right font-semibold tabular-nums">{c.total}</td>
                          <td className="py-2.5 pl-4 text-right tabular-nums text-muted">
                            {data.totals.total
                              ? Math.round((c.total / data.totals.total) * 100)
                              : 0}
                            %
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <p className="text-xs text-muted text-center">
              Aggiornato: {new Date(data.generated_at).toLocaleString("it-IT")}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number;
  sub?: string;
  accent: "ink" | "green" | "orange" | "blue";
}) {
  const color =
    accent === "green"
      ? "text-green-600"
      : accent === "orange"
      ? "text-brand-orange"
      : accent === "blue"
      ? "text-brand-blue"
      : "text-ink";
  return (
    <div className="card p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-muted">{label}</p>
      <p className={`mt-2 font-display font-bold text-3xl tabular-nums ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}
