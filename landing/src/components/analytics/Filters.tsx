// Global filter bar. Every section reads the same state, so KPIs, charts,
// funnels and tables always describe the same slice of data.
//
// The state is mirrored into the URL query string (never the session secret),
// so a filtered view can be bookmarked and shared with another admin.

import { RotateCcw } from "lucide-react";
import type { Meta } from "@/lib/analyticsApi";
import { SUBTLE } from "./ui";

export type FilterState = {
  preset: string;
  from: string;
  to: string;
  project: string;
  league_id: string;
  campaign: string;
  creator: string;
  source: string;
  medium: string;
  content: string;
  country: string;
  language: string;
  os: string;
  device: string;
  store: string;
};

export const EMPTY_FILTERS: FilterState = {
  preset: "30d", from: "", to: "", project: "", league_id: "", campaign: "",
  creator: "", source: "", medium: "", content: "", country: "", language: "",
  os: "", device: "", store: "",
};

export const PRESETS: { value: string; label: string }[] = [
  { value: "today", label: "Oggi" },
  { value: "yesterday", label: "Ieri" },
  { value: "7d", label: "7 giorni" },
  { value: "30d", label: "30 giorni" },
  { value: "season", label: "Stagione" },
  { value: "all", label: "Sempre" },
  { value: "custom", label: "Personalizzato" },
];

// Start of the football season the dashboard reports on.
const SEASON_START = "2026-07-01";

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Resolve a preset into concrete Europe/Rome calendar days. */
export function resolveRange(f: FilterState): { from?: string; to?: string } {
  const now = new Date();
  const today = ymd(now);
  const back = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return ymd(d);
  };
  switch (f.preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday":
      return { from: back(1), to: back(1) };
    case "7d":
      return { from: back(6), to: today };
    case "30d":
      return { from: back(29), to: today };
    case "season":
      return { from: SEASON_START, to: today };
    case "custom":
      return { from: f.from || undefined, to: f.to || undefined };
    default:
      return {}; // "all"
  }
}

/** Query string sent to the API (and mirrored in the browser URL). */
export function toParams(f: FilterState): URLSearchParams {
  const p = new URLSearchParams();
  const { from, to } = resolveRange(f);
  if (from) p.set("from", from);
  if (to) p.set("to", to);
  (Object.keys(EMPTY_FILTERS) as (keyof FilterState)[]).forEach((k) => {
    if (k === "preset" || k === "from" || k === "to") return;
    if (f[k]) p.set(k, f[k]);
  });
  return p;
}

export function fromUrl(search: string): FilterState {
  const p = new URLSearchParams(search);
  const out = { ...EMPTY_FILTERS };
  (Object.keys(EMPTY_FILTERS) as (keyof FilterState)[]).forEach((k) => {
    const v = p.get(k);
    if (v) (out as any)[k] = v;
  });
  return out;
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  if (!options.length) return null;
  return (
    <label className="flex flex-col gap-1">
      <span className={`text-[9px] font-bold uppercase tracking-wider ${SUBTLE}`}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-white/15 bg-[#0b1530] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#F58220]"
      >
        <option value="">Tutti</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const asOptions = (values: string[]) => values.filter(Boolean).map((v) => ({ value: v, label: v }));

export function FilterBar({
  filters,
  meta,
  onChange,
  onReset,
}: {
  filters: FilterState;
  meta: Meta | null;
  onChange: (f: FilterState) => void;
  onReset: () => void;
}) {
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });
  const { from, to } = resolveRange(filters);
  const activeCount = (Object.keys(EMPTY_FILTERS) as (keyof FilterState)[]).filter(
    (k) => k !== "preset" && k !== "from" && k !== "to" && filters[k],
  ).length;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f1b3d] p-3 md:p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => set({ preset: p.value })}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              filters.preset === p.value
                ? "bg-[#F58220] text-white"
                : "border border-white/15 text-[#8ea0c9] hover:bg-white/10"
            }`}
          >
            {p.label}
          </button>
        ))}
        {filters.preset === "custom" && (
          <div className="ml-1 flex items-center gap-1.5">
            <input
              type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })}
              className="rounded-lg border border-white/15 bg-[#0b1530] px-2 py-1.5 text-xs text-white"
            />
            <span className={SUBTLE}>→</span>
            <input
              type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })}
              className="rounded-lg border border-white/15 bg-[#0b1530] px-2 py-1.5 text-xs text-white"
            />
          </div>
        )}
        <button
          onClick={onReset}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-[#8ea0c9] hover:bg-white/10"
        >
          <RotateCcw size={12} />
          Azzera filtri{activeCount ? ` (${activeCount})` : ""}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Select label="Progetto" value={filters.project} options={meta?.projects || []}
                onChange={(v) => set({ project: v })} />
        <Select label="Lega" value={filters.league_id}
                options={(meta?.leagues || []).map((l) => ({ value: l.id, label: l.name }))}
                onChange={(v) => set({ league_id: v })} />
        <Select label="Creator" value={filters.creator} options={asOptions(meta?.creators || [])}
                onChange={(v) => set({ creator: v })} />
        <Select label="Campagna" value={filters.campaign} options={asOptions(meta?.campaigns || [])}
                onChange={(v) => set({ campaign: v })} />
        <Select label="Sorgente" value={filters.source} options={meta?.sources || []}
                onChange={(v) => set({ source: v })} />
        <Select label="Mezzo" value={filters.medium} options={asOptions(meta?.mediums || [])}
                onChange={(v) => set({ medium: v })} />
        <Select label="Contenuto" value={filters.content} options={asOptions(meta?.contents || [])}
                onChange={(v) => set({ content: v })} />
        <Select label="Paese" value={filters.country} options={asOptions(meta?.countries || [])}
                onChange={(v) => set({ country: v })} />
        <Select label="Lingua" value={filters.language} options={asOptions(meta?.languages || [])}
                onChange={(v) => set({ language: v })} />
        <Select label="Sistema" value={filters.os} options={asOptions(meta?.operating_systems || [])}
                onChange={(v) => set({ os: v })} />
        <Select label="Dispositivo" value={filters.device} options={asOptions(meta?.devices || [])}
                onChange={(v) => set({ device: v })} />
        <Select label="Store" value={filters.store}
                options={[{ value: "apple", label: "App Store" }, { value: "google", label: "Google Play" }]}
                onChange={(v) => set({ store: v })} />
      </div>

      <p className={`mt-3 text-[11px] ${SUBTLE}`}>
        Periodo:{" "}
        <span className="font-bold text-white">
          {from ? `${from} → ${to || "oggi"}` : "sempre (tutti i dati)"}
        </span>
        {" · "}fuso orario {meta?.timezone || "Europe/Rome"}
        {meta?.tracking_since && (
          <> · tracking attivo dal {new Date(meta.tracking_since).toLocaleDateString("it-IT")}</>
        )}
      </p>
    </div>
  );
}
