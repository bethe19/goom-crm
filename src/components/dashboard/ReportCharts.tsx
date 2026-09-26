import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LucideIcon } from "lucide-react";
import { Activity as ActivityIcon, Percent } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ErrorState } from "@/components/common/States";
import { formatNumber, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { ActivityMixPoint, PerformancePoint } from "@/hooks/useAnalytics";
import { ChartEmpty, ChartLegend, ChartTooltipBox, SectionCard, type ChartTableData, type ChartTooltipRow } from "./ChartParts";
import { ACCENT, ACTIVITY_SERIES, AXIS_TICK, CROSSHAIR, CURSOR_FILL, GRID_STROKE, MUTED_SERIES, SURFACE } from "./chartTheme";

interface CardState {
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------------------------
// Win rate trend (line)
// ---------------------------------------------------------------------------------------------

export function WinRateTrendChart({
  points,
  overall,
  loading,
  error,
  onRetry,
  className,
  description,
}: CardState & { points: PerformancePoint[]; overall: number | null; description?: React.ReactNode }) {
  const data = points.map((p) => ({ label: p.label, rate: p.winRate === null ? null : Math.round(p.winRate * 1000) / 10, won: p.wonCount, lost: p.lostCount }));
  const closed = points.reduce((s, p) => s + p.wonCount + p.lostCount, 0);
  const best = points.reduce<PerformancePoint | null>((b, p) => (p.winRate !== null && (b === null || (b.winRate ?? -1) < p.winRate) ? p : b), null);
  return (
    <SectionCard
      title="Win rate trend"
      description={description ?? "Won ÷ (won + lost) for deals closed in each period"}
      className={className}
      table={
        closed > 0
          ? { columns: ["Period", "Win rate", "Won", "Lost"], rows: points.map((p) => [p.label, p.winRate === null ? "—" : formatPercent(p.winRate), p.wonCount, p.lostCount]) }
          : null
      }
      headline={
        !loading && !error && overall !== null ? (
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-2xl font-semibold tracking-tight text-foreground">{formatPercent(overall)}</span>
            <span className="text-xs text-muted-foreground">
              over the period{best && best.winRate !== null ? ` · best: ${best.label} (${formatPercent(best.winRate)})` : ""}
            </span>
          </div>
        ) : undefined
      }
    >
      {loading ? (
        <Skeleton className="h-[220px] w-full rounded-lg" />
      ) : error ? (
        <ErrorState compact error={error} onRetry={onRetry} title="Couldn't load win rate" />
      ) : closed === 0 ? (
        <ChartEmpty icon={Percent} title="No closed deals in this period" description="The trend appears once deals are won or lost." />
      ) : (
        <div className="h-[220px] w-full" role="figure" aria-label={`Win rate by period: ${data.map((d) => `${d.label} ${d.rate === null ? "nothing closed" : `${d.rate}%`}`).join(", ")}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }} accessibilityLayer>
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={12} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v: number) => `${v}%`} />
              {overall !== null && (
                <ReferenceLine
                  y={Math.round(overall * 1000) / 10}
                  stroke={MUTED_SERIES}
                  strokeOpacity={0.6}
                  label={{ value: `Period ${formatPercent(overall)}`, position: "insideTopRight", fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
              )}
              <Tooltip
                cursor={CROSSHAIR}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as (typeof data)[number];
                  return (
                    <ChartTooltipBox
                      title={d.label}
                      rows={[{ label: "Win rate", value: d.rate === null ? "Nothing closed" : `${d.rate}%`, color: ACCENT }]}
                      footer={`${d.won} won · ${d.lost} lost`}
                    />
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="rate"
                name="Win rate"
                stroke={ACCENT}
                strokeWidth={2}
                connectNulls
                dot={{ r: 3.5, fill: ACCENT, stroke: SURFACE, strokeWidth: 2 }}
                activeDot={{ r: 5, fill: ACCENT, stroke: SURFACE, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------------------------
// Histogram (deal size, sales cycle)
// ---------------------------------------------------------------------------------------------

export interface HistogramDatum {
  label: string;
  count: number;
  tooltip?: ChartTooltipRow[];
}

export function HistogramCard({
  title,
  description,
  data,
  headline,
  action,
  table,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  countNoun = ["deal", "deals"],
  loading,
  error,
  onRetry,
  className,
}: CardState & {
  title: string;
  description?: React.ReactNode;
  data: HistogramDatum[];
  headline?: React.ReactNode;
  action?: React.ReactNode;
  table?: ChartTableData | null;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyDescription?: string;
  countNoun?: [string, string];
}) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const peak = data.reduce<HistogramDatum | null>((b, d) => (d.count > (b?.count ?? 0) ? d : b), null);
  return (
    <SectionCard title={title} description={description} action={action} className={className} table={total > 0 ? table : null} headline={!loading && !error && total > 0 ? headline : undefined}>
      {loading ? (
        <Skeleton className="h-[220px] w-full rounded-lg" />
      ) : error ? (
        <ErrorState compact error={error} onRetry={onRetry} />
      ) : total === 0 ? (
        <ChartEmpty icon={emptyIcon} title={emptyTitle} description={emptyDescription} variant="bars" />
      ) : (
        <div
          className="h-[220px] w-full"
          role="figure"
          aria-label={`${title}: ${data.map((d) => `${d.label} ${d.count}`).join(", ")}${peak ? `. Most common: ${peak.label}.` : ""}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 16, right: 4, left: 0, bottom: 0 }} barCategoryGap={2} accessibilityLayer>
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} angle={data.length > 6 ? -25 : 0} textAnchor={data.length > 6 ? "end" : "middle"} height={data.length > 6 ? 44 : 30} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
              <Tooltip
                cursor={CURSOR_FILL}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as HistogramDatum;
                  return (
                    <ChartTooltipBox
                      title={d.label}
                      rows={[{ label: d.count === 1 ? countNoun[0] : countNoun[1], value: formatNumber(d.count), color: ACCENT, shape: "rect" }, ...(d.tooltip ?? [])]}
                      footer={`${formatPercent(d.count / total)} of ${formatNumber(total)}`}
                    />
                  );
                }}
              />
              <Bar dataKey="count" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------------------------
// Horizontal bar list (lost reasons, time in stage)
// ---------------------------------------------------------------------------------------------

export interface BarListRow {
  key: string;
  label: string;
  value: number;
  display: string;
  sub?: string;
  color?: string;
  tooltip?: ChartTooltipRow[];
}

export function BarList({ rows, color = ACCENT, ariaLabel }: { rows: BarListRow[]; color?: string; ariaLabel: string }) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-1" aria-label={ariaLabel}>
      {rows.map((r) => {
        const pct = max > 0 ? Math.max((r.value / max) * 100, r.value > 0 ? 2 : 0) : 0;
        const c = r.color ?? color;
        return (
          <li key={r.key}>
            <UiTooltip>
              <TooltipTrigger asChild>
                <div
                  tabIndex={0}
                  className="group rounded-md px-1 py-1.5 outline-none transition-colors duration-150 hover:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`${r.label}: ${r.display}${r.sub ? `, ${r.sub}` : ""}`}
                >
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      {r.color && <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: r.color }} />}
                      <span className="truncate text-foreground">{r.label}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      <span className="font-medium text-foreground">{r.display}</span>
                      {r.sub ? ` · ${r.sub}` : ""}
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-secondary" aria-hidden>
                    <div
                      className="h-full rounded-full transition-[width] duration-300 ease-out group-hover:brightness-110 motion-reduce:transition-none"
                      style={{ width: `${pct}%`, backgroundColor: c }}
                    />
                  </div>
                </div>
              </TooltipTrigger>
              {r.tooltip && (
                <TooltipContent side="top" className="border-0 bg-transparent p-0 shadow-none">
                  <ChartTooltipBox title={r.label} rows={r.tooltip} />
                </TooltipContent>
              )}
            </UiTooltip>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------------------------
// Activity mix (stacked bars by type)
// ---------------------------------------------------------------------------------------------

export function ActivityMixChart({
  points,
  description,
  loading,
  error,
  onRetry,
  className,
}: CardState & { points: ActivityMixPoint[]; description?: React.ReactNode }) {
  const totals = ACTIVITY_SERIES.map((s) => ({ ...s, total: points.reduce((sum, p) => sum + p[s.key], 0) }));
  const total = totals.reduce((s, t) => s + t.total, 0);
  // Only series that have data are drawn; the top-most drawn series carries the rounded cap.
  const drawn = totals.filter((t) => t.total > 0);
  return (
    <SectionCard
      title="Activity mix"
      description={description}
      className={className}
      table={
        total > 0
          ? { columns: ["Period", ...ACTIVITY_SERIES.map((s) => s.label), "Total"], rows: points.map((p) => [p.label, ...ACTIVITY_SERIES.map((s) => p[s.key]), p.total]) }
          : null
      }
      headline={
        !loading && !error && total > 0 ? (
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-2xl font-semibold tracking-tight text-foreground">{formatNumber(total)}</span>
            <span className="text-xs text-muted-foreground">{total === 1 ? "activity" : "activities"} logged</span>
          </div>
        ) : undefined
      }
    >
      {loading ? (
        <Skeleton className="h-[240px] w-full rounded-lg" />
      ) : error ? (
        <ErrorState compact error={error} onRetry={onRetry} title="Couldn't load activities" />
      ) : total === 0 ? (
        <ChartEmpty icon={ActivityIcon} title="No activities in this period" description="Calls, emails, meetings and notes you log appear here, week by week." variant="bars" />
      ) : (
        <>
          <div
            className="h-[220px] w-full"
            role="figure"
            aria-label={`Activities per period by type: ${points.map((p) => `${p.label}: ${ACTIVITY_SERIES.map((s) => `${p[s.key]} ${s.label.toLowerCase()}`).join(", ")}`).join("; ")}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={points} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="24%" accessibilityLayer>
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={12} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                <Tooltip
                  cursor={CURSOR_FILL}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as ActivityMixPoint;
                    return (
                      <ChartTooltipBox
                        title={p.label}
                        rows={[...ACTIVITY_SERIES].reverse().map((s) => ({ label: s.label, value: formatNumber(p[s.key]), color: s.color, shape: "rect" as const, muted: p[s.key] === 0 }))}
                        footer={`${formatNumber(p.total)} total`}
                      />
                    );
                  }}
                />
                {drawn.map((s, i) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    stackId="mix"
                    fill={s.color}
                    stroke={SURFACE}
                    strokeWidth={2}
                    maxBarSize={24}
                    radius={i === drawn.length - 1 ? [4, 4, 0, 0] : 0}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ChartLegend className="mt-3" items={totals.map((t) => ({ label: t.label, color: t.color, value: formatNumber(t.total) }))} />
        </>
      )}
    </SectionCard>
  );
}

/** Blurred, number-free preview of locked report sections (sits behind an upgrade prompt). */
export function LockedPreview({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl", className)}>
      <div aria-hidden className="pointer-events-none grid select-none gap-6 opacity-60 blur-[2px] lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5">
            <div className="h-3 w-32 rounded bg-secondary" />
            <div className="mt-2 h-2.5 w-48 rounded bg-secondary/70" />
            <div className="mt-6 flex h-[150px] items-end gap-2">
              {[40, 65, 50, 80, 60, 90, 70].map((h, j) => (
                <div key={j} className="flex-1 rounded-t-[4px] bg-muted" style={{ height: `${((h + i * 7 + j * 3) % 90) + 10}%` }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-background/40 via-background/75 to-background/40 p-4">
        <div className="w-full max-w-lg">{children}</div>
      </div>
    </div>
  );
}
