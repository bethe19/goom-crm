import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Clock, Download, Hourglass, Lock, Percent, Scale, Target, ThumbsDown, Timer, Trophy, UserRound, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { PageBanner } from "@/components/PageBanner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState, ErrorState } from "@/components/common/States";
import { UpgradePrompt } from "@/components/settings/UpgradePrompt";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { RevenueTrendChart } from "@/components/dashboard/RevenueTrendChart";
import { PipelineFunnelChart } from "@/components/dashboard/PipelineFunnelChart";
import { WinLossCard } from "@/components/dashboard/WinLossCard";
import { ActivityHeatmap } from "@/components/dashboard/ActivityHeatmap";
import { Leaderboard } from "@/components/dashboard/Leaderboard";
import { ActivityMixChart, BarList, HistogramCard, LockedPreview, WinRateTrendChart } from "@/components/dashboard/ReportCharts";
import { SectionCard, Segmented } from "@/components/dashboard/ChartParts";
import { LOST_COLOR, VIZ_VARS, stageColor } from "@/components/dashboard/chartTheme";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadCsv } from "@/lib/csv";
import { formatCompactCurrency, formatCurrency, formatPercent } from "@/lib/formatters";
import { minimumPlanFor } from "@/lib/plans";
import { cn } from "@/lib/utils";
import {
  REPORT_PERIODS,
  type ReportPeriod,
  activityHeatmap,
  activityMixSeries,
  averageDealSize,
  averageSalesCycleDays,
  cycleDistribution,
  dealStatus,
  getPeriodRange,
  getPreviousPeriodRange,
  inRange,
  lostDealsIn,
  lostReasonBreakdown,
  median,
  memberName,
  openDeals,
  ownerLeaderboard,
  performanceSeries,
  periodDelta,
  pickBucketUnit,
  rateDelta,
  salesCycleDays,
  stageBreakdown,
  stageFlow,
  sumValue,
  timeBuckets,
  useAnalyticsActivities,
  useAnalyticsRealtime,
  useStageHistory,
  useWorkspaceAnalytics,
  useWorkspaceMembers,
  valueHistogram,
  winRate,
  wonDealsIn,
  wonRevenue,
} from "@/hooks/useAnalytics";

const PERIOD_PHRASE: Record<ReportPeriod, string> = {
  this_month: "this month",
  last_month: "last month",
  this_quarter: "this quarter",
  this_year: "this year",
  last_12_months: "in the last 12 months",
};

const PREVIOUS_LABEL: Record<ReportPeriod, string> = {
  this_month: "vs same days last month",
  last_month: "vs the month before",
  this_quarter: "vs same days last quarter",
  this_year: "vs same days last year",
  last_12_months: "vs the 12 months before",
};

const PREVIOUS_SERIES: Record<ReportPeriod, string> = {
  this_month: "Last month",
  last_month: "Month before",
  this_quarter: "Last quarter",
  this_year: "Last year",
  last_12_months: "Previous 12 months",
};

type SizeView = "won" | "open";

function dayCount(n: number) {
  const r = Math.round(n);
  return `${r} ${r === 1 ? "day" : "days"}`;
}

export default function Reports() {
  const { organization, can, hasFeature } = useAuth();
  const { toast } = useToast();
  const currency = organization?.currency || "ETB";
  const teamView = can("team.view_reports");
  const advanced = hasFeature("advanced_reports");
  const canExport = hasFeature("csv_export");
  const hasHistoryFeature = hasFeature("audit_history");
  const [period, setPeriod] = useState<ReportPeriod>("this_quarter");
  const [pipelineId, setPipelineId] = useState<string | undefined>();
  const [sizeView, setSizeView] = useState<SizeView>("won");

  const now = useMemo(() => new Date(), []);
  const range = useMemo(() => getPeriodRange(period, now), [period, now]);
  const prevRange = useMemo(() => getPreviousPeriodRange(period, now), [period, now]);
  const unit = pickBucketUnit(range);
  const buckets = useMemo(() => timeBuckets(range, unit), [range, unit]);
  const prevBuckets = useMemo(() => timeBuckets(prevRange, unit), [prevRange, unit]);

  useAnalyticsRealtime();
  const analytics = useWorkspaceAnalytics();
  const members = useWorkspaceMembers();
  const activities = useAnalyticsActivities(range, advanced);
  const history = useStageHistory(advanced && hasHistoryFeature);
  const data = analytics.data;

  const report = useMemo(() => {
    if (!data) return null;
    const { deals, stagesById } = data;
    const won = wonRevenue(deals, stagesById, range);
    const prevWon = wonRevenue(deals, stagesById, prevRange);
    const lost = lostDealsIn(deals, stagesById, range);
    const cur = performanceSeries(deals, stagesById, buckets);
    const prev = performanceSeries(deals, stagesById, prevBuckets);
    const cycles = salesCycleDays(deals, stagesById, range);
    const touched = deals.filter((d) => inRange(d.created_at, range) || inRange(d.won_at, range) || inRange(d.lost_at, range));
    return {
      won,
      prevWon,
      wonDelta: periodDelta(won.value, prevWon.value),
      lost: { count: lost.length, value: sumValue(lost) },
      win: winRate(deals, stagesById, range),
      prevWin: winRate(deals, stagesById, prevRange),
      avgSize: averageDealSize(deals, stagesById, range),
      prevAvgSize: averageDealSize(deals, stagesById, prevRange),
      cycle: averageSalesCycleDays(deals, stagesById, range),
      prevCycle: averageSalesCycleDays(deals, stagesById, prevRange),
      cycles,
      cycleMedian: median(cycles),
      series: cur,
      trend: cur.map((p, i) => ({
        key: p.key,
        label: p.label,
        value: p.wonValue,
        count: p.wonCount,
        prev: prev[i] ? prev[i].wonValue : null,
        prevLabel: prev[i] ? (unit === "week" ? `Week of ${format(prev[i].start, "MMM d")}` : format(prev[i].start, "MMM yyyy")) : undefined,
      })),
      createdCount: deals.filter((d) => inRange(d.created_at, range)).length,
      wonSizes: wonDealsIn(deals, stagesById, range).map((d) => d.value),
      openSizes: openDeals(deals, stagesById).map((d) => d.value),
      lostReasons: lostReasonBreakdown(deals, stagesById, range),
      leaderboard: ownerLeaderboard(deals, stagesById, range).filter((r) => r.wonCount + r.lostCount + r.openCount > 0),
      touched,
    };
  }, [data, range, prevRange, buckets, prevBuckets, unit]);

  const stages = useMemo(() => {
    if (!data) return null;
    const active = data.pipelines.find((p) => p.id === pipelineId) ?? data.pipelines[0];
    const pipelineDeals = data.deals.filter((d) => d.pipeline_id === active?.id);
    return {
      activePipelineId: active?.id,
      rows: stageBreakdown(pipelineDeals, data.stages, active?.id),
      flow: history.data ? stageFlow(pipelineDeals, data.stages, active?.id, history.data, { cohort: range, staysEndedIn: range }) : null,
    };
  }, [data, pipelineId, history.data, range]);

  const mix = useMemo(() => (activities.data ? activityMixSeries(activities.data, buckets) : []), [activities.data, buckets]);
  const heat = useMemo(() => (activities.data ? activityHeatmap(activities.data) : null), [activities.data]);

  const sizeBins = useMemo(() => valueHistogram(sizeView === "won" ? report?.wonSizes ?? [] : report?.openSizes ?? []), [report, sizeView]);
  const cycleRows = useMemo(() => cycleDistribution(report?.cycles ?? []), [report]);

  const loading = analytics.isLoading;
  const error = analytics.isError ? analytics.error : null;
  const retry = () => analytics.refetch();
  const periodPhrase = PERIOD_PHRASE[period];
  const bucketWord = unit === "week" ? "week" : "month";
  const money = (v: number) => formatCurrency(v, currency);
  const binLabel = (min: number, max: number | null) =>
    max === null ? `${formatCompactCurrency(min, currency)}+` : `${formatCompactCurrency(min, currency)}–${formatCompactCurrency(max, currency)}`;

  const exportCsv = () => {
    if (!data || !report) return;
    const stageName = (id: string) => data.stagesById.get(id)?.name ?? "";
    downloadCsv(
      `deals-${period.replace(/_/g, "-")}-${format(now, "yyyy-MM-dd")}.csv`,
      ["Title", "Company", "Stage", "Status", "Owner", "Value", "Probability", "Close date", "Created", "Won at", "Lost at", "Lost reason"],
      report.touched.map((d) => [
        d.title,
        d.company_name ?? "",
        stageName(d.stage_id),
        dealStatus(d, data.stagesById),
        memberName(members.data, d.owner_id),
        d.value,
        d.probability ?? "",
        d.close_date ?? "",
        d.created_at ? format(new Date(d.created_at), "yyyy-MM-dd") : "",
        d.won_at ? format(new Date(d.won_at), "yyyy-MM-dd") : "",
        d.lost_at ? format(new Date(d.lost_at), "yyyy-MM-dd") : "",
        d.lost_reason ?? "",
      ]),
    );
    toast({ title: "Report exported", description: `${report.touched.length} deals created or closed ${periodPhrase}.`, variant: "success" });
  };

  const exportButton = (
    <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={exportCsv} disabled={!canExport || !report || report.touched.length === 0}>
      {canExport ? <Download className="h-4 w-4" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
      Export CSV
    </Button>
  );

  const flowReady = !!stages?.flow?.hasHistory;
  const stageTimeRows = (stages?.flow?.rows ?? []).filter((r) => !r.isWon && r.avgDaysInStage !== null);

  return (
    <div className={cn("mx-auto max-w-[1600px] space-y-6", VIZ_VARS)}>
      <PageBanner
        title="Reports"
        description={teamView ? "Revenue, win rate, pipeline health and team performance." : "Your performance: revenue, win rate, pipeline and activity on your deals."}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
            <SelectTrigger className="h-9 w-[160px]" aria-label="Report period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORT_PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canExport ? (
            exportButton
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {exportButton}
                </span>
              </TooltipTrigger>
              <TooltipContent>CSV export is included in the {minimumPlanFor("csv_export").name} plan</TooltipContent>
            </Tooltip>
          )}
        </div>
      </PageBanner>

      <div className="-mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-0.5 text-foreground">
          {teamView ? <Users className="h-3.5 w-3.5" aria-hidden /> : <UserRound className="h-3.5 w-3.5" aria-hidden />}
          {teamView ? "Whole workspace" : "Your deals"}
        </span>
        <span>
          {format(range.start, "MMM d, yyyy")} – {format(new Date(range.end.getTime() - 1), "MMM d, yyyy")}
        </span>
        <span aria-hidden>·</span>
        <span>
          compared with {format(prevRange.start, "MMM d, yyyy")} – {format(new Date(prevRange.end.getTime() - 1), "MMM d, yyyy")}
        </span>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={retry} title="Couldn't load reports" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Won revenue"
              icon={Trophy}
              loading={loading}
              value={report ? money(report.won.value) : null}
              hint="Value of deals moved to a won stage during the period."
              sub={report ? `${report.won.count} ${report.won.count === 1 ? "deal" : "deals"}` : undefined}
              delta={
                report
                  ? report.won.value === 0 && report.prevWon.value === 0
                    ? { value: null, label: "", fallback: "No won deals in this or the previous period" }
                    : { value: report.wonDelta.pct, label: PREVIOUS_LABEL[period], fallback: "None in the previous period" }
                  : null
              }
              trend={report?.series.map((p) => ({ label: p.label, value: p.wonValue, display: money(p.wonValue) }))}
              trendLabel={`Won revenue per ${bucketWord}`}
            />
            <KpiCard
              label="Win rate"
              icon={Percent}
              loading={loading}
              value={report && report.win.rate !== null ? formatPercent(report.win.rate) : null}
              unavailableReason="No deals were won or lost in this period."
              hint="Won ÷ (won + lost) for deals closed during the period. The change is in percentage points."
              sub={report ? `${report.win.won} won · ${report.win.lost} lost` : undefined}
              delta={
                report && report.win.rate !== null && report.prevWin.rate !== null
                  ? { value: rateDelta(report.win.rate, report.prevWin.rate), kind: "pp", label: PREVIOUS_LABEL[period] }
                  : null
              }
              trend={report?.series.map((p) => ({ label: p.label, value: p.winRate, display: p.winRate === null ? "nothing closed" : formatPercent(p.winRate) }))}
              trendLabel={`Win rate per ${bucketWord}`}
            />
            <KpiCard
              label="Average deal size"
              icon={Target}
              loading={loading}
              value={report && report.avgSize !== null ? money(report.avgSize) : null}
              unavailableReason="No deals were won in this period."
              hint="Average value of deals won during the period."
              delta={
                report && report.avgSize !== null
                  ? { value: report.prevAvgSize ? periodDelta(report.avgSize, report.prevAvgSize).pct : null, label: PREVIOUS_LABEL[period], fallback: "No wins in the previous period" }
                  : null
              }
              trend={report?.series.map((p) => ({ label: p.label, value: p.avgDealSize, display: p.avgDealSize === null ? "no wins" : money(p.avgDealSize) }))}
              trendLabel={`Average won deal size per ${bucketWord}`}
            />
            <KpiCard
              label="Average sales cycle"
              icon={Clock}
              loading={loading}
              value={report && report.cycle !== null ? dayCount(report.cycle) : null}
              unavailableReason="No deals were won in this period, so there's no cycle to measure."
              hint="Average days from a deal's creation to the day it was won, for deals won during the period. Shorter is better."
              sub={report && report.cycleMedian !== null ? `median ${dayCount(report.cycleMedian)}` : undefined}
              delta={
                report && report.cycle !== null && report.prevCycle !== null
                  ? { value: report.cycle - report.prevCycle, kind: "days", goodWhen: "down", label: PREVIOUS_LABEL[period] }
                  : null
              }
              trend={report?.series.map((p) => ({ label: p.label, value: p.avgCycleDays, display: p.avgCycleDays === null ? "no wins" : dayCount(p.avgCycleDays) }))}
              trendLabel={`Average sales cycle per ${bucketWord}`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            <RevenueTrendChart
              className={advanced ? "lg:col-span-8" : "lg:col-span-12"}
              title="Revenue over time"
              description={`Won revenue per ${bucketWord} ${periodPhrase}, against the previous period`}
              points={report?.trend ?? []}
              currency={currency}
              loading={loading}
              error={error}
              onRetry={retry}
              previousLabel={PREVIOUS_SERIES[period]}
              comparisonPhrase={PREVIOUS_LABEL[period]}
              emptyTitle="No revenue in this period yet"
              emptyDescription="Won deals appear here by the date they were won. Try a longer period."
            />
            {advanced && (
              <WinLossCard
                className="lg:col-span-4"
                description={`Deals closed ${periodPhrase}`}
                won={report?.won ?? { count: 0, value: 0 }}
                lost={report?.lost ?? { count: 0, value: 0 }}
                series={report?.series}
                currency={currency}
                loading={loading}
              />
            )}
          </div>

          {!advanced ? (
            <LockedPreview>
              <UpgradePrompt feature="advanced_reports" className="bg-card shadow-sm" />
            </LockedPreview>
          ) : (
            <>
              <div className="grid gap-6 lg:grid-cols-12">
                <WinRateTrendChart
                  className="lg:col-span-5"
                  points={report?.series ?? []}
                  overall={report?.win.rate ?? null}
                  loading={loading}
                  description={`Won ÷ (won + lost) per ${bucketWord}, with the period average`}
                />
                <ActivityMixChart
                  className="lg:col-span-7"
                  points={mix}
                  loading={activities.isLoading}
                  error={activities.isError ? activities.error : null}
                  onRetry={() => activities.refetch()}
                  description={`Calls, emails, meetings and notes per ${bucketWord} ${periodPhrase}`}
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-12">
                <PipelineFunnelChart
                  className="lg:col-span-7"
                  title="Stage funnel"
                  description={
                    flowReady
                      ? `Open deals by stage today; conversion for the ${stages?.flow?.cohortSize ?? 0} deals created ${periodPhrase}`
                      : "Open deals in each stage today (current distribution)"
                  }
                  rows={stages?.rows ?? []}
                  flow={stages?.flow}
                  flowNote={
                    !hasHistoryFeature
                      ? "This is where deals sit today. Conversion between stages is calculated from deal history, which is included in the Enterprise plan."
                      : history.isLoading
                        ? "Loading deal history…"
                        : history.isError
                          ? "Deal history couldn't be loaded, so this shows the current distribution only."
                          : "No stage changes were recorded for deals created in this period, so this shows the current distribution."
                  }
                  currency={currency}
                  loading={loading}
                  pipelines={data?.pipelines}
                  pipelineId={stages?.activePipelineId}
                  onPipelineChange={setPipelineId}
                />
                <SectionCard
                  className="lg:col-span-5"
                  title="Average time in stage"
                  description={`Completed stays that ended ${periodPhrase}, from deal history`}
                  table={
                    stageTimeRows.length
                      ? {
                          columns: ["Stage", "Average time", "Stays measured"],
                          rows: stageTimeRows.map((r) => [r.name, dayCount(r.avgDaysInStage ?? 0), r.stays]),
                        }
                      : null
                  }
                >
                  {!hasHistoryFeature ? (
                    <div className="space-y-4">
                      <EmptyState
                        compact
                        icon={Hourglass}
                        title="Time in stage needs deal history"
                        description="Deal history records every stage change, so we can measure how long deals wait in each stage."
                      />
                      <UpgradePrompt feature="audit_history" compact />
                    </div>
                  ) : loading || history.isLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-9 w-full" />
                      ))}
                    </div>
                  ) : history.isError ? (
                    <ErrorState compact error={history.error} onRetry={() => history.refetch()} title="Couldn't load deal history" />
                  ) : stageTimeRows.length === 0 ? (
                    <EmptyState
                      compact
                      icon={Timer}
                      title="No stage changes in this period"
                      description="Averages appear once deals move out of a stage. Try a longer period."
                    />
                  ) : (
                    <BarList
                      ariaLabel="Average days in each stage"
                      rows={stageTimeRows.map((r) => ({
                        key: r.id,
                        label: r.name,
                        value: r.avgDaysInStage ?? 0,
                        display: dayCount(r.avgDaysInStage ?? 0),
                        sub: `${r.stays} ${r.stays === 1 ? "stay" : "stays"}`,
                        color: stageColor(r.color),
                        tooltip: [
                          { label: "Average time", value: dayCount(r.avgDaysInStage ?? 0), color: stageColor(r.color), shape: "rect" },
                          { label: "Stays measured", value: String(r.stays) },
                        ],
                      }))}
                    />
                  )}
                </SectionCard>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <HistogramCard
                  title="Deal size distribution"
                  description={sizeView === "won" ? `Deals won ${periodPhrase}, by value` : "Open deals today, by value"}
                  action={
                    <Segmented<SizeView>
                      label="Deals to show"
                      value={sizeView}
                      onChange={setSizeView}
                      options={[
                        { value: "won", label: "Won" },
                        { value: "open", label: "Open" },
                      ]}
                    />
                  }
                  data={sizeBins.map((b) => ({
                    label: binLabel(b.min, b.max),
                    count: b.count,
                    tooltip: [{ label: "Total value", value: money(b.total) }],
                  }))}
                  table={{ columns: ["Deal value", "Deals", "Total value"], rows: sizeBins.map((b) => [binLabel(b.min, b.max), b.count, money(b.total)]) }}
                  headline={
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <span className="text-2xl font-semibold tracking-tight text-foreground">
                        {(() => {
                          const m = median(sizeView === "won" ? report?.wonSizes ?? [] : report?.openSizes ?? []);
                          return m === null ? "—" : money(m);
                        })()}
                      </span>
                      <span className="text-xs text-muted-foreground">median deal</span>
                    </div>
                  }
                  emptyIcon={Scale}
                  emptyTitle={sizeView === "won" ? "No won deals in this period" : "No open deals"}
                  emptyDescription={sizeView === "won" ? "Switch to open deals, or try a longer period." : "Create deals to see how their values spread."}
                  loading={loading}
                />
                <HistogramCard
                  title="Sales cycle distribution"
                  description={`Days from creation to won, for deals won ${periodPhrase}`}
                  data={cycleRows.map((r) => ({ label: r.label, count: r.count }))}
                  table={{ columns: ["Cycle length", "Deals"], rows: cycleRows.map((r) => [r.label, r.count]) }}
                  headline={
                    report?.cycleMedian != null ? (
                      <div className="flex flex-wrap items-baseline gap-x-3">
                        <span className="text-2xl font-semibold tracking-tight text-foreground">{dayCount(report.cycleMedian)}</span>
                        <span className="text-xs text-muted-foreground">median · average {report.cycle !== null ? dayCount(report.cycle) : "—"}</span>
                      </div>
                    ) : undefined
                  }
                  emptyIcon={Clock}
                  emptyTitle="No won deals in this period"
                  emptyDescription="Cycle lengths appear once deals are won."
                  loading={loading}
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-12">
                <SectionCard
                  className="lg:col-span-5"
                  title="Lost reasons"
                  description={`Why deals were lost ${periodPhrase}`}
                  table={
                    report && report.lostReasons.length
                      ? { columns: ["Reason", "Deals", "Value"], rows: report.lostReasons.map((r) => [r.reason, r.count, money(r.value)]) }
                      : null
                  }
                  headline={
                    report && report.lost.count > 0 ? (
                      <div className="flex flex-wrap items-baseline gap-x-3">
                        <span className="text-2xl font-semibold tracking-tight text-foreground">{money(report.lost.value)}</span>
                        <span className="text-xs text-muted-foreground">
                          lost across {report.lost.count} {report.lost.count === 1 ? "deal" : "deals"}
                        </span>
                      </div>
                    ) : undefined
                  }
                >
                  {loading ? (
                    <Skeleton className="h-[180px] w-full" />
                  ) : !report || report.lostReasons.length === 0 ? (
                    <EmptyState compact icon={ThumbsDown} title="No lost deals in this period" description="When a deal is marked lost, its reason shows up here." />
                  ) : (
                    <BarList
                      ariaLabel="Lost deals by reason"
                      color={LOST_COLOR}
                      rows={report.lostReasons.slice(0, 8).map((r) => ({
                        key: r.reason,
                        label: r.reason,
                        value: r.count,
                        display: `${r.count} ${r.count === 1 ? "deal" : "deals"}`,
                        sub: money(r.value),
                        tooltip: [
                          { label: "Deals", value: String(r.count), color: LOST_COLOR, shape: "rect" },
                          { label: "Value", value: money(r.value) },
                          { label: "Share of losses", value: formatPercent(r.count / Math.max(report.lost.count, 1)) },
                        ],
                      }))}
                    />
                  )}
                </SectionCard>
                <ActivityHeatmap
                  className="lg:col-span-7"
                  title={teamView ? "When your team is active" : "When you're active"}
                  description={`Activities logged ${periodPhrase} by weekday and hour (your local time)`}
                  data={heat}
                  loading={activities.isLoading}
                  error={activities.isError ? activities.error : null}
                  onRetry={() => activities.refetch()}
                />
              </div>

              {teamView && (
                <Leaderboard
                  rows={report?.leaderboard ?? []}
                  members={members.data}
                  membersLoading={members.isLoading}
                  currency={currency}
                  loading={loading}
                  description={`Ranked by revenue won ${periodPhrase}, with each owner's open pipeline today`}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
