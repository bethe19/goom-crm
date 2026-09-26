import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowUpRight, CalendarRange, CalendarX2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/States";
import { formatCompactCurrency, formatCurrency } from "@/lib/formatters";
import type { ForecastMonth } from "@/hooks/useAnalytics";
import { ChartEmpty, ChartTooltipBox, SectionCard } from "./ChartParts";
import { ACCENT, AXIS_TICK, CURSOR_FILL, GRID_STROKE } from "./chartTheme";

interface CloseMonthChartProps {
  months: ForecastMonth[];
  overdue: { count: number; value: number };
  noDateCount: number;
  currency?: string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Link to the full forecast (omit when the plan doesn't include it). */
  forecastHref?: string;
  className?: string;
}

/** Open deals by expected close month, with overdue and undated deals called out. */
export function CloseMonthChart({ months, overdue, noDateCount, currency = "USD", loading, error, onRetry, forecastHref, className }: CloseMonthChartProps) {
  const data = months.map((m) => ({ key: m.key, label: m.label, value: m.total, count: m.deals.length, weighted: m.weighted }));
  const total = data.reduce((s, d) => s + d.value, 0);
  const count = data.reduce((s, d) => s + d.count, 0);

  return (
    <SectionCard
      title="Deals by close month"
      description={`Open deals expected to close in the next ${months.length || 6} months`}
      className={className}
      action={
        forecastHref ? (
          <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground">
            <Link to={forecastHref}>
              Forecast <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </Button>
        ) : undefined
      }
      table={
        !loading && !error && count > 0
          ? {
              columns: ["Month", "Deals", "Value", "Weighted"],
              rows: data.map((d) => [d.label, d.count, formatCurrency(d.value, currency), formatCurrency(d.weighted, currency)]),
            }
          : null
      }
      headline={
        !loading && !error && count > 0 ? (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-2xl font-semibold tracking-tight text-foreground">{formatCurrency(total, currency)}</span>
            <span className="text-xs text-muted-foreground">
              {count} {count === 1 ? "deal" : "deals"} with a close date ahead
            </span>
          </div>
        ) : undefined
      }
    >
      {loading ? (
        <Skeleton className="h-[200px] w-full rounded-lg" />
      ) : error ? (
        <ErrorState compact error={error} onRetry={onRetry} title="Couldn't load close dates" />
      ) : (
        <>
          {(overdue.count > 0 || noDateCount > 0) && (
            <div className="mb-3 flex flex-wrap gap-2">
              {overdue.count > 0 && (
                <Link
                  to={forecastHref ?? "/pipeline"}
                  className="inline-flex items-center gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-2 py-1 text-xs text-foreground transition-colors hover:bg-warning/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-hidden />
                  {overdue.count} past close date · {formatCurrency(overdue.value, currency)}
                </Link>
              )}
              {noDateCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                  <CalendarX2 className="h-3.5 w-3.5" aria-hidden />
                  {noDateCount} without a close date
                </span>
              )}
            </div>
          )}
          {count === 0 ? (
            <ChartEmpty
              icon={CalendarRange}
              title="No upcoming close dates"
              description="Set expected close dates on open deals to see what lands each month."
              height={190}
              variant="bars"
            />
          ) : (
            <div
              className="h-[200px] w-full"
              role="figure"
              aria-label={`Open deal value by close month: ${data.map((d) => `${d.label} ${formatCurrency(d.value, currency)} (${d.count})`).join(", ")}`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 18, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%" accessibilityLayer>
                  <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                  <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={56} tickFormatter={(v: number) => formatCompactCurrency(v, currency)} />
                  <Tooltip
                    cursor={CURSOR_FILL}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as (typeof data)[number];
                      return (
                        <ChartTooltipBox
                          title={d.label}
                          rows={[
                            { label: "Open value", value: formatCurrency(d.value, currency), color: ACCENT, shape: "rect" },
                            { label: "Weighted", value: formatCurrency(d.weighted, currency) },
                          ]}
                          footer={`${d.count} ${d.count === 1 ? "deal" : "deals"}`}
                        />
                      );
                    }}
                  />
                  <Bar dataKey="value" name="Open value" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={24}>
                    <LabelList
                      dataKey="value"
                      position="top"
                      className="fill-muted-foreground text-[11px]"
                      formatter={(v: number) => (v > 0 ? formatCompactCurrency(v, currency) : "")}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}
