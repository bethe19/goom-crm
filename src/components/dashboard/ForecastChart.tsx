import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompactCurrency, formatCurrency, formatPercent } from "@/lib/formatters";
import { BEST_CASE_THRESHOLD, COMMIT_THRESHOLD, type ForecastMonth } from "@/hooks/useAnalytics";
import { ChartLegend, ChartTooltipBox } from "./ChartParts";
import { ACCENT, AXIS_TICK, CURSOR_FILL, GRID_STROKE, INK, SURFACE, WON_COLOR } from "./chartTheme";

/**
 * Forecast categories are ORDINAL (more → less certain), so they share one hue stepped by
 * lightness; revenue already won wears the status "good" color underneath.
 */
const FORECAST_SERIES = [
  { key: "won", label: "Won", color: WON_COLOR, opacity: 1, description: "Already won this month" },
  { key: "commit", label: "Commit", color: ACCENT, opacity: 1, description: `${COMMIT_THRESHOLD}%+ probability` },
  { key: "bestCase", label: "Best case", color: ACCENT, opacity: 0.55, description: `${BEST_CASE_THRESHOLD}–${COMMIT_THRESHOLD - 1}% probability` },
  { key: "pipeline", label: "Pipeline", color: ACCENT, opacity: 0.25, description: `Under ${BEST_CASE_THRESHOLD}% or no probability` },
] as const;

type Datum = ForecastMonth & { expected: number };

export function ForecastChart({
  months,
  quota,
  currency = "ETB",
  onSelectMonth,
  height = 280,
}: {
  months: ForecastMonth[];
  quota: number;
  currency?: string;
  onSelectMonth?: (key: string) => void;
  height?: number;
}) {
  const data: Datum[] = months.map((m) => ({ ...m, expected: m.won + m.weighted }));
  const hasWon = data.some((d) => d.won > 0);
  const series = FORECAST_SERIES.filter((s) => s.key !== "won" || hasWon);
  const maxStack = Math.max(0, ...data.map((d) => d.won + d.total));
  const yMax = Math.max(maxStack, quota > 0 ? quota * 1.08 : 0);

  return (
    <div>
      <div
        className="w-full"
        style={{ height }}
        role="figure"
        aria-label={`Forecast by close month: ${data
          .map((d) => `${d.label}: ${hasWon ? `won ${formatCurrency(d.won, currency)}, ` : ""}commit ${formatCurrency(d.commit, currency)}, best case ${formatCurrency(d.bestCase, currency)}, pipeline ${formatCurrency(d.pipeline, currency)}, expected ${formatCurrency(d.expected, currency)}`)
          .join("; ")}${quota > 0 ? `. Monthly quota ${formatCurrency(quota, currency)}.` : ""}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 16, right: 8, left: 0, bottom: 0 }}
            barCategoryGap="30%"
            accessibilityLayer
            onClick={(e) => {
              const key = (e?.activePayload?.[0]?.payload as Datum | undefined)?.key;
              if (key && onSelectMonth) onSelectMonth(key);
            }}
          >
            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={60}
              domain={[0, yMax || "auto"]}
              tickFormatter={(v: number) => formatCompactCurrency(v, currency)}
            />
            <Tooltip
              cursor={CURSOR_FILL}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const m = payload[0].payload as Datum;
                return (
                  <ChartTooltipBox
                    title={m.label}
                    rows={[
                      { label: "Expected (won + weighted)", value: formatCurrency(m.expected, currency), color: INK },
                      ...[...series].reverse().map((s) => ({
                        label: s.label,
                        value: formatCurrency(m[s.key], currency),
                        color: s.opacity < 1 ? `color-mix(in srgb, ${s.color} ${Math.round(s.opacity * 100)}%, transparent)` : s.color,
                        shape: "rect" as const,
                        muted: m[s.key] === 0,
                      })),
                      ...(quota > 0 ? [{ label: "Of quota (expected)", value: formatPercent(m.expected / quota) }] : []),
                    ]}
                    footer={`${m.deals.length} open ${m.deals.length === 1 ? "deal" : "deals"}${onSelectMonth ? " · click to list them" : ""}`}
                  />
                );
              }}
            />
            {quota > 0 && (
              <ReferenceLine
                y={quota}
                stroke="hsl(var(--muted-foreground))"
                strokeOpacity={0.7}
                ifOverflow="extendDomain"
                label={{ value: `Quota ${formatCompactCurrency(quota, currency)}`, position: "insideTopLeft", fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
            )}
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId="forecast"
                fill={s.color}
                fillOpacity={s.opacity}
                stroke={SURFACE}
                strokeWidth={2}
                maxBarSize={40}
                radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
                className={onSelectMonth ? "cursor-pointer" : undefined}
              />
            ))}
            <Line
              type="monotone"
              dataKey="expected"
              name="Expected"
              stroke={INK}
              strokeWidth={2}
              dot={{ r: 4, fill: INK, stroke: SURFACE, strokeWidth: 2 }}
              activeDot={{ r: 5, fill: INK, stroke: SURFACE, strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend
        className="mt-3"
        items={[
          ...series.map((s) => ({
            label: s.label,
            color: s.opacity < 1 ? `color-mix(in srgb, ${s.color} ${Math.round(s.opacity * 100)}%, transparent)` : s.color,
          })),
          { label: "Expected (won + weighted)", color: INK, shape: "line" as const },
          ...(quota > 0 ? [{ label: "Monthly quota", color: "hsl(var(--muted-foreground))", shape: "line" as const }] : []),
        ]}
      />
    </div>
  );
}
