import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarRange, CalendarX2, CheckCircle2, Clock, Gauge, Layers, Scale, Target, UserRound, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PageBanner } from "@/components/PageBanner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/common/States";
import { UpgradePrompt } from "@/components/settings/UpgradePrompt";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { AnalyticsErrorState, SectionCard } from "@/components/dashboard/ChartParts";
import { ForecastChart } from "@/components/dashboard/ForecastChart";
import { LockedPreview } from "@/components/dashboard/ReportCharts";
import { ACCENT, VIZ_VARS, WON_COLOR } from "@/components/dashboard/chartTheme";
import { useNow } from "@/hooks/useNow";
import { formatCurrency, formatFriendlyDate, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import {
  BEST_CASE_THRESHOLD,
  COMMIT_THRESHOLD,
  STALE_DAYS,
  TOUCH_LOOKBACK_DAYS,
  type DealRisk,
  type ForecastCategory,
  type ForecastDeal,
  type ForecastMonth,
  buildForecast,
  dealRisk,
  monthAttainment,
  useAnalyticsRealtime,
  useDealActivityTouches,
  useWorkspaceAnalytics,
} from "@/hooks/useAnalytics";

const CATEGORY_META: Record<ForecastCategory, { label: string; opacity: number }> = {
  commit: { label: "Commit", opacity: 1 },
  best_case: { label: "Best case", opacity: 0.55 },
  pipeline: { label: "Pipeline", opacity: 0.25 },
};

type TabKey = string; // month key | "risk" | "overdue" | "undated" | "later"
type RiskedDeal = ForecastDeal & { risk: DealRisk };

export default function Forecast() {
  const { hasFeature } = useAuth();
  if (!hasFeature("forecast")) {
    return (
      <div className="mx-auto max-w-[1600px] space-y-6">
        <PageBanner title="Forecast" description="Open deals by expected close month, weighted by probability and measured against quota." />
        <LockedPreview>
          <UpgradePrompt feature="forecast" className="bg-card shadow-sm" />
        </LockedPreview>
      </div>
    );
  }
  return <ForecastView />;
}

function ForecastView() {
  const { organization, isAdmin, can } = useAuth();
  const navigate = useNavigate();
  const currency = organization?.currency || "ETB";
  const teamView = can("team.view_reports");
  // The quota is a workspace-wide target; reps only see their own deals, so it applies to the team view only.
  const quota = teamView ? Number(organization?.monthly_quota ?? 0) : 0;
  const [horizon, setHorizon] = useState<3 | 6>(6);
  const [tab, setTab] = useState<TabKey | null>(null);

  useAnalyticsRealtime();
  const analytics = useWorkspaceAnalytics();
  const touches = useDealActivityTouches();
  const data = analytics.data;
  const now = useNow();

  const forecast = useMemo(() => (data ? buildForecast(data.deals, data.stagesById, horizon, now) : null), [data, horizon, now]);

  const risked = useMemo(() => {
    if (!forecast) return null;
    const withRisk = (d: ForecastDeal): RiskedDeal => ({ ...d, risk: dealRisk(d, touches.data?.get(d.id), now) });
    const months = forecast.months.map((m) => ({ ...m, deals: m.deals.map(withRisk) }));
    const overdue = forecast.overdue.map(withRisk);
    const undated = forecast.noCloseDate.map(withRisk);
    const later = forecast.later.map(withRisk);
    const all = [...months.flatMap((m) => m.deals), ...overdue, ...undated, ...later];
    const atRisk = all
      .filter((d) => d.risk.overdue || d.risk.stale)
      .sort((a, b) => Number(b.risk.overdue) - Number(a.risk.overdue) || b.value - a.value);
    return { months, overdue, undated, later, atRisk, atRiskValue: atRisk.reduce((s, d) => s + d.value, 0) };
  }, [forecast, touches.data, now]);

  const loading = analytics.isLoading;
  const error = analytics.isError ? analytics.error : null;
  const defaultTab =
    risked?.months.find((m) => m.deals.length > 0)?.key ??
    (risked?.atRisk.length ? "risk" : risked?.undated.length ? "undated" : risked?.later.length ? "later" : risked?.months[0]?.key) ??
    "";
  const activeTab = tab ?? defaultTab;
  const openDeal = (id: string) => navigate(`/pipeline?open=${id}`);

  const tabDeals: RiskedDeal[] = !risked
    ? []
    : activeTab === "risk"
      ? risked.atRisk
      : activeTab === "overdue"
        ? risked.overdue
        : activeTab === "undated"
          ? risked.undated
          : activeTab === "later"
            ? risked.later
            : risked.months.find((m) => m.key === activeTab)?.deals ?? [];

  const hasAnyOpen = !!forecast && (forecast.totals.total > 0 || forecast.overdue.length + forecast.noCloseDate.length + forecast.later.length > 0);
  const money = (v: number) => formatCurrency(v, currency);

  return (
    <div className={cn("mx-auto max-w-[1600px] space-y-6", VIZ_VARS)}>
      <PageBanner
        title="Forecast"
        description={
          teamView
            ? "Open deals by expected close month, weighted by probability and measured against quota."
            : "Your open deals by expected close month, weighted by probability."
        }
      >
        <Select
          value={String(horizon)}
          onValueChange={(v) => {
            setHorizon(Number(v) as 3 | 6);
            setTab(null);
          }}
        >
          <SelectTrigger className="h-9 w-[150px]" aria-label="Forecast horizon">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">Next 3 months</SelectItem>
            <SelectItem value="6">Next 6 months</SelectItem>
          </SelectContent>
        </Select>
      </PageBanner>

      <div className="-mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-0.5 text-foreground">
          {teamView ? <Users className="h-3.5 w-3.5" aria-hidden /> : <UserRound className="h-3.5 w-3.5" aria-hidden />}
          {teamView ? "Whole workspace" : "Your deals"}
        </span>
        <span>
          Commit ≥ {COMMIT_THRESHOLD}% · Best case {BEST_CASE_THRESHOLD}–{COMMIT_THRESHOLD - 1}% · deal probability, else its stage's
        </span>
      </div>

      {error ? (
        <AnalyticsErrorState error={error} onRetry={() => analytics.refetch()} title="Couldn't load the forecast" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Commit"
              icon={CheckCircle2}
              loading={loading}
              value={forecast ? money(forecast.totals.commit) : null}
              sub={`${COMMIT_THRESHOLD}%+ probability`}
              hint={`Open deals closing in the next ${horizon} months with a probability of ${COMMIT_THRESHOLD}% or more.`}
            />
            <KpiCard
              label="Best case"
              icon={Target}
              loading={loading}
              value={forecast ? money(forecast.totals.commit + forecast.totals.bestCase) : null}
              sub={`Commit + ${BEST_CASE_THRESHOLD}–${COMMIT_THRESHOLD - 1}% deals`}
              hint={`Commit plus open deals at ${BEST_CASE_THRESHOLD}–${COMMIT_THRESHOLD - 1}% probability closing in the next ${horizon} months.`}
            />
            <KpiCard
              label="Weighted forecast"
              icon={Scale}
              loading={loading}
              value={forecast ? money(forecast.totals.weighted) : null}
              sub={forecast ? `of ${money(forecast.totals.total)} open` : "Value × probability"}
              hint="Each deal's value multiplied by its probability, for deals closing in the horizon."
            />
            <KpiCard
              label="At risk"
              icon={AlertTriangle}
              loading={loading}
              value={risked ? money(risked.atRiskValue) : null}
              sub={risked ? `${risked.atRisk.length} ${risked.atRisk.length === 1 ? "deal" : "deals"} overdue or idle` : undefined}
              hint={`Open deals whose close date has passed, or with no edit and no logged activity for more than ${STALE_DAYS} days.`}
            />
          </div>

          <SectionCard
            title="Forecast by close month"
            description={teamView ? "Open deals stacked by confidence, with expected revenue and your monthly quota" : "Your open deals stacked by confidence, with expected revenue"}
            table={
              forecast && forecast.totals.total + (forecast.months[0]?.won ?? 0) > 0
                ? {
                    columns: ["Month", "Won", "Commit", "Best case", "Pipeline", "Weighted", "Deals", ...(quota > 0 ? ["Expected vs quota"] : [])],
                    rows: forecast.months.map((m) => [
                      m.label,
                      money(m.won),
                      money(m.commit),
                      money(m.bestCase),
                      money(m.pipeline),
                      money(m.weighted),
                      m.deals.length,
                      ...(quota > 0 ? [formatPercent((m.won + m.weighted) / quota)] : []),
                    ]),
                  }
                : null
            }
          >
            {loading ? (
              <Skeleton className="h-[300px] w-full rounded-lg" />
            ) : !forecast || forecast.totals.total + (forecast.months[0]?.won ?? 0) === 0 ? (
              <EmptyState
                compact
                icon={CalendarRange}
                title={`No open deals closing in the next ${horizon} months`}
                description="Add close dates and probabilities to your open deals to build a forecast."
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link to="/pipeline">Go to pipeline</Link>
                  </Button>
                }
              />
            ) : (
              <ForecastChart months={forecast.months} quota={quota} currency={currency} onSelectMonth={setTab} />
            )}
          </SectionCard>

          {teamView && <QuotaMonths loading={loading} months={forecast?.months ?? []} quota={quota} currency={currency} isAdmin={isAdmin} />}

          <SectionCard title="Deals" description="Pick a month, or review deals that need attention" bodyClassName="px-0 pb-2 sm:px-0">
            {loading ? (
              <div className="space-y-2 px-4 sm:px-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !risked || !hasAnyOpen ? (
              <EmptyState
                compact
                icon={Gauge}
                title="No open deals"
                description="Create deals with close dates and probabilities to forecast revenue."
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link to="/pipeline?new=1">New deal</Link>
                  </Button>
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto px-4 sm:px-5">
                  <Tabs value={activeTab} onValueChange={setTab}>
                    <TabsList>
                      {risked.months.map((m) => (
                        <TabsTrigger key={m.key} value={m.key} className="text-xs">
                          {m.label}
                          <span className="tabular-nums text-muted-foreground">{m.deals.length}</span>
                        </TabsTrigger>
                      ))}
                      {risked.atRisk.length > 0 && (
                        <TabsTrigger value="risk" className="text-xs">
                          <AlertTriangle className="text-warning" aria-hidden />
                          At risk
                          <span className="tabular-nums text-muted-foreground">{risked.atRisk.length}</span>
                        </TabsTrigger>
                      )}
                      {risked.undated.length > 0 && (
                        <TabsTrigger value="undated" className="text-xs">
                          <CalendarX2 aria-hidden />
                          No close date
                          <span className="tabular-nums text-muted-foreground">{risked.undated.length}</span>
                        </TabsTrigger>
                      )}
                      {risked.later.length > 0 && (
                        <TabsTrigger value="later" className="text-xs">
                          Later
                          <span className="tabular-nums text-muted-foreground">{risked.later.length}</span>
                        </TabsTrigger>
                      )}
                    </TabsList>
                  </Tabs>
                </div>
                {activeTab === "risk" && (
                  <p className="mt-3 px-4 text-xs text-muted-foreground sm:px-5">
                    Past their close date, or untouched for more than {STALE_DAYS} days (no edits and no logged activity). Update the date, log a
                    follow-up, or close them to keep the forecast honest.
                  </p>
                )}
                {activeTab === "undated" && (
                  <p className="mt-3 px-4 text-xs text-muted-foreground sm:px-5">These open deals have no close date, so they aren't in any month above.</p>
                )}
                <DealTable deals={tabDeals} currency={currency} onOpen={openDeal} />
              </>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}

/** One tile per month: won + commit against quota, with the expected (won + weighted) marker. */
function QuotaMonths({
  loading,
  months,
  quota,
  currency,
  isAdmin,
}: {
  loading: boolean;
  months: ForecastMonth[];
  quota: number;
  currency: string;
  isAdmin: boolean;
}) {
  if (loading) return <Skeleton className="h-[132px] w-full rounded-xl" />;

  if (!quota || quota <= 0) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-dashed border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
            <Target className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Set a monthly quota</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {isAdmin
                ? "Add your team's monthly target to see attainment for every month in the forecast."
                : "Ask a workspace admin to set a monthly quota to track attainment here."}
            </p>
          </div>
        </div>
        {isAdmin && (
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link to="/settings?tab=workspace">Set quota</Link>
          </Button>
        )}
      </section>
    );
  }

  return (
    <SectionCard
      title="Quota attainment by month"
      description={`Monthly quota ${formatCurrency(quota, currency)} · won so far, commit still to close, and the expected total (won + weighted)`}
    >
      <ul className={cn("grid gap-3 sm:grid-cols-3", months.length > 3 && "lg:grid-cols-6")}>
        {months.map((m, i) => {
          const a = monthAttainment(m, quota)!;
          const expected = m.won + m.weighted;
          const gap = quota - expected;
          const wonW = Math.min(a.wonPct, 1) * 100;
          const commitW = Math.max(Math.min(a.commitPct, 1) * 100 - wonW, 0);
          const marker = Math.min(a.projectedPct, 1) * 100;
          return (
            <li key={m.key} className="rounded-lg border border-border p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {m.label}
                  {i === 0 ? " · now" : ""}
                </span>
                <span className="text-lg font-semibold text-foreground">{formatPercent(a.projectedPct)}</span>
              </div>
              <div
                className="relative mt-2 h-2.5 w-full rounded-full"
                style={{ backgroundColor: `color-mix(in srgb, ${ACCENT} 14%, transparent)` }}
                role="meter"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(Math.min(a.projectedPct, 1) * 100)}
                aria-label={`${m.label}: expected ${formatPercent(a.projectedPct)} of quota; won ${formatPercent(a.wonPct)}; commit covers ${formatPercent(a.commitPct)}`}
              >
                <div className="absolute inset-y-0 left-0 flex overflow-hidden rounded-full" style={{ width: `${wonW + commitW}%` }}>
                  {wonW > 0 && <div className="h-full" style={{ width: `${(wonW / (wonW + commitW)) * 100}%`, backgroundColor: WON_COLOR }} />}
                  {commitW > 0 && <div className="h-full flex-1" style={{ backgroundColor: ACCENT }} />}
                </div>
                <span
                  aria-hidden
                  className="absolute -top-1 h-[18px] w-0.5 -translate-x-1/2 rounded-full bg-foreground"
                  style={{ left: `${Math.max(marker, 0.5)}%` }}
                />
              </div>
              <dl className="mt-2.5 space-y-0.5 text-[11px] text-muted-foreground">
                {m.won > 0 && (
                  <div className="flex justify-between gap-2">
                    <dt>Won</dt>
                    <dd className="tabular-nums text-foreground">{formatCurrency(m.won, currency)}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <dt>Commit covers</dt>
                  <dd className="tabular-nums text-foreground">{formatPercent(a.commitPct)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>{gap > 0 ? "Gap to quota" : "Above quota"}</dt>
                  <dd className={cn("tabular-nums", gap > 0 ? "text-foreground" : "text-success")}>{formatCurrency(Math.abs(gap), currency)}</dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: WON_COLOR }} /> Won
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: ACCENT }} /> Commit
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-0.5 rounded-full bg-foreground" /> Expected (won + weighted)
        </span>
      </div>
    </SectionCard>
  );
}

function ProbabilityChip({ deal }: { deal: ForecastDeal }) {
  const meta = CATEGORY_META[deal.category];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-xs">
      <span
        aria-hidden
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: meta.opacity < 1 ? `color-mix(in srgb, ${ACCENT} ${Math.round(meta.opacity * 100)}%, transparent)` : ACCENT }}
      />
      <span className="tabular-nums text-foreground">{deal.effectiveProbability === null ? "—" : `${deal.effectiveProbability}%`}</span>
      <span className="text-muted-foreground">{meta.label}</span>
    </span>
  );
}

function RiskFlags({ risk }: { risk: DealRisk }) {
  if (!risk.overdue && !risk.stale) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {risk.overdue && (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-xs text-foreground">
          <AlertTriangle className="h-3 w-3 text-warning" aria-hidden />
          {risk.overdueDays === 1 ? "1 day overdue" : `${risk.overdueDays} days overdue`}
        </span>
      )}
      {risk.stale && (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-border bg-secondary px-1.5 py-0.5 text-xs text-foreground">
          <Clock className="h-3 w-3 text-muted-foreground" aria-hidden />
          {risk.idleDays !== null && risk.idleDays > TOUCH_LOOKBACK_DAYS ? `Idle ${TOUCH_LOOKBACK_DAYS}+ days` : `Idle ${risk.idleDays} days`}
        </span>
      )}
    </span>
  );
}

function DealTable({ deals, currency, onOpen }: { deals: RiskedDeal[]; currency: string; onOpen: (id: string) => void }) {
  if (deals.length === 0) {
    return <EmptyState compact icon={Layers} title="No deals here" description="No open deals are expected to close in this month." />;
  }
  const total = deals.reduce((s, d) => s + d.value, 0);
  const weighted = deals.reduce((s, d) => s + d.weighted, 0);
  return (
    <div className="mt-3 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4 sm:pl-5">Deal</TableHead>
            <TableHead>Close date</TableHead>
            <TableHead>Probability</TableHead>
            <TableHead>Risk</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead className="pr-4 text-right sm:pr-5">Weighted</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deals.map((d) => (
            <TableRow
              key={d.id}
              className="cursor-pointer"
              tabIndex={0}
              onClick={() => onOpen(d.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(d.id);
                }
              }}
            >
              <TableCell className="max-w-[260px] pl-4 sm:pl-5">
                <div className="truncate text-sm font-medium text-foreground">{d.title}</div>
                {d.company_name && <div className="truncate text-xs text-muted-foreground">{d.company_name}</div>}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">
                {d.close_date ? formatFriendlyDate(d.close_date) : <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell>
                <ProbabilityChip deal={d} />
              </TableCell>
              <TableCell>
                <RiskFlags risk={d.risk} />
              </TableCell>
              <TableCell className="text-right text-sm font-medium tabular-nums">{formatCurrency(d.value, currency)}</TableCell>
              <TableCell className="pr-4 text-right text-sm tabular-nums text-muted-foreground sm:pr-5">{formatCurrency(d.weighted, currency)}</TableCell>
            </TableRow>
          ))}
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={4} className="pl-4 text-xs font-medium text-muted-foreground sm:pl-5">
              {deals.length} {deals.length === 1 ? "deal" : "deals"}
            </TableCell>
            <TableCell className="text-right text-sm font-semibold tabular-nums">{formatCurrency(total, currency)}</TableCell>
            <TableCell className="pr-4 text-right text-sm font-semibold tabular-nums sm:pr-5">{formatCurrency(weighted, currency)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
