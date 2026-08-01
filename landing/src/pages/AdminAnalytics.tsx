// FantaPronostic — internal product analytics dashboard.
//
// Nine sections over one shared filter contract, covering the journey
// creator/campaign → landing → store click → install → registration → league
// join → first prediction → retention, across Community League, Super League
// and any future league.
//
// Two principles are visible everywhere:
//   * counts are unique PEOPLE, not raw events;
//   * a metric that is not yet trackable says so, and names the missing event —
//     it is never faked, and never rendered as a zero.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, BarChart3, Download, Filter as FilterIcon, LogOut, RefreshCw,
} from "lucide-react";
import {
  AuthError, api, formatValue,
  type Annotation, type FunnelStep, type KpiCard, type Meta, type SeriesPoint,
} from "@/lib/analyticsApi";
import {
  EMPTY_FILTERS, FilterBar, type FilterState, fromUrl, toParams,
} from "@/components/analytics/Filters";
import { CohortTable, FunnelChart, METRICS, TimeSeriesChart } from "@/components/analytics/charts";
import {
  Banner, CARD, DataTable, ErrorState, Kpi, Loading, SUBTLE, Section, Unavailable,
} from "@/components/analytics/ui";

const TABS = [
  { id: "overview", label: "Panoramica" },
  { id: "funnel", label: "Funnel" },
  { id: "creators", label: "Campagne e creator" },
  { id: "community", label: "Community League" },
  { id: "superleague", label: "Super League" },
  { id: "engagement", label: "Engagement" },
  { id: "acquisition", label: "Acquisizione" },
  { id: "quality", label: "Qualità tracking" },
  { id: "events", label: "Eventi grezzi" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const KPI_LABELS: Record<string, string> = {
  visitors: "Visitatori unici", sessions: "Sessioni", returning: "Utenti di ritorno",
  clickers: "Persone che hanno cliccato", store_ctr: "CTR verso gli store",
  app_first_open: "Prime aperture app", registrations: "Registrazioni",
  league_joins: "Ingressi nelle leghe", predicting_users: "Con primo pronostico",
  activation_rate: "Tasso di attivazione", revenue: "Incassi lordi",
  purchases: "Acquisti completati", purchase_rate: "Conversione acquisto",
  unattributed: "Attribuzione sconosciuta",
};

const ACCENTS: Record<string, "white" | "orange" | "green"> = {
  visitors: "orange", clickers: "orange", revenue: "green",
  store_ctr: "green", activation_rate: "green",
};

export default function AdminAnalytics() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<TabId>("overview");
  const [filters, setFilters] = useState<FilterState>(() => fromUrl(window.location.search));
  const [showFilters, setShowFilters] = useState(false);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [data, setData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const params = useMemo(() => toParams(filters), [filters]);

  // Mirror filters into the URL so a view can be shared. Never the session.
  useEffect(() => {
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [params]);

  useEffect(() => {
    api.session()
      .then((r) => setAuthed(r.authenticated))
      .catch(() => setAuthed(false));
  }, []);

  const sectionsFor = (t: TabId): string[] => {
    switch (t) {
      case "overview": return ["overview", "timeseries"];
      case "funnel": return ["funnel"];
      case "creators": return ["creators"];
      case "community": return ["overview", "funnel", "engagement"];
      case "superleague": return ["superleague"];
      case "engagement": return ["engagement"];
      case "acquisition": return ["sources", "platforms"];
      case "quality": return ["quality"];
      case "events": return ["events"];
    }
  };

  const load = useCallback(async () => {
    if (!authed) return;
    setLoading(true);
    setError("");
    try {
      const p = new URLSearchParams(params);
      // The Community tab is the general view scoped to that project.
      if (tab === "community") p.set("project", "community");
      const sections = sectionsFor(tab);
      const results = await Promise.all(sections.map((s) => api.get<any>(s, p)));
      const next: Record<string, any> = {};
      sections.forEach((s, i) => (next[s] = results[i]));
      setData((d) => ({ ...d, ...next }));
    } catch (e) {
      if (e instanceof AuthError) {
        setAuthed(false);
      } else {
        setError(e instanceof Error ? e.message : "Errore imprevisto");
      }
    } finally {
      setLoading(false);
    }
  }, [authed, params, tab]);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  useEffect(() => {
    if (authed) api.get<Meta>("meta", new URLSearchParams()).then(setMeta).catch(() => {});
  }, [authed]);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      await api.login(password);
      setPassword("");
      setAuthed(true);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Accesso non riuscito");
    }
  };

  // ── Login gate ────────────────────────────────────────────────────────────
  if (authed === null) {
    return (
      <div className="min-h-screen bg-[#08122b]">
        <Loading />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#08122b] px-5">
        <form onSubmit={onLogin} className={`${CARD} flex w-full max-w-sm flex-col gap-4`}>
          <div className="flex items-center gap-2">
            <BarChart3 className="text-[#F58220]" size={20} />
            <h1 className="font-display text-xl font-bold text-white">Analytics</h1>
          </div>
          <p className={`text-sm ${SUBTLE}`}>Area riservata. Inserisci la password amministratore.</p>
          <input
            type="password" value={password} autoFocus autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)} placeholder="Password"
            className="w-full rounded-xl border border-white/15 bg-[#0b1530] px-4 py-3 text-white outline-none focus:border-[#F58220]"
          />
          {loginError && <p className="text-sm font-medium text-red-400">{loginError}</p>}
          <button type="submit" className="rounded-xl bg-[#F58220] px-4 py-3 font-display font-bold text-white">
            Entra
          </button>
          <p className="text-[10px] text-[#6f82ad]">
            La sessione dura 12 ore ed è conservata in un cookie httpOnly: nessun token
            viene salvato nel browser né nell'indirizzo della pagina.
          </p>
          <Link to="/" className={`text-center text-xs ${SUBTLE} hover:text-white`}>
            Torna alla home
          </Link>
        </form>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#08122b] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#08122b]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Link to="/" className={`${SUBTLE} hover:text-white`}>
            <ArrowLeft size={18} />
          </Link>
          <span className="font-display text-base font-bold">Analytics</span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-[#8ea0c9] hover:bg-white/10 lg:hidden"
            >
              <FilterIcon size={13} /> Filtri
            </button>
            <a
              href={api.exportUrl(tab === "creators" ? "creators" : tab === "events" ? "events" : "funnel", params)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-[#8ea0c9] hover:bg-white/10"
            >
              <Download size={13} /> CSV
            </a>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-[#8ea0c9] hover:bg-white/10"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Aggiorna
            </button>
            <button
              onClick={async () => {
                await api.logout().catch(() => {});
                setAuthed(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-[#8ea0c9] hover:bg-white/10"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
        <div className="mx-auto max-w-7xl overflow-x-auto px-4 pb-2">
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                  tab === t.id ? "bg-white/10 text-white" : "text-[#8ea0c9] hover:bg-white/5"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4">
        <div className={showFilters ? "" : "hidden lg:block"}>
          <FilterBar
            filters={filters} meta={meta}
            onChange={setFilters}
            onReset={() => setFilters({ ...EMPTY_FILTERS })}
          />
        </div>

        {error && <ErrorState message={error} onRetry={load} />}
        {loading && !Object.keys(data).length && <Loading />}

        {!error && (
          <>
            {(tab === "overview" || tab === "community") && (
              <OverviewTab data={data} params={params} onAnnotated={load} scoped={tab === "community"} />
            )}
            {tab === "funnel" && <FunnelTab data={data} />}
            {tab === "creators" && <CreatorsTab data={data} />}
            {tab === "superleague" && <SuperLeagueTab data={data} />}
            {tab === "engagement" && <EngagementTab data={data} />}
            {tab === "acquisition" && <AcquisitionTab data={data} />}
            {tab === "quality" && <QualityTab data={data} />}
            {tab === "events" && <EventsTab params={params} />}
          </>
        )}
      </main>
    </div>
  );
}

// ── Sections ────────────────────────────────────────────────────────────────

function OverviewTab({
  data, params, onAnnotated, scoped,
}: {
  data: Record<string, any>;
  params: URLSearchParams;
  onAnnotated: () => void;
  scoped: boolean;
}) {
  const overview = data.overview;
  const ts = data.timeseries;
  const [selected, setSelected] = useState<string[]>(["visitors", "clickers"]);
  const [cumulative, setCumulative] = useState(false);
  const [noteDay, setNoteDay] = useState("");
  const [noteLabel, setNoteLabel] = useState("");

  if (!overview) return <Loading />;

  return (
    <>
      {scoped && (
        <Banner level="info">
          Vista limitata alla <strong>Community League</strong>: i dati web sono filtrati sulle
          pagine <code>/community</code>. Registrazioni e ingressi non sono ancora separabili per
          lega finché l'app non invia gli eventi con <code>league_id</code>.
        </Banner>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {(overview.cards as KpiCard[]).map((c) => (
          <Kpi
            key={c.key} label={KPI_LABELS[c.key] || c.key} value={c.value}
            format={c.format} delta={c.delta} denominator={c.denominator}
            formula={c.formula} note={c.note} accent={ACCENTS[c.key] || "white"}
          />
        ))}
      </div>

      <Section
        title="Accessi e click per pagina"
        description="Persone uniche, non aperture: ogni visitatore conta una volta per pagina. La quota è sul totale dei visitatori del periodo, il CTR è calcolato sulla stessa pagina."
      >
        <PagesBreakdown rows={(overview.pages || []) as PageRow[]} />
      </Section>

      <Section
        title="Andamento nel tempo"
        description="Seleziona una o più metriche. Le linee arancioni tratteggiate sono le annotazioni."
        actions={
          <label className="inline-flex items-center gap-2 text-xs text-[#8ea0c9]">
            <input type="checkbox" checked={cumulative} onChange={(e) => setCumulative(e.target.checked)} />
            Cumulativo
          </label>
        }
      >
        <div className="mb-3 flex flex-wrap gap-1.5">
          {METRICS.map((m) => {
            const on = selected.includes(m.key as string);
            return (
              <button
                key={m.key}
                onClick={() =>
                  setSelected((s) =>
                    on ? s.filter((k) => k !== m.key) : [...s, m.key as string],
                  )
                }
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                  on ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-[#8ea0c9]"
                }`}
              >
                <span className="h-2 w-2 rounded-sm" style={{ background: m.color }} />
                {m.label}
              </button>
            );
          })}
        </div>
        {ts ? (
          <TimeSeriesChart
            series={ts.series as SeriesPoint[]}
            annotations={(ts.annotations || []) as Annotation[]}
            selected={selected} cumulative={cumulative}
          />
        ) : (
          <Loading />
        )}

        <form
          className="mt-4 flex flex-wrap items-end gap-2 border-t border-white/10 pt-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!noteDay || !noteLabel) return;
            await api.addAnnotation(noteDay, noteLabel).catch(() => {});
            setNoteLabel("");
            onAnnotated();
          }}
        >
          <label className="flex flex-col gap-1">
            <span className={`text-[9px] font-bold uppercase tracking-wider ${SUBTLE}`}>Data</span>
            <input type="date" value={noteDay} onChange={(e) => setNoteDay(e.target.value)}
                   className="rounded-lg border border-white/15 bg-[#0b1530] px-2 py-1.5 text-xs text-white" />
          </label>
          <label className="flex min-w-[180px] flex-1 flex-col gap-1">
            <span className={`text-[9px] font-bold uppercase tracking-wider ${SUBTLE}`}>Annotazione</span>
            <input
              value={noteLabel} onChange={(e) => setNoteLabel(e.target.value)}
              placeholder="Es. Story PippoFootball, Campagna Meta attivata"
              className="rounded-lg border border-white/15 bg-[#0b1530] px-2.5 py-1.5 text-xs text-white"
            />
          </label>
          <button className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/20">
            Aggiungi
          </button>
        </form>
      </Section>
    </>
  );
}

const BASIS_HELP: Record<string, string> = {
  event:
    "Metrica PER DATA EVENTO: conta ciò che è accaduto dentro il periodo selezionato.",
  cohort:
    "Metrica PER COORTE DI ACQUISIZIONE: segue le persone acquisite nel periodo, " +
    "anche quando completano il passaggio successivo più tardi.",
};

function RateGrid({ rates, basis }: { rates: Record<string, number | null>; basis: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {Object.entries(rates).map(([k, v]) => (
        <Kpi
          key={k} label={k.replace(/_/g, " ")} value={v} format="pct"
          formula={BASIS_HELP[basis]}
          note={v === null ? "Denominatore non disponibile" : undefined}
        />
      ))}
    </div>
  );
}

type PageRow = {
  path: string;
  label: string;
  visitors: number;
  views: number;
  clickers: number;
  clicks: number;
  share: number | null;
  ctr: number | null;
};

/** Per-page audience at a glance: a share bar for volume, a CTR column for quality. */
function PagesBreakdown({ rows }: { rows: PageRow[] }) {
  if (!rows.length)
    return <p className="text-sm text-[#8ea0c9]">Nessuna visita registrata nel periodo selezionato.</p>;

  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div
          key={r.path}
          className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div className="min-w-0">
              <p className="truncate font-semibold text-white">{r.label}</p>
              <p className="truncate text-[11px] text-[#8ea0c9]">{r.path}</p>
            </div>
            <div className="flex items-baseline gap-5 tabular-nums">
              <span className="text-right">
                <span className="block text-[10px] uppercase tracking-wider text-[#8ea0c9]">Visitatori</span>
                <span className="font-display font-bold text-white">
                  {formatValue(r.visitors)}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-[10px] uppercase tracking-wider text-[#8ea0c9]">Quota</span>
                <span className="font-display font-bold text-white">
                  {formatValue(r.share, "pct")}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-[10px] uppercase tracking-wider text-[#8ea0c9]">Click</span>
                <span className="font-display font-bold text-white">
                  {formatValue(r.clickers)}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-[10px] uppercase tracking-wider text-[#8ea0c9]">CTR</span>
                <span className="font-display font-bold text-[#F58220]">
                  {formatValue(r.ctr, "pct")}
                </span>
              </span>
            </div>
          </div>
          {/* Share bar: width is the page's slice of the period's audience. */}
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#F58220]"
              style={{ width: `${Math.min(r.share ?? 0, 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function FunnelTab({ data }: { data: Record<string, any> }) {
  const f = data.funnel;
  if (!f) return <Loading />;
  const web = f.web_funnel;
  const app = f.app_funnel;
  const attributed = f.attributed_funnel;
  const totals = f.unattributed_totals;

  return (
    <>
      <Banner level="info">
        I funnel restano <strong>separati di proposito</strong>. Il funnel web identifica le
        persone con <code>anonymous_id</code>, quello app con <code>user_id</code>: finché non
        esiste il collegamento tra i due, unirli produrrebbe percentuali costruite su
        popolazioni diverse.
      </Banner>

      <Section title={web.label}
               description={`Identità: ${web.identity} · ${BASIS_HELP[web.basis]}`}>
        <FunnelChart steps={web.steps as FunnelStep[]} />
        <div className="mt-4">
          <RateGrid rates={web.rates} basis={web.basis} />
        </div>
      </Section>

      <Section title={app.label}
               description={`Identità: ${app.identity} · ${BASIS_HELP[app.basis]} · coorte di ${app.cohort_size} utenti`}>
        <FunnelChart steps={app.steps as FunnelStep[]} />
        <div className="mt-4">
          <RateGrid rates={app.rates} basis={app.basis} />
        </div>
      </Section>

      <Section title={attributed.label}
               description="Solo le persone per cui il collegamento web→app esiste davvero.">
        {attributed.available ? (
          <FunnelChart steps={attributed.steps as FunnelStep[]} />
        ) : (
          <div className="flex flex-col gap-3">
            <Unavailable reason={attributed.missing} />
            <Kpi label="Copertura attribuzione" value={attributed.coverage} format="pct"
                 formula="Utenti con identità verificata ÷ visitatori web unici" />
          </div>
        )}
      </Section>

      <Section title={totals.label} description={totals.note}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Registrazioni" value={totals.registrations} formula={BASIS_HELP.event} />
          <Kpi label="Ingressi lega" value={totals.league_joins} formula={BASIS_HELP.event} />
          <Kpi label="Con pronostico" value={totals.predicting_users} formula={BASIS_HELP.event} />
          <Kpi label="Acquisti" value={totals.purchases} formula={BASIS_HELP.event} />
        </div>
      </Section>

      {f.blocked?.length > 0 && (
        <div className="flex flex-col gap-2">
          {f.blocked.map((b: string) => (
            <Banner key={b} level="warn">{b}</Banner>
          ))}
        </div>
      )}
    </>
  );
}

function CreatorsTab({ data }: { data: Record<string, any> }) {
  const c = data.creators;
  if (!c) return <Loading />;
  return (
    <Section
      title="Campagne e creator"
      description={`${c.creator_meaning}. Il creator migliore non è chi porta più visite, ma chi porta persone che entrano e giocano.`}
    >
      <DataTable
        columns={[
          { key: "key", label: "Creator / campagna" },
          { key: "visitors", label: "Visitatori", align: "right", tooltip: "Persone uniche sulla landing" },
          { key: "clickers", label: "Clicker unici", align: "right", tooltip: "Persone uniche che hanno cliccato uno store" },
          { key: "clicks", label: "Click totali", align: "right" },
          { key: "store_ctr", label: "CTR", align: "right", format: "pct", tooltip: "clicker unici ÷ visitatori unici" },
          { key: "clickers_apple", label: "iOS", align: "right" },
          { key: "clickers_google", label: "Android", align: "right" },
          { key: "registrations", label: "Registrazioni", align: "right", tooltip: "Richiede il collegamento web→app" },
          { key: "league_joins", label: "Ingressi", align: "right", tooltip: "Richiede il collegamento web→app" },
          { key: "purchases", label: "Vendite", align: "right", tooltip: "Da codice creator su pagamento Stripe" },
          { key: "revenue", label: "Ricavi", align: "right", format: "eur" },
        ]}
        rows={c.rows.map((r: any) => ({
          ...r,
          key: r.key === "(nessuno)" ? "Creator di acquisizione non disponibile" : r.key,
        }))}
      />
      {c.unavailable_columns && (
        <div className="mt-4 flex flex-col gap-2">
          <Banner level="info">{c.acquisition_attribution_note}</Banner>
          <Banner level="info">{c.sales_attribution_note}</Banner>
          <Banner level="warn">
            Colonne non ancora disponibili:{" "}
            {Object.entries(c.unavailable_columns as Record<string, string>)
              .map(([k, v]) => `${k} (${v})`)
              .join(" · ")}
          </Banner>
          <p className="text-[11px] text-[#6f82ad]">{c.cost_columns_note}</p>
        </div>
      )}
    </Section>
  );
}

function SuperLeagueTab({ data }: { data: Record<string, any> }) {
  const s = data.superleague;
  if (!s) return <Loading />;
  const k = s.kpis;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Ricavi lordi" value={k.revenue} format="eur" accent="green" />
        <Kpi label="Acquisti" value={k.purchases} accent="orange"
             formula="Solo conferma server-side dal webhook Stripe" />
        <Kpi label="Pre-iscritti" value={k.preregistrations} />
        <Kpi label="Tasso pre-iscrizione" value={k.prereg_rate} format="pct"
             denominator="visitatori /lega" />
        <Kpi label="Codici riscattati" value={k.codes_redeemed} />
        <Kpi label="Pagato ma non riscattato" value={k.paid_not_redeemed} accent="orange" />
        <Kpi label="Ore medie pagamento→riscatto" value={k.avg_hours_payment_to_redeem} />
        <Kpi label="Valore medio ordine" value={k.avg_order_value} format="eur" />
        <Kpi label="Checkout iniziati" value={k.checkout_started}
             note={k.checkout_started === null ? "Evento checkout_started da inviare dal sito" : undefined} />
        <Kpi label="Pagamenti falliti" value={k.payments_failed}
             note={s.unavailable?.payments_failed} />
        <Kpi label="Rimborsi" value={k.refunds} note={s.unavailable?.refunds} />
        <Kpi label="Landing → pagamento" value={k.landing_to_payment} format="pct" />
      </div>
      <Section title="Funnel Super League" description="Il pagamento conta solo se confermato dal webhook Stripe.">
        <FunnelChart steps={s.steps as FunnelStep[]} />
      </Section>
    </>
  );
}

function EngagementTab({ data }: { data: Record<string, any> }) {
  const e = data.engagement;
  if (!e) return <Loading />;
  const k = e.kpis;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Ingressi in lega" value={k.league_joins} />
        <Kpi label="Hanno giocato" value={k.predicting_users} accent="orange"
             formula="Utenti distinti con almeno un pronostico" />
        <Kpi label="Tasso di attivazione" value={k.activation_rate} format="pct" accent="green"
             denominator="ingressi in lega" />
        <Kpi label="Utenti inattivi" value={k.inactive_users} />
        <Kpi label="Pronostici medi per utente" value={k.avg_predictions_per_user} />
        <Kpi label="Giornate medie giocate" value={k.avg_matchdays_per_user} />
        <Kpi label="Retention 7 giorni" value={k.retention_d7} format="pct" note={e.unavailable?.retention_d7} />
        <Kpi label="Tutti i pronostici" value={k.full_slate_rate} format="pct" note={e.unavailable?.full_slate_rate} />
      </div>
      <Section title="Coorti settimanali"
               description="Righe: settimana di ingresso in lega. Colonne: settimane successive in cui hanno giocato.">
        <CohortTable cohorts={e.cohorts} />
      </Section>
    </>
  );
}

function AcquisitionTab({ data }: { data: Record<string, any> }) {
  const s = data.sources;
  const p = data.platforms;
  if (!s || !p) return <Loading />;
  return (
    <>
      <Section title="Sorgenti di traffico"
               description="I domini sono normalizzati: l.instagram.com e lm.instagram.com confluiscono in Instagram.">
        <DataTable
          columns={[
            { key: "label", label: "Sorgente" },
            { key: "visitors", label: "Visitatori", align: "right" },
            { key: "views", label: "Pagine viste", align: "right" },
            { key: "clickers", label: "Clicker unici", align: "right" },
            { key: "store_ctr", label: "CTR", align: "right", format: "pct" },
            { key: "share", label: "Quota", align: "right", format: "pct" },
            { key: "registrations", label: "Registrazioni", align: "right" },
            { key: "purchases", label: "Acquisti", align: "right" },
          ]}
          rows={s.rows}
        />
        <div className="mt-4 flex flex-col gap-2">
          {Object.entries(s.attribution as Record<string, string>).map(([k, v]) => (
            <p key={k} className="text-[11px] text-[#6f82ad]">
              <span className="font-bold text-[#8ea0c9]">{k}:</span> {v}
            </p>
          ))}
        </div>
      </Section>

      <Section title="iOS e Android"
               description="Controllo automatico: un utente mandato allo store sbagliato è un errore di CTA.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Visitatori iOS" value={p.ios.visitors} />
          <Kpi label="Visitatori Android" value={p.android.visitors} />
          <Kpi label="CTR iOS" value={p.ios.store_ctr} format="pct" accent="green" />
          <Kpi label="CTR Android" value={p.android.store_ctr} format="pct" accent="green" />
          <Kpi label="Click App Store" value={p.ios.clickers_apple + p.android.clickers_apple} />
          <Kpi label="Click Google Play" value={p.ios.clickers_google + p.android.clickers_google} />
          <Kpi label="Android → App Store" value={p.android.wrong_store_users}
               formula="Utenti Android che hanno cliccato l'App Store: destinazione errata" />
          <Kpi label="iOS → Google Play" value={p.ios.wrong_store_users}
               formula="Utenti iOS che hanno cliccato Google Play: destinazione errata" />
        </div>
        {p.anomalies?.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {p.anomalies.map((a: any, i: number) => (
              <Banner key={i} level="error">{a.text}</Banner>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

function QualityTab({ data }: { data: Record<string, any> }) {
  const q = data.quality;
  if (!q) return <Loading />;
  return (
    <>
      <Section title="Stato del tracking"
               description={`Tracking attivo dal ${
                 q.tracking_since ? new Date(q.tracking_since).toLocaleDateString("it-IT") : "—"
               } · ${formatValue(q.total_events)} eventi nel periodo`}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {q.checks.map((c: any) => (
            <Kpi key={c.key} label={c.label} value={c.value} format={c.format}
                 note={c.note} accent={c.level === "error" ? "white" : c.level === "ok" ? "green" : "white"} />
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {q.notes.map((n: string) => (
            <Banner key={n} level="info">{n}</Banner>
          ))}
        </div>
      </Section>

      <Section title="Eventi: attivi e mancanti"
               description="Un evento non attivo significa che quella metrica non esiste ancora, non che vale zero.">
        <DataTable
          columns={[
            { key: "event", label: "Evento" },
            { key: "group", label: "Origine" },
            { key: "stato", label: "Stato" },
            { key: "count", label: "Eventi", align: "right" },
            { key: "since_label", label: "Dal" },
            { key: "last_label", label: "Ultimo" },
            { key: "requires", label: "Richiede" },
          ]}
          rows={q.events.map((e: any) => ({
            ...e,
            key: e.event,
            stato: e.active ? "Attivo" : "In attesa di integrazione",
            since_label: e.since ? new Date(e.since).toLocaleDateString("it-IT") : null,
            last_label: e.last_seen ? new Date(e.last_seen).toLocaleDateString("it-IT") : null,
          }))}
        />
      </Section>
    </>
  );
}

function EventsTab({ params }: { params: URLSearchParams }) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(params);
    p.set("page", String(page));
    p.set("page_size", "50");
    if (q) p.set("q", q);
    setLoading(true);
    api.get<any>("events", p)
      .then((r) => {
        setRows(r.rows);
        setTotal(r.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params, page, q]);

  const pages = Math.max(1, Math.ceil(total / 50));

  return (
    <Section
      title="Eventi grezzi"
      description={`${formatValue(total)} eventi. Paginati e aggregati lato server: il browser non carica mai l'intero storico.`}
      actions={
        <input
          value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }}
          placeholder="Cerca pagina, creator, campagna…"
          className="rounded-lg border border-white/15 bg-[#0b1530] px-3 py-1.5 text-xs text-white"
        />
      }
    >
      {loading ? (
        <Loading />
      ) : (
        <>
          <DataTable
            columns={[
              { key: "ts", label: "Data e ora" },
              { key: "event", label: "Evento" },
              { key: "project_type", label: "Progetto" },
              { key: "visitor_id", label: "Anon ID" },
              { key: "user_id", label: "User ID" },
              { key: "creator", label: "Creator" },
              { key: "utm_campaign", label: "Campagna" },
              { key: "source_normalised", label: "Sorgente" },
              { key: "device", label: "Disp." },
              { key: "os", label: "OS" },
              { key: "page", label: "Pagina" },
            ]}
            rows={rows.map((r, i) => ({
              ...r,
              key: `${r.timestamp}-${i}`,
              ts: r.timestamp ? new Date(r.timestamp).toLocaleString("it-IT") : null,
            }))}
          />
          <div className="mt-3 flex items-center justify-between text-xs text-[#8ea0c9]">
            <span>Pagina {page} di {pages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                      className="rounded-full border border-white/15 px-3 py-1 disabled:opacity-40">
                Precedente
              </button>
              <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}
                      className="rounded-full border border-white/15 px-3 py-1 disabled:opacity-40">
                Successiva
              </button>
            </div>
          </div>
        </>
      )}
    </Section>
  );
}
