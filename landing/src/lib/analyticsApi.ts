// Client for the admin analytics API.
//
// Auth note: the dashboard no longer holds a shared token in localStorage. It
// logs in with a password and the server replies with an httpOnly session
// cookie, so no secret is ever readable by JS, present in the URL or bundled.
//
// Transport: these calls go to a RELATIVE path, which Vercel rewrites to the
// backend (see vercel.json). That keeps them same-origin with the dashboard, so
// the session cookie is first-party — it works regardless of whether the
// backend runs on api.fantapronostic.com or on *.up.railway.app, and it does
// not need SameSite=None. Set VITE_ANALYTICS_API_BASE only to bypass the proxy
// (e.g. local development against a remote backend).

const BASE =
  (import.meta as any).env?.VITE_ANALYTICS_API_BASE || "/api/analytics";

export class AuthError extends Error {}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    ...init,
  });
  if (res.status === 401) throw new AuthError("Sessione scaduta");
  if (!res.ok) {
    let detail = "Errore nel caricamento dei dati";
    try {
      detail = (await res.json())?.detail || detail;
    } catch {
      /* keep default */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  login: (password: string) =>
    request<{ ok: boolean }>("/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => request<{ ok: boolean }>("/logout", { method: "POST" }),
  session: () => request<{ authenticated: boolean }>("/session"),
  get: <T,>(section: string, params: URLSearchParams) =>
    request<T>(`/${section}?${params.toString()}`),
  addAnnotation: (day: string, label: string, kind = "generic") =>
    request<Annotation>("/annotations", {
      method: "POST",
      body: JSON.stringify({ day, label, kind }),
    }),
  deleteAnnotation: (id: string) =>
    request<{ ok: boolean }>(`/annotations/${id}`, { method: "DELETE" }),
  exportUrl: (dataset: string, params: URLSearchParams) => {
    const p = new URLSearchParams(params);
    p.set("dataset", dataset);
    return `${BASE}/export?${p.toString()}`;
  },
};

// ── Shared types ────────────────────────────────────────────────────────────

export type PeriodInfo = {
  from: string | null;
  to: string | null;
  all_time: boolean;
  timezone: string;
  has_previous: boolean;
};

export type KpiCard = {
  key: string;
  value: number | null;
  format?: "int" | "pct" | "eur";
  previous: number | null;
  delta: number | null;
  denominator?: string | null;
  formula?: string | null;
  note?: string | null;
};

export type FunnelStep = {
  key: string;
  label: string;
  users: number | null;
  available: boolean;
  source?: string;
  note?: string;
  missing?: string | null;
  from_previous: number | null;
  from_start: number | null;
  lost: number | null;
  drop_rate?: number | null;
};

export type Annotation = { id: string; day: string; label: string; kind: string };

export type SeriesPoint = {
  day: string;
  visitors: number;
  clickers: number;
  registrations: number;
  league_joins: number;
  first_predictions: number;
  purchases: number;
  revenue: number;
};

export type Meta = {
  tracking_since: string | null;
  timezone: string;
  projects: { value: string; label: string }[];
  leagues: { id: string; name: string }[];
  creators: string[];
  campaigns: string[];
  sources: { value: string; label: string }[];
  mediums: string[];
  contents: string[];
  countries: string[];
  languages: string[];
  operating_systems: string[];
  devices: string[];
};

// ── Formatting helpers ──────────────────────────────────────────────────────

export const NOT_AVAILABLE = "Dato non ancora disponibile";

export function formatValue(value: number | null | undefined, format?: string): string {
  if (value === null || value === undefined) return "—";
  if (format === "pct") return `${value}%`;
  if (format === "eur")
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
  return new Intl.NumberFormat("it-IT").format(value);
}

export function formatDelta(delta: number | null | undefined): string | null {
  if (delta === null || delta === undefined) return null;
  return `${delta > 0 ? "+" : ""}${delta}%`;
}
