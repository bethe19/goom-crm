import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { REPORTS, TOUR_STAGES, formatCompactMoney, formatMoney, memberById, monthLabels, type ReportPeriod } from "./data";
import { useDemoScript } from "./hooks";
import { Avatar, CHART, Card, ChartTooltipBox, Kpi, PlanChip, SceneHeader, Segmented } from "./ui";

const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: "this", label: "This quarter" },
  { value: "last", label: "Last quarter" },
];

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function ReportsScene({ demo, animate }: { demo: boolean; animate: boolean }) {
  const [period, setPeriod] = useState<ReportPeriod>("this");
  useDemoScript(demo, [
    [2200, () => setPeriod("last")],
    [2400, () => setPeriod("this")],
  ]);

  const r = REPORTS[period];
  const prev = REPORTS[period === "this" ? "last" : "this"];
  const months = useMemo(() => monthLabels(6), []);
  const trend = r.trend.map((v, i) => ({ month: months[i], winRate: v }));
  const funnel = TOUR_STAGES.map((s, i) => ({ stage: s.name, deals: r.funnel[i] }));
  const topWon = Math.max(...r.leaderboard.map((l) => l.won), 1);
  const topLost = Math.max(...r.lostReasons.map((l) => l.count), 1);
  const delta = Math.round((r.winRate - prev.winRate) * 100);

  return (
    <div className="flex h-full flex-col">
      <SceneHeader title="Reports" subtitle="Revenue, win rate and team performance for the selected period">
        <Segmented<ReportPeriod> label="Report period" value={period} onChange={setPeriod} options={PERIODS} />
      </SceneHeader>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
        <div className="grid grid-cols-3 gap-2">
          <Kpi
            label="Win rate"
            value={pct(r.winRate)}
            hint={period === "this" ? `${delta >= 0 ? "+" : ""}${delta} pts vs last quarter` : "Closed deals won"}
          />
          <Kpi label="Avg. won deal" value={formatCompactMoney(r.avgDeal)} />
          <Kpi label="Sales cycle" value={`${r.cycleDays} days`} hint="Created → won" />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Card className="p-3">
            <p className="mb-2 text-xs font-semibold">Win rate by month</p>
            <div className="h-[150px]" role="img" aria-label={`Line chart of monthly win rate, latest ${pct(r.trend[r.trend.length - 1])}`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: CHART.axis }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    domain={[0, 0.5]}
                    ticks={[0, 0.25, 0.5]}
                    tick={{ fontSize: 11, fill: CHART.axis }}
                    tickFormatter={pct}
                  />
                  <Tooltip
                    cursor={{ stroke: CHART.axis, strokeDasharray: "3 3" }}
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <ChartTooltipBox title={String(label)} rows={[{ label: "Win rate", value: pct(Number(payload[0].value)), swatch: CHART.blue }]} />
                      ) : null
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="winRate"
                    stroke={CHART.blue}
                    strokeWidth={2}
                    dot={{ r: 3, fill: CHART.blue, stroke: CHART.surface, strokeWidth: 2 }}
                    activeDot={{ r: 5, stroke: CHART.surface, strokeWidth: 2 }}
                    isAnimationActive={animate}
                    animationDuration={500}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-3">
            <p className="mb-2 text-xs font-semibold">Deals reaching each stage</p>
            <div className="h-[150px]" role="img" aria-label="Horizontal bar chart of deals reaching each stage">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnel} layout="vertical" margin={{ top: 0, right: 28, bottom: 0, left: 0 }} barCategoryGap="22%">
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="stage"
                    tickLine={false}
                    axisLine={false}
                    width={78}
                    tick={{ fontSize: 11, fill: CHART.axis }}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--secondary))", opacity: 0.6 }}
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <ChartTooltipBox
                          title={String(label)}
                          rows={[
                            { label: "Deals", value: String(payload[0].value), swatch: CHART.ink },
                            { label: "Of all created", value: pct(Number(payload[0].value) / r.funnel[0]) },
                          ]}
                        />
                      ) : null
                    }
                  />
                  <Bar
                    dataKey="deals"
                    fill={CHART.ink}
                    radius={[0, 4, 4, 0]}
                    label={{ position: "right", fontSize: 11, fill: CHART.axis }}
                    isAnimationActive={animate}
                    animationDuration={500}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold">Leaderboard · won revenue</p>
              <PlanChip feature="advanced_reports" />
            </div>
            <ul className="space-y-2">
              {r.leaderboard.map((l) => {
                const m = memberById(l.memberId);
                return (
                  <li key={l.memberId} className="flex items-center gap-2 text-xs">
                    <Avatar initials={m.initials} className="h-5 w-5" />
                    <span className="w-20 truncate">{m.name.split(" ")[0]}</span>
                    <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                      <span
                        className="absolute inset-y-0 left-0 rounded-full bg-foreground transition-[width] duration-500 ease-out motion-reduce:transition-none"
                        style={{ width: `${(l.won / topWon) * 100}%` }}
                      />
                    </span>
                    <span className="w-14 text-right tabular-nums">{l.won ? formatMoney(l.won) : "—"}</span>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold">Lost reasons</p>
              <PlanChip feature="advanced_reports" />
            </div>
            <ul className="space-y-2">
              {r.lostReasons.map((l) => (
                <li key={l.reason} className="flex items-center gap-2 text-xs">
                  <span className="w-28 truncate">{l.reason}</span>
                  <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-muted-foreground transition-[width] duration-500 ease-out motion-reduce:transition-none"
                      style={{ width: `${(l.count / topLost) * 100}%` }}
                    />
                  </span>
                  <span className="w-6 text-right tabular-nums">{l.count}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
