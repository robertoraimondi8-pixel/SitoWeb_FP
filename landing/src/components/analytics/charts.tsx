// Charts built with inline SVG: no external chart library, no CDN, so the
// dashboard stays fast and the site bundle does not grow for public visitors.

import { useMemo, useState } from "react";
import type { Annotation, FunnelStep, SeriesPoint } from "@/lib/analyticsApi";
import { formatValue } from "@/lib/analyticsApi";
import { SUBTLE, Unavailable } from "./ui";

export const METRICS: { key: keyof SeriesPoint; label: string; color: string; format?: string }[] = [
  { key: "visitors", label: "Visitatori", color: "#4C8DFF" },
  { key: "clickers", label: "Click store", color: "#F58220" },
  { key: "registrations", label: "Registrazioni", color: "#34D399" },
  { key: "league_joins", label: "Ingressi lega", color: "#A78BFA" },
  { key: "first_predictions", label: "Pronostici", color: "#FBBF24" },
  { key: "purchases", label: "Acquisti", color: "#F472B6" },
  { key: "revenue", label: "Ricavi", color: "#22D3EE", format: "eur" },
];

/** Multi-metric daily/cumulative line chart with launch annotations. */
export function TimeSeriesChart({
  series,
  annotations,
  selected,
  cumulative,
}: {
  series: SeriesPoint[];
  annotations: Annotation[];
  selected: string[];
  cumulative: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 900;
  const H = 260;
  const PAD = { l: 44, r: 12, t: 12, b: 26 };

  const data = useMemo(() => {
    if (!cumulative) return series;
    const running: Record<string, number> = {};
    return series.map((p) => {
      const out: any = { day: p.day };
      METRICS.forEach(({ key }) => {
        running[key] = (running[key] || 0) + (Number(p[key]) || 0);
        out[key] = running[key];
      });
      return out as SeriesPoint;
    });
  }, [series, cumulative]);

  const active = METRICS.filter((m) => selected.includes(m.key as string));
  const max = Math.max(
    1,
    ...data.flatMap((p) => active.map((m) => Number(p[m.key]) || 0)),
  );

  if (!series.length) return <p className={`text-sm ${SUBTLE}`}>Nessun dato nel periodo.</p>;

  const x = (i: number) =>
    PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(1, data.length - 1);
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px]" role="img">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line
              x1={PAD.l} x2={W - PAD.r}
              y1={y(max * f)} y2={y(max * f)}
              stroke="rgba(255,255,255,0.08)" strokeWidth="1"
            />
            <text x={PAD.l - 6} y={y(max * f) + 3} textAnchor="end" fontSize="9" fill="#6f82ad">
              {Math.round(max * f)}
            </text>
          </g>
        ))}

        {annotations.map((a) => {
          const i = data.findIndex((p) => p.day === a.day);
          if (i < 0) return null;
          return (
            <g key={a.id}>
              <line x1={x(i)} x2={x(i)} y1={PAD.t} y2={H - PAD.b}
                    stroke="#F58220" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
              <circle cx={x(i)} cy={PAD.t} r="3" fill="#F58220">
                <title>{a.label}</title>
              </circle>
            </g>
          );
        })}

        {active.map((m) => {
          const pts = data.map((p, i) => `${x(i)},${y(Number(p[m.key]) || 0)}`).join(" ");
          return <polyline key={m.key} points={pts} fill="none" stroke={m.color} strokeWidth="2"
                           strokeLinejoin="round" strokeLinecap="round" />;
        })}

        {data.map((p, i) => (
          <rect key={p.day} x={x(i) - 6} y={PAD.t} width="12" height={H - PAD.t - PAD.b}
                fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}

        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b}
                stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
        )}

        {data.map((p, i) =>
          i % Math.ceil(data.length / 8) === 0 ? (
            <text key={p.day} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="#6f82ad">
              {p.day.slice(5)}
            </text>
          ) : null,
        )}
      </svg>

      {hover !== null && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 rounded-xl border border-white/10 bg-[#08122b] px-3 py-2 text-xs">
          <span className="font-bold text-white">{data[hover].day}</span>
          {active.map((m) => (
            <span key={m.key} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: m.color }} />
              <span className={SUBTLE}>{m.label}</span>
              <span className="font-semibold text-white tabular-nums">
                {formatValue(Number(data[hover][m.key]) || 0, m.format)}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Horizontal funnel. Steps without data are shown as blocked, never as zero. */
export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  const base = steps.find((s) => s.users !== null)?.users || 1;
  return (
    <div className="flex flex-col gap-2">
      {steps.map((s) => {
        const width = s.users !== null ? Math.max((s.users / base) * 100, 1.5) : 0;
        return (
          <div key={s.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-white">{s.label}</span>
              {s.users !== null ? (
                <span className="font-display font-bold text-lg tabular-nums text-white">
                  {formatValue(s.users)}
                  <span className={`ml-1 text-[11px] font-semibold ${SUBTLE}`}>persone</span>
                </span>
              ) : (
                <Unavailable reason={s.missing} />
              )}
            </div>

            {s.users !== null && (
              <>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#F58220] to-[#ffa457]"
                       style={{ width: `${width}%` }} />
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px]">
                  {s.from_previous !== null && (
                    <span className={SUBTLE}>
                      Da step precedente:{" "}
                      <span className="font-bold text-emerald-400">{s.from_previous}%</span>
                    </span>
                  )}
                  {s.from_start !== null && (
                    <span className={SUBTLE}>
                      Dall'inizio: <span className="font-bold text-white">{s.from_start}%</span>
                    </span>
                  )}
                  {s.lost !== null && s.lost > 0 && (
                    <span className={SUBTLE}>
                      Persi: <span className="font-bold text-red-400">{formatValue(s.lost)}</span>
                      {s.drop_rate !== null && s.drop_rate !== undefined && ` (${s.drop_rate}%)`}
                    </span>
                  )}
                </div>
              </>
            )}
            {s.note && <p className="mt-1.5 text-[10px] text-[#6f82ad]">{s.note}</p>}
          </div>
        );
      })}
    </div>
  );
}

/** Weekly retention cohorts: rows = acquisition week, columns = weeks after. */
export function CohortTable({
  cohorts,
}: {
  cohorts: { cohort: string; size: number; weeks: Record<string, number> }[];
}) {
  if (!cohorts.length)
    return <p className={`text-sm ${SUBTLE}`}>Nessuna coorte nel periodo selezionato.</p>;
  const maxWeek = Math.max(
    0,
    ...cohorts.flatMap((c) => Object.keys(c.weeks).map((k) => Number(k))),
  );
  const cols = Array.from({ length: Math.min(maxWeek + 1, 9) }, (_, i) => i);

  return (
    <div className="-mx-4 overflow-x-auto md:mx-0">
      <table className="w-full min-w-[520px] text-xs">
        <thead>
          <tr className={`border-b border-white/10 text-left ${SUBTLE}`}>
            <th className="px-3 py-2 font-bold uppercase tracking-wider">Coorte</th>
            <th className="px-3 py-2 text-right font-bold uppercase tracking-wider">Utenti</th>
            {cols.map((w) => (
              <th key={w} className="px-3 py-2 text-right font-bold">S{w}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => (
            <tr key={c.cohort} className="border-b border-white/5 last:border-0">
              <td className="px-3 py-2 font-semibold text-white">{c.cohort}</td>
              <td className="px-3 py-2 text-right tabular-nums text-white">{c.size}</td>
              {cols.map((w) => {
                const v = c.weeks[String(w)];
                const pct = v && c.size ? Math.round((v / c.size) * 100) : null;
                return (
                  <td key={w} className="px-3 py-2 text-right tabular-nums">
                    {pct === null ? (
                      <span className={SUBTLE}>—</span>
                    ) : (
                      <span
                        className="inline-block rounded px-1.5 py-0.5 font-semibold text-white"
                        style={{ background: `rgba(52,211,153,${Math.min(pct / 100, 1) * 0.55 + 0.08})` }}
                      >
                        {pct}%
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
