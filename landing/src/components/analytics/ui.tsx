// Shared presentational primitives for the analytics dashboard.
// Dark-navy surface, brand orange for headline numbers, green for good news,
// red for anomalies. Nothing decorative that costs legibility.

import { useState, type ReactNode } from "react";
import { AlertTriangle, HelpCircle, Info, TrendingDown, TrendingUp } from "lucide-react";
import { NOT_AVAILABLE, formatDelta, formatValue } from "@/lib/analyticsApi";

export const CARD = "rounded-2xl border border-white/10 bg-[#0f1b3d] p-4 md:p-5";
export const SUBTLE = "text-[#8ea0c9]";

/** Small "?" that reveals a metric's exact definition. */
export function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="Spiegazione della metrica"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        className={`${SUBTLE} hover:text-white transition-colors`}
      >
        <HelpCircle size={13} />
      </button>
      {open && (
        <span className="absolute left-1/2 top-5 z-30 w-56 -translate-x-1/2 rounded-xl border border-white/15 bg-[#08122b] p-2.5 text-[11px] leading-relaxed text-white shadow-xl">
          {text}
        </span>
      )}
    </span>
  );
}

/** A metric that has no data yet states which event is missing. */
export function Unavailable({ reason }: { reason?: string | null }) {
  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className={`text-sm font-semibold ${SUBTLE}`}>{NOT_AVAILABLE}</span>
      {reason && <span className="text-[10px] text-[#6f82ad]">{reason}</span>}
    </span>
  );
}

export function Kpi({
  label,
  value,
  format,
  delta,
  denominator,
  formula,
  note,
  accent = "white",
}: {
  label: string;
  value: number | null;
  format?: string;
  delta?: number | null;
  denominator?: string | null;
  formula?: string | null;
  note?: string | null;
  accent?: "white" | "orange" | "green";
}) {
  const unavailable = value === null || value === undefined;
  const color =
    accent === "orange" ? "text-[#F58220]" : accent === "green" ? "text-emerald-400" : "text-white";
  const deltaText = formatDelta(delta);
  const up = (delta ?? 0) > 0;

  return (
    <div className={CARD}>
      <div className="flex items-start justify-between gap-2">
        <p className={`text-[10px] font-bold uppercase tracking-[0.14em] ${SUBTLE}`}>{label}</p>
        {formula && <Tooltip text={formula} />}
      </div>
      {unavailable ? (
        <div className="mt-2">
          <Unavailable reason={note} />
        </div>
      ) : (
        <>
          <p className={`mt-2 font-display font-bold text-2xl md:text-3xl tabular-nums ${color}`}>
            {formatValue(value, format)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {deltaText && (
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                  up ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {deltaText}
              </span>
            )}
            {denominator && <span className="text-[10px] text-[#6f82ad]">su {denominator}</span>}
          </div>
          {note && (
            <p className="mt-1.5 inline-flex items-start gap-1 text-[10px] text-amber-300/80">
              <Info size={10} className="mt-px shrink-0" />
              {note}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-lg text-white">{title}</h2>
          {description && <p className={`mt-1 text-xs ${SUBTLE}`}>{description}</p>}
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Banner({
  level = "info",
  children,
}: {
  level?: "info" | "warn" | "error" | "ok";
  children: ReactNode;
}) {
  const styles = {
    info: "border-sky-400/30 bg-sky-400/10 text-sky-200",
    warn: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    error: "border-red-400/30 bg-red-400/10 text-red-200",
    ok: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  }[level];
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${styles}`}>
      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

/** Sortable table. Cells render "—" for null so a gap never looks like a zero. */
export function DataTable<T extends Record<string, any>>({
  columns,
  rows,
  empty = "Nessun dato nel periodo selezionato.",
  onRowClick,
}: {
  columns: { key: string; label: string; format?: string; align?: "left" | "right"; tooltip?: string }[];
  rows: T[];
  empty?: string;
  onRowClick?: (row: T) => void;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const sorted = [...rows].sort((a, b) => {
    if (!sort) return 0;
    const av = a[sort.key];
    const bv = b[sort.key];
    if (av === bv) return 0;
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    return (av > bv ? 1 : -1) * sort.dir;
  });

  if (!rows.length) return <p className={`text-sm ${SUBTLE}`}>{empty}</p>;

  return (
    <div className="-mx-4 overflow-x-auto md:mx-0">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`whitespace-nowrap px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${SUBTLE} ${
                  c.align === "right" ? "text-right" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    setSort((s) =>
                      s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: -1 },
                    )
                  }
                  className="inline-flex items-center gap-1 hover:text-white"
                >
                  {c.label}
                  {sort?.key === c.key && <span>{sort.dir === 1 ? "▲" : "▼"}</span>}
                </button>
                {c.tooltip && <Tooltip text={c.tooltip} />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr
              key={r.key ?? r.source ?? i}
              onClick={() => onRowClick?.(r)}
              className={`border-b border-white/5 last:border-0 ${
                onRowClick ? "cursor-pointer hover:bg-white/5" : ""
              }`}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`whitespace-nowrap px-3 py-2.5 tabular-nums ${
                    c.align === "right" ? "text-right" : "text-white"
                  } ${r[c.key] === null || r[c.key] === undefined ? SUBTLE : "text-white"}`}
                >
                  {r[c.key] === null || r[c.key] === undefined
                    ? "—"
                    : formatValue(r[c.key], c.format) === "—"
                    ? String(r[c.key])
                    : typeof r[c.key] === "number"
                    ? formatValue(r[c.key], c.format)
                    : String(r[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-[#F58220]" />
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <p className="text-sm text-red-300">{message}</p>
      <button
        onClick={onRetry}
        className="rounded-full border border-white/20 px-4 py-1.5 text-xs font-bold text-white hover:bg-white/10"
      >
        Riprova
      </button>
    </div>
  );
}
