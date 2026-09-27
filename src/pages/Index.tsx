import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { addDays, addMonths, format } from "date-fns";
import { CheckSquare, ChevronDown, DollarSign, Percent, Phone, Plus, Target, Trophy, UserPlus, Users, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageBanner } from "@/components/PageBanner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorState } from "@/components/common/States";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { GetStartedCard } from "@/components/dashboard/GetStartedCard";
import { RevenueTrendChart } from "@/components/dashboard/RevenueTrendChart";
import { PipelineFunnelChart } from "@/components/dashboard/PipelineFunnelChart";
import { WinLossCard } from "@/components/dashboard/WinLossCard";
import { CloseMonthChart } from "@/components/dashboard/CloseMonthChart";
import { ClosingSoon } from "@/components/dashboard/ClosingSoon";
import { MyTasks } from "@/components/dashboard/MyTasks";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { Segmented } from "@/components/dashboard/ChartParts";
import { VIZ_VARS } from "@/components/dashboard/chartTheme";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import {
  averageDealSize,
  buildForecast,
  closingSoon,
  effectiveProbability,
  getPeriodRange,
  getPreviousPeriodRange,
  lastMonthsBuckets,
  openDeals,
  openPipelineValue,
  performanceSeries,
  periodDelta,
  rateDelta,
  stageBreakdown,
  stageFlow,
  sumValue,
  timeBuckets,
  lostDealsIn,
  useAnalyticsRealtime,
  useStageHistory,
  useWorkspaceAnalytics,
  weightedPipelineValue,
  winRate,
  wonRevenue,
} from "@/hooks/useAnalytics";

const WINDOW_DAYS = 90;
type RangeMonths = "6" | "12";

function greeting(now: Date) {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function Index() {
  const { user, organization, can, hasFeature } = useAuth();
  const navigate = useNavigate();
  const currency = organization?.currency || "ETB";
  const teamView = can("team.view_reports");
  const hasHistoryFeature = hasFeature("audit_history");
  const hasForecast = hasFeature("forecast");
  const [pipelineId, setPipelineId] = useState<string | undefined>();
  const [rangeMonths, setRangeMonths] = useState<RangeMonths>("6");
  const months = Number(rangeMonths);

  useAnalyticsRealtime();
  const analytics = useWorkspaceAnalytics();
  const history = useStageHistory(hasHistoryFeature);
  const { data } = analytics;

  const profile = useQuery({
    queryKey: ["analytics", "profile-name", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: row } = await supabase.from("profiles").select("full_name").eq("user_id", user!.id).maybeSingle();
      return row?.full_name ?? null;
    },
  });
  const fullName = profile.data || (user?.user_metadata?.full_name as string | undefined) || "";
  const firstName = fullName.trim().split(/\s+/)[0] || "";

  const now = useMemo(() => new Date(), []);

  // Everything that depends only on the deals (not on the selected range / pipeline).
  const base = useMemo(() => {
    if (!data) return null;
    const { deals, stagesById } = data;
    const thisMonth = wonRevenue(deals, stagesById, getPeriodRange("this_month", now));
    const lastMonth = wonRevenue(deals, stagesById, getPreviousPeriodRange("this_month", now));
    const winRange = { start: addDays(now, -WINDOW_DAYS), end: addDays(now, 1) };
    const prevWinRange = { start: addDays(now, -2 * WINDOW_DAYS), end: winRange.start };
    const forecast = buildForecast(deals, stagesById, 6, now);
    return {
      openCount: openDeals(deals, stagesById).length,
      openValue: openPipelineValue(deals, stagesById),
      weighted: weightedPipelineValue(deals, stagesById),
      thisMonth,
      lastMonth,
      monthDelta: periodDelta(thisMonth.value, lastMonth.value),
      win: winRate(deals, stagesById, winRange),
      prevWin: winRate(deals, stagesById, prevWinRange),
      avgSize: averageDealSize(deals, stagesById, winRange),
      prevAvgSize: averageDealSize(deals, stagesById, prevWinRange),
      forecast,
      closing: closingSoon(deals, stagesById, 30, now),
      hasDeals: deals.length > 0,
    };
  }, [data, now]);

  const ranged = useMemo(() => {
    if (!data) return null;
    const { deals, stagesById } = data;
    const buckets = lastMonthsBuckets(months, now);
    const prevBuckets = timeBuckets({ start: addMonths(buckets[0].start, -months), end: buckets[0].start }, "month");
    const cur = performanceSeries(deals, stagesById, buckets);
    const prev = performanceSeries(deals, stagesById, prevBuckets);
    const range = { start: buckets[0].start, end: buckets[buckets.length - 1].end };
    const lost = lostDealsIn(deals, stagesById, range);
    return {
      range,
      series: cur,
      trend: cur.map((p, i) => ({
        key: p.key,
        label: p.label,
        value: p.wonValue,
        count: p.wonCount,
        prev: prev[i] ? prev[i].wonValue : null,
        prevLabel: prev[i] ? format(prev[i].start, "MMM yyyy") : undefined,
      })),
      won: { count: cur.reduce((s, p) => s + p.wonCount, 0), value: cur.reduce((s, p) => s + p.wonValue, 0) },
      lost: { count: lost.length, value: sumValue(lost) },
    };
  }, [data, months, now]);

  const funnel = useMemo(() => {
    if (!data || !ranged) return null;
    const { deals, stages, pipelines } = data;
    const activePipeline = pipelines.find((p) => p.id === pipelineId) ?? pipelines[0];
    const pipelineDeals = deals.filter((d) => d.pipeline_id === activePipeline?.id);
    return {
      activePipelineId: activePipeline?.id,
      rows: stageBreakdown(pipelineDeals, stages, activePipeline?.id),
      flow: history.data ? stageFlow(pipelineDeals, stages, activePipeline?.id, history.data, { cohort: ranged.range }) : null,
    };
  }, [data, ranged, pipelineId, history.data]);

  const loading = analytics.isLoading;
  const error = analytics.isError ? analytics.error : null;
  const retry = () => analytics.refetch();
  const rangePhrase = `last ${months} months`;
  const money = (v: number) => formatCurrency(v, currency);

  const flowNote = !hasHistoryFeature
    ? "Showing where open deals sit today. Stage-to-stage conversion comes from deal history, which is included in the Enterprise plan."
    : history.isLoading
      ? "Loading deal history…"
      : history.isError
        ? "Deal history couldn't be loaded, so this shows where open deals sit today."
        : "Conversion between stages appears once deals start moving through this pipeline.";

  return (
    <div className={cn("mx-auto max-w-[1600px] space-y-6", VIZ_VARS)}>
      <PageBanner
        title={firstName ? `${greeting(now)}, ${firstName}` : greeting(now)}
        description={`${organization?.name ? `${organization.name} · ` : ""}${format(now, "EEEE, MMMM d")}`}
      >
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                Create
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => navigate("/contacts?new=1")}>
                <UserPlus className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden />
                Contact
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate("/activities?new=1")}>
                <Phone className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden />
                Activity
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate("/tasks?new=1")}>
                <CheckSquare className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden />
                Task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" className="gap-1.5" onClick={() => navigate("/pipeline?new=1")}>
            <Plus className="h-4 w-4" aria-hidden />
            New deal
          </Button>
        </div>
      </PageBanner>

      {!error && <GetStartedCard hasDeals={!!base?.hasDeals} loading={loading} />}

      {error ? (
        <ErrorState error={error} onRetry={retry} title="Couldn't load your dashboard" />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                {teamView ? <Users className="h-3.5 w-3.5" aria-hidden /> : <UserRound className="h-3.5 w-3.5" aria-hidden />}
              </span>
              <div>
                <h2 className="text-sm font-semibold text-foreground">{teamView ? "Team performance" : "Your performance"}</h2>
                <p className="text-xs text-muted-foreground">
                  {teamView ? "Every deal in the workspace" : "Deals you own or created"} · trends over the {rangePhrase}
                </p>
              </div>
            </div>
            <Segmented<RangeMonths>
              label="Trend range"
              value={rangeMonths}
              onChange={setRangeMonths}
              options={[
                { value: "6", label: "6 months" },
                { value: "12", label: "12 months" },
              ]}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Won this month"
              icon={Trophy}
              loading={loading}
              value={base ? money(base.thisMonth.value) : null}
              hint="Value of deals moved to a won stage since the 1st, compared with the same days of last month."
              delta={
                base
                  ? base.thisMonth.value === 0 && base.lastMonth.value === 0
                    ? { value: null, label: "", fallback: "Nothing won this month or the same days last month" }
                    : {
                        value: base.monthDelta.pct,
                        label: "vs same days last month",
                        fallback: `${base.thisMonth.count} won · none in the same days last month`,
                      }
                  : null
              }
              trend={ranged?.series.map((p) => ({ label: p.label, value: p.wonValue, display: money(p.wonValue) }))}
              trendLabel={`Won revenue per month, ${rangePhrase}`}
            />
            <KpiCard
              label="Open pipeline"
              icon={DollarSign}
              loading={loading}
              value={base ? money(base.openValue) : null}
              sub={base ? `${base.openCount} ${base.openCount === 1 ? "deal" : "deals"} · ${money(base.weighted)} weighted` : undefined}
              hint="Total value of every deal that isn't won or lost. Weighted = value × probability. The trend shows the value of new deals added each month."
              trend={ranged?.series.map((p) => ({ label: p.label, value: p.createdValue, display: `${money(p.createdValue)} added` }))}
              trendLabel={`New pipeline added per month, ${rangePhrase}`}
            />
            <KpiCard
              label="Win rate"
              icon={Percent}
              loading={loading}
              value={base && base.win.rate !== null ? formatPercent(base.win.rate) : null}
              unavailableReason={`No deals were won or lost in the last ${WINDOW_DAYS} days.`}
              hint={`Won ÷ (won + lost) for deals closed in the last ${WINDOW_DAYS} days, compared with the ${WINDOW_DAYS} days before.`}
              delta={
                base && base.win.rate !== null
                  ? {
                      value: rateDelta(base.win.rate, base.prevWin.rate),
                      kind: "pp",
                      label: `vs prior ${WINDOW_DAYS} days`,
                      fallback: `${base.win.won} won · ${base.win.lost} lost · last ${WINDOW_DAYS} days`,
                    }
                  : null
              }
              trend={ranged?.series.map((p) => ({ label: p.label, value: p.winRate, display: p.winRate === null ? "nothing closed" : formatPercent(p.winRate) }))}
              trendLabel={`Win rate per month, ${rangePhrase}`}
            />
            <KpiCard
              label="Average deal size"
              icon={Target}
              loading={loading}
              value={base && base.avgSize !== null ? money(base.avgSize) : null}
              unavailableReason={`No deals were won in the last ${WINDOW_DAYS} days.`}
              hint={`Average value of deals won in the last ${WINDOW_DAYS} days, compared with the ${WINDOW_DAYS} days before.`}
              delta={
                base && base.avgSize !== null
                  ? {
                      value: base.prevAvgSize ? periodDelta(base.avgSize, base.prevAvgSize).pct : null,
                      label: `vs prior ${WINDOW_DAYS} days`,
                      fallback: `Won deals · last ${WINDOW_DAYS} days`,
                    }
                  : null
              }
              trend={ranged?.series.map((p) => ({ label: p.label, value: p.avgDealSize, display: p.avgDealSize === null ? "no wins" : money(p.avgDealSize) }))}
              trendLabel={`Average won deal size per month, ${rangePhrase}`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            <RevenueTrendChart
              className="lg:col-span-8"
              title="Revenue trend"
              description={`Won revenue per month, ${rangePhrase}, against the ${months} months before`}
              points={ranged?.trend ?? []}
              currency={currency}
              loading={loading}
              error={error}
              onRetry={retry}
              previousLabel={`Previous ${months} months`}
              comparisonPhrase={`vs previous ${months} months`}
              emptyAction={
                <Button variant="outline" size="sm" onClick={() => navigate("/pipeline")}>
                  Open pipeline
                </Button>
              }
            />
            <WinLossCard
              className="lg:col-span-4"
              description={`Deals closed in the ${rangePhrase}`}
              won={ranged?.won ?? { count: 0, value: 0 }}
              lost={ranged?.lost ?? { count: 0, value: 0 }}
              series={ranged?.series}
              currency={currency}
              loading={loading}
              error={error}
              onRetry={retry}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            <PipelineFunnelChart
              className="lg:col-span-7"
              rows={funnel?.rows ?? []}
              flow={funnel?.flow}
              flowNote={flowNote}
              currency={currency}
              loading={loading}
              error={error}
              onRetry={retry}
              pipelines={data?.pipelines}
              pipelineId={funnel?.activePipelineId}
              onPipelineChange={setPipelineId}
              description={funnel?.flow?.hasHistory ? `Open deals by stage, with conversion for deals created in the ${rangePhrase}` : "Open deals in each stage right now"}
              emptyAction={
                <Button variant="outline" size="sm" onClick={() => navigate("/pipeline?new=1")}>
                  New deal
                </Button>
              }
            />
            <div className="space-y-6 lg:col-span-5">
              <ClosingSoon
                deals={base?.closing ?? []}
                currency={currency}
                loading={loading}
                error={error}
                onRetry={retry}
                onOpenDeal={(id) => navigate(`/pipeline?open=${id}`)}
                probabilityOf={data ? (d) => effectiveProbability(d, data.stagesById) : undefined}
                moreHref={hasForecast ? "/forecast" : "/pipeline"}
              />
              <MyTasks />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            <CloseMonthChart
              className="lg:col-span-7"
              months={base?.forecast.months ?? []}
              overdue={{ count: base?.forecast.overdue.length ?? 0, value: sumValue(base?.forecast.overdue ?? []) }}
              noDateCount={base?.forecast.noCloseDate.length ?? 0}
              currency={currency}
              loading={loading}
              error={error}
              onRetry={retry}
              forecastHref={hasForecast ? "/forecast" : undefined}
            />
            <div className="lg:col-span-5">
              <RecentActivity />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
