import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  FORECAST_MONTHLY_QUOTA,
  forecastSeries,
  formatCompactMoney,
  formatMoney,
  relativeDays,
  stageById,
  type ForecastHorizon,
  type TourDeal,
} from "./data";
import { useDemoScript } from "./hooks";
import { CHART, Card, ChartTooltipBox, Kpi, PlanChip, SceneHeader, Segmented } from "./ui";

const HORIZONS: { value: "3" | "6"; label: string }[] = [
  { value: "3", label: "Next 3 months" },
  { value: "6", label: "Next 6 months" },
];

export function ForecastScene({ deals, demo, animate }: { deals: TourDeal[]; demo: boolean; animate: boolean }) {
  const [horizon, setHorizon] = useState<ForecastHorizon>(3);
  const [showBest, setShowBest] = useState(true);
  useDemoScript(demo, [
    [1800, () => setHorizon(6)],
    [2000, () => setShowBest(false)],
    [1600, () => setShowBest(true)],
  ]);

  const data = useMemo(() => forecastSeries(horizon), [horizon]);
  const quota = FORECAST_MONTHLY_QUOTA * data.length;
  const commit = data.reduce((s, d) => s + d.commit, 0);
  const best = commit + data.reduce((s, d) => s + d.bestCase, 0);
  const pipeline = best + data.reduce((s, d) => s + d.pipeline, 0);
  const closing = deals
    .filter((d) => d.stage !== "won" && d.closeInDays >= 0)
    .sort((a, b) => a.closeInDays - b.closeInDays)
    .slice(0, 4);

  return (
    <div className="flex h-full flex-col">
      <SceneHeader title="Forecast" subtitle="Open deals by expected close month, grouped by probability">
        <PlanChip feature="forecast" className="hidden sm:inline-flex" />
      </SceneHeader>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented<"3" | "6">
            label="Forecast horizon"
            value={String(horizon) as "3" | "6"}
            onChange={(v) => setHorizon(Number(v) as ForecastHorizon)}
            options={HORIZONS}
          />
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showBest}
              onChange={(e) => setShowBest(e.target.checked)}
              className="h-3.5 w-3.5 accent-foreground"
            />
            Show best case
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Kpi label="Commit" value={formatCompactMoney(commit)} hint="70%+ probability" />
          <Kpi label="Best case" value={formatCompactMoney(best)} hint="Commit + 40–69% deals" />
          <Kpi label="Open pipeline" value={formatCompactMoney(pipeline)} hint="All open deals" />
          <Kpi label="Commit vs quota" value={`${Math.round((commit / quota) * 100)}%`} hint={`Quota ${formatCompactMoney(quota)}`} />
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_240px]">
          <Card className="p-3">
            <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span className="text-xs font-semibold text-foreground">Forecast by month</span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: CHART.green }} /> Commit
              </span>
              {showBest && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ background: CHART.blue }} /> Best case
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <span className="h-0 w-3 border-t border-dashed border-foreground" /> Monthly quota
              </span>
            </div>
            <div className="h-[190px]" role="img" aria-label={`Stacked bar chart of committed and best-case revenue by month`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }} barCategoryGap="28%">
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: CHART.axis }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tick={{ fontSize: 11, fill: CHART.axis }}
                    tickFormatter={(v: number) => formatCompactMoney(v)}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--secondary))", opacity: 0.6 }}
                    content={({ active, payload, label }) => {
                      const row = payload?.[0]?.payload as { commit: number; bestCase: number } | undefined;
                      return active && row ? (
                        <ChartTooltipBox
                          title={String(label)}
                          rows={[
                            { label: "Commit", value: formatMoney(row.commit), swatch: CHART.green },
                            ...(showBest ? [{ label: "Best case", value: formatMoney(row.bestCase), swatch: CHART.blue }] : []),
                            { label: "Quota", value: formatMoney(FORECAST_MONTHLY_QUOTA) },
                          ]}
                        />
                      ) : null;
                    }}
                  />
                  <ReferenceLine y={FORECAST_MONTHLY_QUOTA} stroke={CHART.ink} strokeDasharray="4 4" strokeWidth={1.5} />
                  <Bar
                    dataKey="commit"
                    stackId="f"
                    fill={CHART.green}
                    stroke={CHART.surface}
                    strokeWidth={2}
                    radius={showBest ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                    isAnimationActive={animate}
                    animationDuration={400}
                  />
                  {showBest && (
                    <Bar
                      dataKey="bestCase"
                      stackId="f"
                      fill={CHART.blue}
                      stroke={CHART.surface}
                      strokeWidth={2}
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={animate}
                      animationDuration={400}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="hidden p-3 lg:block">
            <p className="mb-2 text-xs font-semibold">Expected to close</p>
            <ul className="space-y-2">
              {closing.map((d) => (
                <li key={d.id} className="text-xs">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium">{d.title}</span>
                    <span className="shrink-0 tabular-nums">{formatCompactMoney(d.value)}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {relativeDays(d.closeInDays)} · {stageById(d.stage).name} · {stageById(d.stage).probability}%
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
