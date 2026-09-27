import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CheckCircle2, Trophy, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/States";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import type { PerformancePoint } from "@/hooks/useAnalytics";
import { ChartEmpty, ChartTooltipBox, SectionCard } from "./ChartParts";
import { AXIS_TICK, CURSOR_FILL, GRID_STROKE, LOST_COLOR, SURFACE, WON_COLOR } from "./chartTheme";

interface WinLossCardProps {
  won: { count: number; value: number };
  lost: { count: number; value: number };
  /** Per-period won/lost counts for the diverging bars. */
  series?: PerformancePoint[];
  currency?: string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  title?: string;
  description?: React.ReactNode;
  className?: string;
}

/** Radial meter: the arc is the share of closed deals that were won; the track is the rest. */
function WinMeter({ rate }: { rate: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const filled = Math.min(Math.max(rate, 0), 1) * c;
  return (
    <div className="relative h-[132px] w-[132px] shrink-0">
      <svg viewBox="0 0 132 132" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="66" cy="66" r={r} fill="none" stroke={WON_COLOR} strokeOpacity={0.16} strokeWidth={12} />
        <circle
          cx="66"
          cy="66"
          r={r}
          fill="none"
          stroke={WON_COLOR}
          strokeWidth={12}
          strokeLinecap={rate > 0 && rate < 1 ? "round" : "butt"}
          strokeDasharray={`${filled} ${c}`}
          className="transition-[stroke-dasharray] duration-500 ease-out motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tracking-tight text-foreground">{formatPercent(rate)}</span>
        <span className="text-[11px] text-muted-foreground">win rate</span>
      </div>
    </div>
  );
}

/** Win rate at a glance plus won vs lost per period (won above the line, lost below). */
export function WinLossCard({
  won,
  lost,
  series,
  currency = "ETB",
  loading,
  error,
  onRetry,
  title = "Win / loss",
  description,
  className,
}: WinLossCardProps) {
  const closed = won.count + lost.count;
  const rate = closed ? won.count / closed : 0;
  const bars = (series ?? []).map((p) => ({ label: p.label, won: p.wonCount, lost: -p.lostCount, wonValue: p.wonValue, lostValue: p.lostValue, rate: p.winRate }));
  const hasBars = bars.some((b) => b.won || b.lost);
  // Symmetric scale so won (up) and lost (down) bars are comparable.
  const extent = Math.max(1, ...bars.map((b) => Math.max(b.won, -b.lost)));

  const table =
    !loading && !error && closed > 0
      ? {
          columns: ["Period", "Won", "Lost", "Win rate", "Won value"],
          rows: (series ?? []).map((p) => [p.label, p.wonCount, p.lostCount, p.winRate === null ? "—" : formatPercent(p.winRate), formatCurrency(p.wonValue, currency)]),
        }
      : null;

  return (
    <SectionCard title={title} description={description} table={table} className={className}>
      {loading ? (
        <div className="flex items-center gap-5">
          <Skeleton className="h-[132px] w-[132px] rounded-full" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      ) : error ? (
        <ErrorState compact error={error} onRetry={onRetry} title="Couldn't load win / loss" />
      ) : closed === 0 ? (
        <ChartEmpty
          icon={Trophy}
          title="No closed deals yet"
          description="Your win rate appears once deals move into a won or lost stage."
          height={200}
          variant="bars"
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <WinMeter rate={rate} />
            <dl className="grid w-full flex-1 grid-cols-2 gap-3 sm:grid-cols-1">
              <div className="rounded-lg border border-border px-3 py-2">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden /> Won
                </dt>
                <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                  <span className="text-lg font-semibold text-foreground">{won.count}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{formatCurrency(won.value, currency)}</span>
                </dd>
              </div>
              <div className="rounded-lg border border-border px-3 py-2">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <XCircle className="h-3.5 w-3.5 text-destructive" aria-hidden /> Lost
                </dt>
                <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                  <span className="text-lg font-semibold text-foreground">{lost.count}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{formatCurrency(lost.value, currency)}</span>
                </dd>
              </div>
            </dl>
          </div>
          {hasBars && (
            <div
              className="h-[120px] w-full"
              role="figure"
              aria-label={`Won and lost deals per period: ${bars.map((b) => `${b.label} ${b.won} won, ${-b.lost} lost`).join("; ")}`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bars} stackOffset="sign" margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%" accessibilityLayer>
                  <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                  <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={8} />
                  <YAxis
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                    domain={[-extent, extent]}
                    ticks={[-extent, 0, extent]}
                    tickFormatter={(v: number) => String(Math.abs(v))}
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.4} />
                  <Tooltip
                    cursor={CURSOR_FILL}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const b = payload[0].payload as (typeof bars)[number];
                      return (
                        <ChartTooltipBox
                          title={b.label}
                          rows={[
                            { label: "Won", value: `${b.won} · ${formatCurrency(b.wonValue, currency)}`, color: WON_COLOR, shape: "rect" },
                            { label: "Lost", value: `${-b.lost} · ${formatCurrency(b.lostValue, currency)}`, color: LOST_COLOR, shape: "rect" },
                          ]}
                          footer={b.rate === null ? "Nothing closed" : `${formatPercent(b.rate)} win rate`}
                        />
                      );
                    }}
                  />
                  <Bar dataKey="won" name="Won" stackId="wl" fill={WON_COLOR} radius={[4, 4, 0, 0]} maxBarSize={24} stroke={SURFACE} strokeWidth={1} />
                  <Bar dataKey="lost" name="Lost" stackId="wl" fill={LOST_COLOR} fillOpacity={0.85} radius={[0, 0, 4, 4]} maxBarSize={24} stroke={SURFACE} strokeWidth={1} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}
