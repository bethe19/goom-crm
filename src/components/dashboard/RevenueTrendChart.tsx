import { useId } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/States";
import { formatCompactCurrency, formatCurrency } from "@/lib/formatters";
import { periodDelta } from "@/hooks/useAnalytics";
import { ChartEmpty, ChartLegend, ChartTooltipBox, DeltaChip, SectionCard } from "./ChartParts";
import { ACCENT, AXIS_TICK, CROSSHAIR, GRID_STROKE, MUTED_SERIES, SURFACE } from "./chartTheme";

export interface TrendPoint {
  key: string;
  label: string;
  value: number;
  count?: number;
  /** Same position in the previous period (null/undefined = no comparison). */
  prev?: number | null;
  prevLabel?: string;
}

interface RevenueTrendChartProps {
  points: TrendPoint[];
  currency?: string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  title?: string;
  description?: React.ReactNode;
  /** Series name, e.g. "Won revenue". */
  valueLabel?: string;
  /** Unit for `count`, e.g. ["deal won", "deals won"]. */
  countNoun?: [string, string];
  /** Name of the comparison series, e.g. "Previous 6 months". */
  previousLabel?: string;
  /** Phrase after the headline delta, e.g. "vs previous 6 months". */
  comparisonPhrase?: string;
  action?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: React.ReactNode;
  emptyAction?: React.ReactNode;
  height?: number;
  className?: string;
}

/** Won revenue over time: gradient area for this period, a quiet line for the previous one. */
export function RevenueTrendChart({
  points,
  currency = "USD",
  loading,
  error,
  onRetry,
  title = "Won revenue",
  description,
  valueLabel = "Won revenue",
  countNoun = ["deal won", "deals won"],
  previousLabel = "Previous period",
  comparisonPhrase = "vs previous period",
  action,
  emptyTitle = "Your trend appears after your first won deal",
  emptyDescription = "Move a deal into a won stage and revenue starts plotting here, month by month.",
  emptyAction,
  height = 240,
  className,
}: RevenueTrendChartProps) {
  const gradientId = `rev-grad-${useId().replace(/:/g, "")}`;
  const total = points.reduce((s, p) => s + p.value, 0);
  const count = points.reduce((s, p) => s + (p.count ?? 0), 0);
  const hasPrev = points.some((p) => p.prev !== undefined && p.prev !== null);
  const prevTotal = points.reduce((s, p) => s + (p.prev ?? 0), 0);
  const hasData = total > 0 || count > 0;
  const hasAnything = hasData || prevTotal > 0;
  const delta = hasPrev ? periodDelta(total, prevTotal) : null;
  const peak = points.reduce<TrendPoint | null>((best, p) => (p.value > (best?.value ?? 0) ? p : best), null);

  const headline =
    !loading && !error && hasAnything ? (
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-2xl font-semibold tracking-tight text-foreground">{formatCurrency(total, currency)}</span>
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {delta && delta.pct !== null ? (
            <>
              <DeltaChip value={delta.pct} />
              <span>{comparisonPhrase}</span>
            </>
          ) : hasPrev && total > 0 ? (
            <span>Nothing won in the previous period</span>
          ) : null}
          {count > 0 && (
            <span>
              · {count} {count === 1 ? countNoun[0] : countNoun[1]}
            </span>
          )}
        </span>
      </div>
    ) : undefined;

  const table =
    !loading && !error && hasAnything
      ? {
          columns: ["Period", valueLabel, "Deals", ...(hasPrev ? [previousLabel] : [])],
          rows: points.map((p) => [
            p.label,
            formatCurrency(p.value, currency),
            p.count ?? 0,
            ...(hasPrev ? [p.prev === null || p.prev === undefined ? "—" : formatCurrency(p.prev, currency)] : []),
          ]),
        }
      : null;

  return (
    <SectionCard title={title} description={description} action={action} headline={headline} table={table} className={className}>
      {loading ? (
        <Skeleton className="w-full rounded-lg" style={{ height }} />
      ) : error ? (
        <ErrorState compact error={error} onRetry={onRetry} title="Couldn't load revenue" />
      ) : !hasAnything ? (
        <ChartEmpty icon={TrendingUp} title={emptyTitle} description={emptyDescription} action={emptyAction} height={height} />
      ) : (
        <>
          <div
            className="w-full"
            style={{ height }}
            role="figure"
            aria-label={`${valueLabel} by period: ${points.map((p) => `${p.label} ${formatCurrency(p.value, currency)}`).join(", ")}${peak ? `. Best: ${peak.label}.` : ""}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={12} />
                <YAxis
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                  allowDecimals={false}
                  tickFormatter={(v: number) => formatCompactCurrency(v, currency)}
                />
                <Tooltip
                  cursor={CROSSHAIR}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as TrendPoint;
                    const d = p.prev !== undefined && p.prev !== null ? periodDelta(p.value, p.prev) : null;
                    return (
                      <ChartTooltipBox
                        title={p.label}
                        rows={[
                          { label: valueLabel, value: formatCurrency(p.value, currency), color: ACCENT, shape: "rect" },
                          ...(p.prev !== undefined && p.prev !== null
                            ? [{ label: p.prevLabel ?? previousLabel, value: formatCurrency(p.prev, currency), color: MUTED_SERIES, muted: true }]
                            : []),
                        ]}
                        footer={
                          <>
                            {p.count ?? 0} {(p.count ?? 0) === 1 ? countNoun[0] : countNoun[1]}
                            {d && d.pct !== null ? ` · ${d.pct >= 0 ? "+" : "−"}${Math.round(Math.abs(d.pct) * 100)}% vs ${p.prevLabel ?? "previous"}` : ""}
                          </>
                        }
                      />
                    );
                  }}
                />
                {hasPrev && (
                  <Line
                    type="monotone"
                    dataKey="prev"
                    name={previousLabel}
                    stroke={MUTED_SERIES}
                    strokeOpacity={0.55}
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 3, fill: MUTED_SERIES, stroke: SURFACE, strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="value"
                  name={valueLabel}
                  stroke={ACCENT}
                  strokeWidth={2}
                  fill={`url(#${gradientId})`}
                  dot={false}
                  activeDot={{ r: 4.5, fill: ACCENT, stroke: SURFACE, strokeWidth: 2 }}
                  animationDuration={400}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {hasPrev && (
            <ChartLegend
              className="mt-3"
              items={[
                { label: valueLabel, color: ACCENT, shape: "rect" },
                { label: previousLabel, color: MUTED_SERIES, shape: "line" },
              ]}
            />
          )}
        </>
      )}
    </SectionCard>
  );
}
