import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorState } from "@/components/common/States";
import { ChartTooltipBox, SectionCard } from "@/components/dashboard/ChartParts";
import { AXIS_TICK, CURSOR_FILL, GRID_STROKE, SERIES_PRIMARY } from "@/components/dashboard/chartTheme";
import { formatNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { usePlatformTimeseries, type PlatformTimeseriesPoint } from "@/hooks/usePlatform";
import { summarizeSeries } from "./platformUtils";

const RANGE_OPTIONS = [30, 90, 180] as const;
type RangeDays = (typeof RANGE_OPTIONS)[number];

/*
 * Two-series palette for the growth chart. Light uses the --chart-2/--chart-3 tokens; dark uses
 * steps chosen for the dark surface (the dark --chart tokens are too light for thin lines).
 * Validated with the dataviz palette checker: light #2674d9/#2c9664 and dark #3e8eea/#36a16f
 * pass lightness, chroma, CVD separation and >= 3:1 contrast. New workspaces is also dashed,
 * so the series never rely on color alone.
 */
const SERIES_VARS =
  "[--pl-signups:hsl(var(--chart-2))] [--pl-workspaces:hsl(var(--chart-3))] dark:[--pl-signups:hsl(212_80%_58%)] dark:[--pl-workspaces:hsl(152_50%_42%)]";
const SIGNUPS = "var(--pl-signups)";
const WORKSPACES = "var(--pl-workspaces)";
const WORKSPACES_DASH = "6 4";

const shortDay = (day: string) => format(parseISO(day), "MMM d");
const longDay = (day: string) => format(parseISO(day), "EEE, MMM d, yyyy");

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function LegendKey({ color, dashed, label, value }: { color: string; dashed?: boolean; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <svg width="18" height="8" aria-hidden className="shrink-0">
        <line x1="1" y1="4" x2="17" y2="4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeDasharray={dashed ? "4 3" : undefined} />
      </svg>
      {label}
      <span className="font-medium tabular-nums text-foreground">{formatNumber(value)}</span>
    </span>
  );
}

export function ActivityCharts() {
  const [days, setDays] = useState<RangeDays>(90);
  const query = usePlatformTimeseries(days);
  const points = useMemo(() => query.data ?? [], [query.data]);
  const animate = !prefersReducedMotion();

  const signups = summarizeSeries(points, "signups");
  const workspaces = summarizeSeries(points, "new_workspaces");
  const ai = summarizeSeries(points, "ai_requests");
  const hasGrowth = signups.total > 0 || workspaces.total > 0;
  const hasAi = ai.total > 0;
  const stale = query.isPlaceholderData;

  const rangeLabel = `last ${days} days`;
  const tickInterval = days <= 30 ? 4 : "preserveStartEnd";

  const body = (content: React.ReactNode, empty: boolean, emptyTitle: string, emptyText: string) =>
    query.isPending ? (
      <Skeleton className="h-[240px] w-full rounded-lg" />
    ) : query.isError ? (
      <ErrorState compact error={query.error} onRetry={() => query.refetch()} title="Couldn't load activity" />
    ) : empty ? (
      <EmptyState compact icon={Activity} title={emptyTitle} description={emptyText} />
    ) : (
      <div className={cn("transition-opacity duration-150", stale && "opacity-60")}>{content}</div>
    );

  return (
    <section aria-labelledby="platform-activity-heading" className={cn("space-y-3", SERIES_VARS)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="platform-activity-heading" className="text-sm font-semibold text-foreground">
            Activity
          </h2>
          <p className="text-xs text-muted-foreground">Daily totals across all workspaces, {rangeLabel}.</p>
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={String(days)}
          onValueChange={(v) => v && setDays(Number(v) as RangeDays)}
          aria-label="Date range"
          className="justify-start"
        >
          {RANGE_OPTIONS.map((d) => (
            <ToggleGroupItem key={d} value={String(d)} className="h-8 px-3 text-xs tabular-nums" aria-label={`Last ${d} days`}>
              {d}d
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Signups and new workspaces" description="Accounts created and workspaces started per day">
          {body(
            <>
              <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
                <LegendKey color={SIGNUPS} label="Signups" value={signups.total} />
                <LegendKey color={WORKSPACES} dashed label="New workspaces" value={workspaces.total} />
              </div>
              <div
                className="h-[220px] w-full"
                role="img"
                aria-label={`Signups and new workspaces per day, ${rangeLabel}: ${formatNumber(signups.total)} signups${
                  signups.peak ? ` (busiest ${shortDay(signups.peak.day)} with ${formatNumber(signups.peak.value)})` : ""
                }, ${formatNumber(workspaces.total)} new workspaces.`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={shortDay} interval={tickInterval} minTickGap={24} />
                    <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
                    <Tooltip
                      cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1, strokeDasharray: "3 3" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload as PlatformTimeseriesPoint;
                        return (
                          <ChartTooltipBox
                            title={longDay(p.day)}
                            rows={[
                              { label: "Signups", value: formatNumber(p.signups), color: SIGNUPS },
                              { label: "New workspaces", value: formatNumber(p.new_workspaces), color: WORKSPACES },
                            ]}
                          />
                        );
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="signups"
                      name="Signups"
                      stroke={SIGNUPS}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, stroke: "hsl(var(--card))", strokeWidth: 2, fill: SIGNUPS }}
                      isAnimationActive={animate}
                    />
                    <Line
                      type="monotone"
                      dataKey="new_workspaces"
                      name="New workspaces"
                      stroke={WORKSPACES}
                      strokeWidth={2}
                      strokeDasharray={WORKSPACES_DASH}
                      dot={false}
                      activeDot={{ r: 4, stroke: "hsl(var(--card))", strokeWidth: 2, fill: WORKSPACES }}
                      isAnimationActive={animate}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>,
            !hasGrowth,
            "No signups in this period",
            `Nobody signed up or started a workspace in the ${rangeLabel}.`,
          )}
        </SectionCard>

        <SectionCard
          title="AI requests"
          description="Assistant requests per day across all workspaces"
          action={
            !query.isPending && !query.isError && hasAi ? (
              <span className="text-sm font-semibold tabular-nums text-foreground">{formatNumber(ai.total)}</span>
            ) : undefined
          }
        >
          {body(
            <div
              className="mt-6 h-[220px] w-full"
              role="img"
              aria-label={`AI requests per day, ${rangeLabel}: ${formatNumber(ai.total)} in total${
                ai.peak ? `, busiest ${shortDay(ai.peak.day)} with ${formatNumber(ai.peak.value)}` : ""
              }.`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={days <= 30 ? "24%" : "12%"}>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={shortDay} interval={tickInterval} minTickGap={24} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
                  <Tooltip
                    cursor={CURSOR_FILL}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as PlatformTimeseriesPoint;
                      return <ChartTooltipBox title={longDay(p.day)} rows={[{ label: "AI requests", value: formatNumber(p.ai_requests) }]} />;
                    }}
                  />
                  <Bar
                    dataKey="ai_requests"
                    name="AI requests"
                    fill={SERIES_PRIMARY}
                    radius={days <= 30 ? [4, 4, 0, 0] : [2, 2, 0, 0]}
                    maxBarSize={24}
                    isAnimationActive={animate}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>,
            !hasAi,
            "No AI requests in this period",
            `No workspace used the assistant in the ${rangeLabel}.`,
          )}
        </SectionCard>
      </div>

      {!query.isPending && !query.isError && (hasGrowth || hasAi) && <ActivityTable points={points} />}
    </section>
  );
}

/** Accessible table view of the charted numbers (days with any activity, newest first). */
function ActivityTable({ points }: { points: PlatformTimeseriesPoint[] }) {
  const active = useMemo(
    () => points.filter((p) => p.signups || p.new_workspaces || p.ai_requests).slice().reverse(),
    [points],
  );
  return (
    <details className="group rounded-xl border border-border bg-card">
      <summary className="cursor-pointer select-none rounded-xl px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        View as table <span className="tabular-nums">({formatNumber(active.length)} active days)</span>
      </summary>
      <Table containerClassName="max-h-[320px] border-t border-border" aria-label="Daily activity">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Day</TableHead>
            <TableHead className="text-right">Signups</TableHead>
            <TableHead className="text-right">New workspaces</TableHead>
            <TableHead className="pr-4 text-right">AI requests</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {active.map((p) => (
            <TableRow key={p.day}>
              <TableCell className="whitespace-nowrap pl-4">
                <time dateTime={p.day}>{longDay(p.day)}</time>
              </TableCell>
              <TableCell className="text-right">{formatNumber(p.signups)}</TableCell>
              <TableCell className="text-right">{formatNumber(p.new_workspaces)}</TableCell>
              <TableCell className="pr-4 text-right">{formatNumber(p.ai_requests)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </details>
  );
}
