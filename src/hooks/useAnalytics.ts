import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  endOfDay,
  format,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subDays,
} from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/*
 * Workspace analytics: data loading (paged past PostgREST's 1000-row cap) plus PURE metric
 * functions. Every number on the dashboard, reports and forecast pages comes from here.
 * The pure functions never invent values: when a metric can't be computed they return null.
 */

// ---------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------

export interface AnalyticsPipeline {
  id: string;
  name: string;
  created_at: string;
}

export interface AnalyticsStage {
  id: string;
  pipeline_id: string;
  name: string;
  color: string | null;
  position: number;
  probability: number | null;
  is_won: boolean;
  is_lost: boolean;
}

export interface AnalyticsDeal {
  id: string;
  title: string;
  value: number;
  probability: number | null;
  stage_id: string;
  pipeline_id: string;
  owner_id: string | null;
  close_date: string | null;
  created_at: string;
  won_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  company_name: string | null;
  /** Last edit of the deal row (optional so hand-built fixtures stay small). */
  updated_at?: string | null;
}

export interface AnalyticsActivity {
  id: string;
  type: string;
  created_at: string;
  user_id: string | null;
  deal_id?: string | null;
}

export interface WorkspaceMember {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  job_title: string | null;
  role: string;
  joined_at: string | null;
}

export type DealStatus = "open" | "won" | "lost";

/** Half-open range: start <= t < end. */
export interface DateRange {
  start: Date;
  end: Date;
}

export type StagesById = Map<string, AnalyticsStage>;

// ---------------------------------------------------------------------------------------------
// Paging helper
// ---------------------------------------------------------------------------------------------

export const FETCH_ALL_PAGE_SIZE = 1000;
export const FETCH_ALL_MAX_ROWS = 100_000;

/** A query returned more rows than `fetchAll` loads. Thrown (never truncated) so no metric is silently wrong. */
export class AnalyticsRowLimitError extends Error {
  readonly limit: number;
  constructor(limit: number) {
    super(
      `This workspace has more than ${limit.toLocaleString()} records for this view, which is more than analytics can load at once, so the numbers would be incomplete.`,
    );
    this.name = "AnalyticsRowLimitError";
    this.limit = limit;
  }
}

/** Retry like the app default (once), but not when the data is over the row limit: a retry can't help. */
export function retryUnlessRowLimit(failureCount: number, error: unknown): boolean {
  return !(error instanceof AnalyticsRowLimitError) && failureCount < 1;
}

/**
 * Loads every row of a query by walking `.range(from, to)` pages until a short page comes back.
 * `makePage` must apply a stable order (e.g. `.order("id")`) so pages don't overlap, and should
 * pass `signal` to `.abortSignal()` so a cancelled query stops its in-flight request too.
 * Throws AnalyticsRowLimitError past `maxRows` rows.
 */
export async function fetchAll<T>(
  makePage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  { signal, pageSize = FETCH_ALL_PAGE_SIZE, maxRows = FETCH_ALL_MAX_ROWS }: { signal?: AbortSignal; pageSize?: number; maxRows?: number } = {},
): Promise<T[]> {
  // TanStack Query aborts the signal when it cancels or restarts the query: stop paging.
  // (Same as signal.throwIfAborted(), which older Safari and jsdom don't have.)
  const checkAborted = () => {
    if (signal?.aborted) throw signal.reason ?? new Error("Cancelled");
  };
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    checkAborted();
    const { data, error } = await makePage(from, from + pageSize - 1);
    checkAborted();
    if (error) throw error;
    const page = data ?? [];
    if (rows.length + page.length > maxRows) throw new AnalyticsRowLimitError(maxRows);
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

// ---------------------------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------------------------

function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Parses a `date` column ("2026-03-04") as a LOCAL date; timestamps are parsed normally. */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function inRange(value: string | Date | null | undefined, range: DateRange): boolean {
  const d = value instanceof Date ? value : parseDate(value);
  if (!d) return false;
  const t = d.getTime();
  return t >= range.start.getTime() && t < range.end.getTime();
}

export function buildStagesById(stages: AnalyticsStage[]): StagesById {
  return new Map(stages.map((s) => [s.id, s]));
}

/** Won/lost comes from the stage flags; won_at/lost_at only as a fallback for unknown stages. */
export function dealStatus(deal: AnalyticsDeal, stagesById: StagesById): DealStatus {
  const stage = stagesById.get(deal.stage_id);
  if (stage) return stage.is_won ? "won" : stage.is_lost ? "lost" : "open";
  if (deal.won_at) return "won";
  if (deal.lost_at) return "lost";
  return "open";
}

/** Deal probability, falling back to its stage's probability; null when neither is set. */
export function effectiveProbability(deal: AnalyticsDeal, stagesById: StagesById): number | null {
  if (deal.probability !== null && deal.probability !== undefined) return toNumber(deal.probability);
  const p = stagesById.get(deal.stage_id)?.probability;
  return p === null || p === undefined ? null : toNumber(p);
}

export function openDeals(deals: AnalyticsDeal[], stagesById: StagesById): AnalyticsDeal[] {
  return deals.filter((d) => dealStatus(d, stagesById) === "open");
}

export function sumValue(deals: AnalyticsDeal[]): number {
  return deals.reduce((s, d) => s + toNumber(d.value), 0);
}

export function openPipelineValue(deals: AnalyticsDeal[], stagesById: StagesById): number {
  return sumValue(openDeals(deals, stagesById));
}

export function weightedValue(deal: AnalyticsDeal, stagesById: StagesById): number {
  const p = effectiveProbability(deal, stagesById);
  return p === null ? 0 : (toNumber(deal.value) * Math.min(Math.max(p, 0), 100)) / 100;
}

export function weightedPipelineValue(deals: AnalyticsDeal[], stagesById: StagesById): number {
  return openDeals(deals, stagesById).reduce((s, d) => s + weightedValue(d, stagesById), 0);
}

/** Deals won with won_at inside the range (won deals without won_at can't be placed in time). */
export function wonDealsIn(deals: AnalyticsDeal[], stagesById: StagesById, range?: DateRange): AnalyticsDeal[] {
  return deals.filter((d) => dealStatus(d, stagesById) === "won" && (!range || inRange(d.won_at, range)));
}

export function lostDealsIn(deals: AnalyticsDeal[], stagesById: StagesById, range?: DateRange): AnalyticsDeal[] {
  return deals.filter((d) => dealStatus(d, stagesById) === "lost" && (!range || inRange(d.lost_at, range)));
}

export function wonRevenue(deals: AnalyticsDeal[], stagesById: StagesById, range?: DateRange): { count: number; value: number } {
  const won = wonDealsIn(deals, stagesById, range);
  return { count: won.length, value: sumValue(won) };
}

/** won / (won + lost) for deals closed in the range; rate is null when nothing closed. */
export function winRate(
  deals: AnalyticsDeal[],
  stagesById: StagesById,
  range?: DateRange,
): { won: number; lost: number; rate: number | null } {
  const won = wonDealsIn(deals, stagesById, range).length;
  const lost = lostDealsIn(deals, stagesById, range).length;
  return { won, lost, rate: won + lost > 0 ? won / (won + lost) : null };
}

export function averageDealSize(deals: AnalyticsDeal[], stagesById: StagesById, range?: DateRange): number | null {
  const won = wonDealsIn(deals, stagesById, range);
  return won.length ? sumValue(won) / won.length : null;
}

/** Days from created_at to won_at for each won deal (in the range) that has both dates. */
export function salesCycleDays(deals: AnalyticsDeal[], stagesById: StagesById, range?: DateRange): number[] {
  const cycles: number[] = [];
  for (const d of wonDealsIn(deals, stagesById, range)) {
    const created = parseDate(d.created_at);
    const won = parseDate(d.won_at);
    if (!created || !won || won < created) continue;
    cycles.push((won.getTime() - created.getTime()) / 86_400_000);
  }
  return cycles;
}

/** Mean days from created_at to won_at across won deals that have both; null when none do. */
export function averageSalesCycleDays(deals: AnalyticsDeal[], stagesById: StagesById, range?: DateRange): number | null {
  const cycles = salesCycleDays(deals, stagesById, range);
  if (!cycles.length) return null;
  return cycles.reduce((a, b) => a + b, 0) / cycles.length;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface StageBreakdownRow {
  id: string;
  name: string;
  color: string | null;
  position: number;
  isWon: boolean;
  isLost: boolean;
  count: number;
  value: number;
  weighted: number;
}

/**
 * Current distribution of deals across a pipeline's stages, in position order.
 * (A distribution, not a conversion funnel: deals don't keep their stage history here.)
 */
export function stageBreakdown(
  deals: AnalyticsDeal[],
  stages: AnalyticsStage[],
  pipelineId: string | null | undefined,
  opts: { includeClosed?: boolean } = {},
): StageBreakdownRow[] {
  const pipelineStages = stages
    .filter((s) => !pipelineId || s.pipeline_id === pipelineId)
    .filter((s) => opts.includeClosed || (!s.is_won && !s.is_lost))
    .sort((a, b) => a.position - b.position);
  const byStage = new Map<string, StageBreakdownRow>(
    pipelineStages.map((s) => [
      s.id,
      { id: s.id, name: s.name, color: s.color, position: s.position, isWon: s.is_won, isLost: s.is_lost, count: 0, value: 0, weighted: 0 },
    ]),
  );
  const stagesById = buildStagesById(stages);
  for (const d of deals) {
    const row = byStage.get(d.stage_id);
    if (!row) continue;
    row.count += 1;
    row.value += toNumber(d.value);
    row.weighted += weightedValue(d, stagesById);
  }
  return [...byStage.values()];
}

export interface MonthlyPoint {
  key: string; // yyyy-MM
  label: string; // "Apr" / "Apr 2025"
  value: number;
  count: number;
}

/** Won revenue per calendar month (bucketed by won_at) for the last `months` months incl. the current one. */
export function monthlyWonRevenue(deals: AnalyticsDeal[], stagesById: StagesById, months: number, now = new Date()): MonthlyPoint[] {
  const first = addMonths(startOfMonth(now), -(months - 1));
  const points: MonthlyPoint[] = [];
  for (let i = 0; i < months; i++) {
    const m = addMonths(first, i);
    points.push({
      key: format(m, "yyyy-MM"),
      label: format(m, m.getFullYear() === now.getFullYear() ? "MMM" : "MMM yy"),
      value: 0,
      count: 0,
    });
  }
  const index = new Map(points.map((p, i) => [p.key, i]));
  for (const d of wonDealsIn(deals, stagesById, { start: first, end: addMonths(startOfMonth(now), 1) })) {
    const won = parseDate(d.won_at);
    if (!won) continue;
    const i = index.get(format(won, "yyyy-MM"));
    if (i === undefined) continue;
    points[i].value += toNumber(d.value);
    points[i].count += 1;
  }
  return points;
}

/** Change vs a previous value. `pct` is null when the previous value is 0 (no honest percentage). */
export function periodDelta(current: number, previous: number): { abs: number; pct: number | null } {
  return { abs: current - previous, pct: previous !== 0 ? (current - previous) / Math.abs(previous) : null };
}

// ---------------------------------------------------------------------------------------------
// Periods
// ---------------------------------------------------------------------------------------------

export type ReportPeriod = "this_month" | "last_month" | "this_quarter" | "this_year" | "last_12_months";

export const REPORT_PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_quarter", label: "This quarter" },
  { value: "this_year", label: "This year" },
  { value: "last_12_months", label: "Last 12 months" },
];

export function getPeriodRange(period: ReportPeriod, now = new Date()): DateRange {
  const tomorrow = startOfDay(addDays(now, 1));
  switch (period) {
    case "this_month":
      return { start: startOfMonth(now), end: tomorrow };
    case "last_month":
      return { start: addMonths(startOfMonth(now), -1), end: startOfMonth(now) };
    case "this_quarter":
      return { start: startOfQuarter(now), end: tomorrow };
    case "this_year":
      return { start: startOfYear(now), end: tomorrow };
    case "last_12_months":
      return { start: addMonths(startOfMonth(now), -11), end: tomorrow };
  }
}

/**
 * The comparable earlier period: calendar periods compare to the same elapsed span of the
 * previous period (month-to-date vs the same days of last month); others shift back by their length.
 */
export function getPreviousPeriodRange(period: ReportPeriod, now = new Date()): DateRange {
  const cur = getPeriodRange(period, now);
  const shiftMonths = period === "this_month" || period === "last_month" ? 1 : period === "this_quarter" ? 3 : 12;
  const start = addMonths(cur.start, -shiftMonths);
  // Shift today (not tomorrow) back, then include it: Oct 30 → through Sep 30, Mar 29 → through Feb 28.
  let end = startOfDay(addDays(addMonths(startOfDay(now), -shiftMonths), 1));
  // Never spill into the current period (e.g. the 31st vs a 30-day month, or "last month").
  if (end > cur.start) end = cur.start;
  return { start, end };
}

// ---------------------------------------------------------------------------------------------
// Reports breakdowns
// ---------------------------------------------------------------------------------------------

export interface OwnerStats {
  ownerId: string | null;
  wonCount: number;
  wonValue: number;
  lostCount: number;
  openCount: number;
  openValue: number;
  winRate: number | null;
}

/** Per-owner won/lost in the range plus their current open pipeline; sorted by won value. */
export function ownerLeaderboard(deals: AnalyticsDeal[], stagesById: StagesById, range: DateRange): OwnerStats[] {
  const rows = new Map<string, OwnerStats>();
  const get = (ownerId: string | null) => {
    const key = ownerId ?? "__none__";
    let r = rows.get(key);
    if (!r) {
      r = { ownerId, wonCount: 0, wonValue: 0, lostCount: 0, openCount: 0, openValue: 0, winRate: null };
      rows.set(key, r);
    }
    return r;
  };
  for (const d of deals) {
    const status = dealStatus(d, stagesById);
    if (status === "open") {
      const r = get(d.owner_id);
      r.openCount += 1;
      r.openValue += toNumber(d.value);
    } else if (status === "won" && inRange(d.won_at, range)) {
      const r = get(d.owner_id);
      r.wonCount += 1;
      r.wonValue += toNumber(d.value);
    } else if (status === "lost" && inRange(d.lost_at, range)) {
      get(d.owner_id).lostCount += 1;
    }
  }
  const out = [...rows.values()].map((r) => ({
    ...r,
    winRate: r.wonCount + r.lostCount > 0 ? r.wonCount / (r.wonCount + r.lostCount) : null,
  }));
  return out.sort((a, b) => b.wonValue - a.wonValue || b.wonCount - a.wonCount || b.openValue - a.openValue);
}

export const NO_LOST_REASON = "No reason given";

export function lostReasonBreakdown(
  deals: AnalyticsDeal[],
  stagesById: StagesById,
  range?: DateRange,
): { reason: string; count: number; value: number }[] {
  const rows = new Map<string, { reason: string; count: number; value: number }>();
  for (const d of lostDealsIn(deals, stagesById, range)) {
    const raw = (d.lost_reason ?? "").trim();
    const reason = raw || NO_LOST_REASON;
    const key = reason.toLowerCase();
    const r = rows.get(key) ?? { reason, count: 0, value: 0 };
    r.count += 1;
    r.value += toNumber(d.value);
    rows.set(key, r);
  }
  return [...rows.values()].sort((a, b) => b.count - a.count || b.value - a.value);
}

export const ACTIVITY_TYPES = ["call", "email", "meeting", "note"] as const;

export function activityCountsByType(activities: AnalyticsActivity[]): { type: string; count: number }[] {
  const counts = new Map<string, number>(ACTIVITY_TYPES.map((t) => [t, 0]));
  for (const a of activities) counts.set(a.type, (counts.get(a.type) ?? 0) + 1);
  return [...counts.entries()].map(([type, count]) => ({ type, count }));
}

// ---------------------------------------------------------------------------------------------
// Forecast
// ---------------------------------------------------------------------------------------------

/** Forecast categories by (deal or stage) probability. */
export const COMMIT_THRESHOLD = 70;
export const BEST_CASE_THRESHOLD = 40;
export type ForecastCategory = "commit" | "best_case" | "pipeline";

export function forecastCategory(deal: AnalyticsDeal, stagesById: StagesById): ForecastCategory {
  const p = effectiveProbability(deal, stagesById);
  if (p !== null && p >= COMMIT_THRESHOLD) return "commit";
  if (p !== null && p >= BEST_CASE_THRESHOLD) return "best_case";
  return "pipeline";
}

export interface ForecastDeal extends AnalyticsDeal {
  category: ForecastCategory;
  effectiveProbability: number | null;
  weighted: number;
}

export interface ForecastMonth {
  key: string;
  label: string;
  /** Revenue already won in this month (only the current month can have any). */
  won: number;
  commit: number;
  bestCase: number;
  pipeline: number;
  total: number;
  weighted: number;
  deals: ForecastDeal[];
}

export interface ForecastResult {
  months: ForecastMonth[];
  /** Open deals whose close date has already passed. */
  overdue: ForecastDeal[];
  /** Open deals without a close date. */
  noCloseDate: ForecastDeal[];
  /** Open deals closing after the horizon. */
  later: ForecastDeal[];
  totals: { commit: number; bestCase: number; pipeline: number; total: number; weighted: number };
}

/** Open deals grouped by close-date month for the current month + the next `months - 1`. */
export function buildForecast(deals: AnalyticsDeal[], stagesById: StagesById, months: number, now = new Date()): ForecastResult {
  const firstMonth = startOfMonth(now);
  const today = startOfDay(now);
  const horizonEnd = addMonths(firstMonth, months);
  const result: ForecastResult = {
    months: Array.from({ length: months }, (_, i) => {
      const m = addMonths(firstMonth, i);
      return {
        key: format(m, "yyyy-MM"),
        label: format(m, m.getFullYear() === now.getFullYear() ? "MMM" : "MMM yyyy"),
        won: 0,
        commit: 0,
        bestCase: 0,
        pipeline: 0,
        total: 0,
        weighted: 0,
        deals: [],
      };
    }),
    overdue: [],
    noCloseDate: [],
    later: [],
    totals: { commit: 0, bestCase: 0, pipeline: 0, total: 0, weighted: 0 },
  };
  const index = new Map(result.months.map((m, i) => [m.key, i]));
  if (result.months.length) {
    result.months[0].won = wonRevenue(deals, stagesById, { start: firstMonth, end: addMonths(firstMonth, 1) }).value;
  }

  for (const d of openDeals(deals, stagesById)) {
    const fd: ForecastDeal = {
      ...d,
      category: forecastCategory(d, stagesById),
      effectiveProbability: effectiveProbability(d, stagesById),
      weighted: weightedValue(d, stagesById),
    };
    const close = parseDate(d.close_date);
    if (!close) {
      result.noCloseDate.push(fd);
      continue;
    }
    if (close < today) {
      result.overdue.push(fd);
      continue;
    }
    if (close >= horizonEnd) {
      result.later.push(fd);
      continue;
    }
    const i = index.get(format(close, "yyyy-MM"));
    if (i === undefined) continue;
    const m = result.months[i];
    const v = toNumber(d.value);
    if (fd.category === "commit") m.commit += v;
    else if (fd.category === "best_case") m.bestCase += v;
    else m.pipeline += v;
    m.total += v;
    m.weighted += fd.weighted;
    m.deals.push(fd);
  }

  for (const m of result.months) {
    m.deals.sort((a, b) => (a.close_date ?? "").localeCompare(b.close_date ?? "") || b.value - a.value);
    result.totals.commit += m.commit;
    result.totals.bestCase += m.bestCase;
    result.totals.pipeline += m.pipeline;
    result.totals.total += m.total;
    result.totals.weighted += m.weighted;
  }
  result.overdue.sort((a, b) => (a.close_date ?? "").localeCompare(b.close_date ?? ""));
  result.noCloseDate.sort((a, b) => b.value - a.value);
  return result;
}

/** Open deals with a close date from today through `days` days ahead, soonest first. */
export function closingSoon(deals: AnalyticsDeal[], stagesById: StagesById, days = 30, now = new Date()): AnalyticsDeal[] {
  const range = { start: startOfDay(now), end: endOfDay(addDays(now, days)) };
  return openDeals(deals, stagesById)
    .filter((d) => inRange(d.close_date, range))
    .sort((a, b) => (a.close_date ?? "").localeCompare(b.close_date ?? "") || b.value - a.value);
}

export function daysUntil(date: string | null | undefined, now = new Date()): number | null {
  const d = parseDate(date);
  return d ? differenceInCalendarDays(d, now) : null;
}

// ---------------------------------------------------------------------------------------------
// Time series (trends, sparklines, period comparison)
// ---------------------------------------------------------------------------------------------

export type BucketUnit = "week" | "month";

export interface TimeBucket {
  key: string;
  label: string;
  start: Date;
  end: Date;
}

/** Weeks for spans up to ~100 days (month / quarter), months beyond that. */
export function pickBucketUnit(range: DateRange): BucketUnit {
  return differenceInCalendarDays(range.end, range.start) <= 100 ? "week" : "month";
}

/**
 * Consecutive buckets covering a half-open range. Weeks start on Monday; the first and last
 * buckets are clipped to the range so nothing outside it is counted.
 */
export function timeBuckets(range: DateRange, unit: BucketUnit): TimeBucket[] {
  const buckets: TimeBucket[] = [];
  const crossesYear = range.start.getFullYear() !== new Date(range.end.getTime() - 1).getFullYear();
  let cursor = unit === "week" ? startOfWeek(range.start, { weekStartsOn: 1 }) : startOfMonth(range.start);
  let guard = 0;
  while (cursor < range.end && guard++ < 520) {
    const next = unit === "week" ? addWeeks(cursor, 1) : addMonths(cursor, 1);
    const start = cursor < range.start ? range.start : cursor;
    const end = next > range.end ? range.end : next;
    buckets.push({
      key: format(cursor, unit === "week" ? "yyyy-MM-dd" : "yyyy-MM"),
      label: unit === "week" ? format(start, "MMM d") : format(cursor, crossesYear ? "MMM yy" : "MMM"),
      start,
      end,
    });
    cursor = next;
  }
  return buckets;
}

/** The last `months` calendar months including the current one (the current month runs to tomorrow). */
export function lastMonthsBuckets(months: number, now = new Date()): TimeBucket[] {
  const start = addMonths(startOfMonth(now), -(months - 1));
  return timeBuckets({ start, end: startOfDay(addDays(now, 1)) }, "month");
}

export interface PerformancePoint {
  key: string;
  label: string;
  start: Date;
  end: Date;
  wonValue: number;
  wonCount: number;
  lostValue: number;
  lostCount: number;
  /** won / (won + lost) in the bucket; null when nothing closed. */
  winRate: number | null;
  avgDealSize: number | null;
  avgCycleDays: number | null;
  createdCount: number;
  createdValue: number;
}

function bucketIndex(buckets: { start: Date; end: Date }[], value: string | Date | null | undefined): number {
  const d = value instanceof Date ? value : parseDate(value);
  if (!d) return -1;
  const t = d.getTime();
  // Buckets are few (at most ~60); a linear scan is simplest and fast enough.
  for (let i = 0; i < buckets.length; i++) {
    if (t >= buckets[i].start.getTime() && t < buckets[i].end.getTime()) return i;
  }
  return -1;
}

/** Won, lost, created and cycle metrics per bucket. Won/lost are placed by won_at / lost_at. */
export function performanceSeries(deals: AnalyticsDeal[], stagesById: StagesById, buckets: TimeBucket[]): PerformancePoint[] {
  const points: PerformancePoint[] = buckets.map((b) => ({
    ...b,
    wonValue: 0,
    wonCount: 0,
    lostValue: 0,
    lostCount: 0,
    winRate: null,
    avgDealSize: null,
    avgCycleDays: null,
    createdCount: 0,
    createdValue: 0,
  }));
  if (!points.length) return points;
  const cycleSums = points.map(() => ({ sum: 0, n: 0 }));
  for (const d of deals) {
    const v = toNumber(d.value);
    const ci = bucketIndex(points, d.created_at);
    if (ci >= 0) {
      points[ci].createdCount += 1;
      points[ci].createdValue += v;
    }
    const status = dealStatus(d, stagesById);
    if (status === "won") {
      const i = bucketIndex(points, d.won_at);
      if (i < 0) continue;
      points[i].wonCount += 1;
      points[i].wonValue += v;
      const created = parseDate(d.created_at);
      const won = parseDate(d.won_at);
      if (created && won && won >= created) {
        cycleSums[i].sum += (won.getTime() - created.getTime()) / 86_400_000;
        cycleSums[i].n += 1;
      }
    } else if (status === "lost") {
      const i = bucketIndex(points, d.lost_at);
      if (i < 0) continue;
      points[i].lostCount += 1;
      points[i].lostValue += v;
    }
  }
  points.forEach((p, i) => {
    const closed = p.wonCount + p.lostCount;
    p.winRate = closed ? p.wonCount / closed : null;
    p.avgDealSize = p.wonCount ? p.wonValue / p.wonCount : null;
    p.avgCycleDays = cycleSums[i].n ? cycleSums[i].sum / cycleSums[i].n : null;
  });
  return points;
}

/** Difference between two rates in percentage points (as a ratio); null when either is missing. */
export function rateDelta(current: number | null, previous: number | null): number | null {
  return current === null || previous === null ? null : current - previous;
}

// ---------------------------------------------------------------------------------------------
// Distributions
// ---------------------------------------------------------------------------------------------

/** 1–2.5–5 bucket edges; the histogram keeps only the span the data actually covers. */
const VALUE_EDGES = [0, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000];

export interface HistogramBin {
  key: string;
  /** Inclusive lower bound. */
  min: number;
  /** Exclusive upper bound; null = open-ended. */
  max: number | null;
  count: number;
  total: number;
}

export function valueHistogram(values: number[]): HistogramBin[] {
  const clean = values.map(toNumber).filter((v) => v >= 0);
  if (!clean.length) return [];
  const bins: HistogramBin[] = VALUE_EDGES.map((min, i) => ({
    key: String(min),
    min,
    max: i + 1 < VALUE_EDGES.length ? VALUE_EDGES[i + 1] : null,
    count: 0,
    total: 0,
  }));
  for (const v of clean) {
    const i = bins.findIndex((b) => b.max === null || v < b.max);
    bins[i].count += 1;
    bins[i].total += v;
  }
  const first = bins.findIndex((b) => b.count > 0);
  let last = bins.length - 1;
  while (last > first && bins[last].count === 0) last--;
  return bins.slice(first, last + 1);
}

export const CYCLE_BUCKETS: { label: string; max: number | null }[] = [
  { label: "≤ 7 days", max: 7 },
  { label: "8–14 days", max: 14 },
  { label: "15–30 days", max: 30 },
  { label: "31–60 days", max: 60 },
  { label: "61–90 days", max: 90 },
  { label: "91–180 days", max: 180 },
  { label: "180+ days", max: null },
];

/** Sales-cycle lengths grouped into fixed day ranges; trailing empty ranges are dropped. */
export function cycleDistribution(days: number[]): { label: string; count: number }[] {
  if (!days.length) return [];
  const rows = CYCLE_BUCKETS.map((b) => ({ label: b.label, count: 0 }));
  for (const raw of days) {
    const d = Math.ceil(raw);
    const i = CYCLE_BUCKETS.findIndex((b) => b.max === null || d <= b.max);
    rows[i].count += 1;
  }
  let last = rows.length - 1;
  while (last > 0 && rows[last].count === 0) last--;
  return rows.slice(0, last + 1);
}

// ---------------------------------------------------------------------------------------------
// Activity mix & heatmap
// ---------------------------------------------------------------------------------------------

export type CoreActivityType = (typeof ACTIVITY_TYPES)[number];

export interface ActivityMixPoint {
  key: string;
  label: string;
  call: number;
  email: number;
  meeting: number;
  note: number;
  total: number;
}

/** Activities per bucket and type (unknown types count as notes). */
export function activityMixSeries(activities: AnalyticsActivity[], buckets: TimeBucket[]): ActivityMixPoint[] {
  const points: ActivityMixPoint[] = buckets.map((b) => ({ key: b.key, label: b.label, call: 0, email: 0, meeting: 0, note: 0, total: 0 }));
  for (const a of activities) {
    const i = bucketIndex(buckets, a.created_at);
    if (i < 0) continue;
    const type: CoreActivityType = (ACTIVITY_TYPES as readonly string[]).includes(a.type) ? (a.type as CoreActivityType) : "note";
    points[i][type] += 1;
    points[i].total += 1;
  }
  return points;
}

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export interface ActivityHeatmap {
  /** grid[weekday 0 = Monday][hour 0–23], in the viewer's local time. */
  grid: number[][];
  max: number;
  total: number;
  peak: { day: number; hour: number; count: number } | null;
}

export function activityHeatmap(activities: AnalyticsActivity[]): ActivityHeatmap {
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  let total = 0;
  for (const a of activities) {
    const d = parseDate(a.created_at);
    if (!d) continue;
    grid[(d.getDay() + 6) % 7][d.getHours()] += 1;
    total += 1;
  }
  let peak: ActivityHeatmap["peak"] = null;
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const count = grid[day][hour];
      if (count > 0 && (peak === null || count > peak.count)) peak = { day, hour, count };
    }
  }
  return { grid, max: peak?.count ?? 0, total, peak };
}

// ---------------------------------------------------------------------------------------------
// Stage history (from deal_audit_log stage_id changes)
// ---------------------------------------------------------------------------------------------

export interface StageAuditRow {
  deal_id: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface StageFlowRow {
  id: string;
  name: string;
  color: string | null;
  isWon: boolean;
  /** Deals (in the cohort) whose furthest stage is this one or a later one. */
  reached: number;
  /** Share of `reached` that got to the next row; null for the last row or when reached is 0. */
  conversion: number | null;
  /** Mean days spent in the stage over completed stays; null when no stay ended. */
  avgDaysInStage: number | null;
  stays: number;
}

export interface StageFlow {
  rows: StageFlowRow[];
  cohortSize: number;
  /** True when at least one stage change within this pipeline was found. */
  hasHistory: boolean;
}

/**
 * Real stage-to-stage conversion and time in stage, reconstructed from stage_id audit rows.
 * - A deal's path is its first recorded old stage (else its current stage), then every new stage.
 * - "Reached" counts deals whose furthest non-lost stage is at or beyond the row (won is last).
 * - Time in stage uses completed stays only (entry = created_at or the previous change).
 * `cohort` limits the funnel to deals created in a range; `staysEndedIn` limits time in stage.
 */
export function stageFlow(
  deals: AnalyticsDeal[],
  stages: AnalyticsStage[],
  pipelineId: string | null | undefined,
  audit: StageAuditRow[],
  opts: { cohort?: DateRange; staysEndedIn?: DateRange } = {},
): StageFlow {
  const pipelineStages = stages
    .filter((s) => (!pipelineId || s.pipeline_id === pipelineId) && !s.is_lost)
    .sort((a, b) => a.position - b.position);
  const open = pipelineStages.filter((s) => !s.is_won);
  const won = pipelineStages.filter((s) => s.is_won);
  const rowStages = [...open, ...(won.length ? [won[0]] : [])];
  const index = new Map<string, number>();
  open.forEach((s, i) => index.set(s.id, i));
  won.forEach((s) => index.set(s.id, open.length));

  const byDeal = new Map<string, StageAuditRow[]>();
  for (const r of audit) {
    const list = byDeal.get(r.deal_id);
    if (list) list.push(r);
    else byDeal.set(r.deal_id, [r]);
  }

  const reached = rowStages.map(() => 0);
  const stay = rowStages.map(() => ({ sum: 0, n: 0 }));
  let cohortSize = 0;
  let hasHistory = false;

  for (const d of deals) {
    if (pipelineId && d.pipeline_id !== pipelineId) continue;
    const events = (byDeal.get(d.id) ?? []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (events.some((e) => index.has(e.old_value ?? "") || index.has(e.new_value ?? ""))) hasHistory = true;

    // Time in stage: completed stays only.
    let current: string | null = events[0]?.old_value ?? d.stage_id;
    let enteredAt = parseDate(d.created_at);
    for (const e of events) {
      const leftAt = parseDate(e.created_at);
      const i = index.get(current ?? "");
      if (i !== undefined && enteredAt && leftAt && leftAt >= enteredAt && (!opts.staysEndedIn || inRange(leftAt, opts.staysEndedIn))) {
        stay[i].sum += (leftAt.getTime() - enteredAt.getTime()) / 86_400_000;
        stay[i].n += 1;
      }
      current = e.new_value;
      enteredAt = leftAt;
    }

    // Funnel: cohort by created_at.
    if (opts.cohort && !inRange(d.created_at, opts.cohort)) continue;
    const path = [events[0]?.old_value ?? d.stage_id, ...events.map((e) => e.new_value)];
    let furthest = -1;
    for (const id of path) {
      const i = index.get(id ?? "");
      if (i !== undefined && i > furthest) furthest = i;
    }
    if (furthest < 0) continue;
    cohortSize += 1;
    for (let i = 0; i <= furthest && i < reached.length; i++) reached[i] += 1;
  }

  const rows: StageFlowRow[] = rowStages.map((s, i) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    isWon: s.is_won,
    reached: reached[i],
    conversion: i + 1 < rowStages.length && reached[i] > 0 ? reached[i + 1] / reached[i] : null,
    avgDaysInStage: stay[i].n ? stay[i].sum / stay[i].n : null,
    stays: stay[i].n,
  }));
  return { rows, cohortSize, hasHistory };
}

// ---------------------------------------------------------------------------------------------
// Deal risk & quota attainment
// ---------------------------------------------------------------------------------------------

export const STALE_DAYS = 14;
/** How far back activity touches are loaded for staleness. */
export const TOUCH_LOOKBACK_DAYS = 90;

/** Latest activity timestamp per deal. */
export function lastActivityByDeal(activities: { deal_id?: string | null; created_at: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const a of activities) {
    if (!a.deal_id) continue;
    const prev = map.get(a.deal_id);
    if (!prev || a.created_at > prev) map.set(a.deal_id, a.created_at);
  }
  return map;
}

export interface DealRisk {
  overdue: boolean;
  /** Days since the close date passed. */
  overdueDays: number | null;
  stale: boolean;
  /** Days since the deal was last edited or had an activity logged. */
  idleDays: number | null;
}

/**
 * Overdue = close date before today. Stale = no edit and no logged activity for more than
 * STALE_DAYS days (last touch = latest of created_at, updated_at and the last activity).
 */
export function dealRisk(deal: AnalyticsDeal, lastActivityAt: string | null | undefined, now = new Date()): DealRisk {
  const close = parseDate(deal.close_date);
  const today = startOfDay(now);
  const overdue = !!close && close < today;
  const touches = [deal.created_at, deal.updated_at, lastActivityAt]
    .map((v) => parseDate(v ?? null))
    .filter((d): d is Date => !!d);
  const last = touches.length ? new Date(Math.max(...touches.map((d) => d.getTime()))) : null;
  const idleDays = last ? differenceInCalendarDays(today, last) : null;
  return {
    overdue,
    overdueDays: overdue && close ? differenceInCalendarDays(today, close) : null,
    stale: idleDays !== null && idleDays > STALE_DAYS,
    idleDays,
  };
}

/** Quota attainment for one forecast month: won so far, plus commit / weighted still to close. */
export function monthAttainment(
  month: { won?: number; commit: number; weighted: number },
  quota: number,
): { wonPct: number; commitPct: number; projectedPct: number } | null {
  if (!quota || quota <= 0) return null;
  const won = month.won ?? 0;
  return { wonPct: won / quota, commitPct: (won + month.commit) / quota, projectedPct: (won + month.weighted) / quota };
}

// ---------------------------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------------------------

export interface WorkspaceAnalytics {
  pipelines: AnalyticsPipeline[];
  stages: AnalyticsStage[];
  stagesById: StagesById;
  deals: AnalyticsDeal[];
}

type DealRow = Omit<AnalyticsDeal, "company_name" | "value"> & {
  value: number | string | null;
  companies: { name: string } | { name: string }[] | null;
};

/** `signal` is the query's: when TanStack cancels or restarts the query, paging stops mid-flight. */
async function loadWorkspaceAnalytics(signal: AbortSignal): Promise<WorkspaceAnalytics> {
  const [pipelinesRes, stages, dealRows] = await Promise.all([
    supabase.from("pipelines").select("id, name, created_at").order("created_at", { ascending: true }).abortSignal(signal),
    fetchAll<AnalyticsStage>(
      (from, to) =>
        supabase
          .from("pipeline_stages")
          .select("id, pipeline_id, name, color, position, probability, is_won, is_lost")
          .order("position", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to)
          .abortSignal(signal),
      { signal },
    ),
    fetchAll<DealRow>(
      (from, to) =>
        supabase
          .from("deals")
          .select(
            "id, title, value, probability, stage_id, pipeline_id, owner_id, close_date, created_at, updated_at, won_at, lost_at, lost_reason, companies(name)",
          )
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to)
          .abortSignal(signal),
      { signal },
    ),
  ]);
  if (pipelinesRes.error) throw pipelinesRes.error;

  const deals: AnalyticsDeal[] = dealRows.map(({ companies, ...d }) => {
    const company = Array.isArray(companies) ? companies[0] : companies;
    return {
      ...d,
      value: toNumber(d.value),
      probability: d.probability === null || d.probability === undefined ? null : toNumber(d.probability),
      company_name: company?.name ?? null,
    };
  });
  const normalizedStages = stages.map((s) => ({
    ...s,
    is_won: !!s.is_won,
    is_lost: !!s.is_lost,
    probability: s.probability === null || s.probability === undefined ? null : toNumber(s.probability),
  }));

  return {
    pipelines: (pipelinesRes.data ?? []) as AnalyticsPipeline[],
    stages: normalizedStages,
    stagesById: buildStagesById(normalizedStages),
    deals,
  };
}

/** All pipelines, stages and deals of the current workspace (paged, so > 1000 deals is fine). */
export function useWorkspaceAnalytics() {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ["analytics", "workspace", organization?.id],
    queryFn: ({ signal }) => loadWorkspaceAnalytics(signal),
    enabled: !!organization?.id,
    retry: retryUnlessRowLimit,
  });
}

/** Activities (id, type, created_at, user_id, deal_id) created within the range. */
export function useAnalyticsActivities(range: DateRange, enabled = true) {
  const { organization } = useAuth();
  const start = range.start.toISOString();
  const end = range.end.toISOString();
  return useQuery({
    queryKey: ["analytics", "activities", organization?.id, start, end],
    queryFn: ({ signal }) =>
      fetchAll<AnalyticsActivity>(
        (from, to) =>
          supabase
            .from("activities")
            .select("id, type, created_at, user_id, deal_id")
            .gte("created_at", start)
            .lt("created_at", end)
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to)
            .abortSignal(signal),
        { signal },
      ),
    enabled: enabled && !!organization?.id,
    retry: retryUnlessRowLimit,
  });
}

/**
 * Stage changes from deal_audit_log. RLS only returns rows on plans with audit history
 * (Enterprise), so callers pass `enabled = hasFeature("audit_history")` and fall back to the
 * current stage distribution otherwise (or when nothing has moved yet).
 */
export function useStageHistory(enabled: boolean) {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ["analytics", "stage-history", organization?.id],
    enabled: enabled && !!organization?.id,
    staleTime: 60_000,
    retry: retryUnlessRowLimit,
    queryFn: ({ signal }) =>
      fetchAll<StageAuditRow>(
        (from, to) =>
          supabase
            .from("deal_audit_log")
            .select("deal_id, old_value, new_value, created_at")
            .eq("field", "stage_id")
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to)
            .abortSignal(signal),
        { signal },
      ),
  });
}

/** Latest logged activity per deal over the last TOUCH_LOOKBACK_DAYS days (for stale-deal flags). */
export function useDealActivityTouches(enabled = true) {
  const { organization } = useAuth();
  const day = format(new Date(), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["analytics", "deal-touches", organization?.id, day],
    enabled: enabled && !!organization?.id,
    staleTime: 5 * 60_000,
    retry: retryUnlessRowLimit,
    queryFn: async ({ signal }) => {
      const since = subDays(startOfDay(new Date()), TOUCH_LOOKBACK_DAYS).toISOString();
      const rows = await fetchAll<{ deal_id: string | null; created_at: string }>(
        (from, to) =>
          supabase
            .from("activities")
            .select("deal_id, created_at")
            .not("deal_id", "is", null)
            .gte("created_at", since)
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to)
            .abortSignal(signal),
        { signal },
      );
      return lastActivityByDeal(rows);
    },
  });
}

/** Members of the current workspace (names for leaderboards, team counts). */
export function useWorkspaceMembers() {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ["analytics", "members", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_members");
      if (error) throw error;
      return (data ?? []) as WorkspaceMember[];
    },
    enabled: !!organization?.id,
    staleTime: 5 * 60_000,
  });
}

/** Quiet period after the last deal change before analytics reload (a bulk import is one reload). */
export const ANALYTICS_REALTIME_DEBOUNCE_MS = 1500;

/**
 * Keeps analytics fresh while a dashboard/report is open: refetch when deals change anywhere.
 * No row filter on purpose: Realtime can't filter DELETE events, so a filtered channel would miss
 * deletions. Events are debounced so bursts (bulk import, other workspaces' deletes) reload once.
 */
export function useAnalyticsRealtime() {
  const queryClient = useQueryClient();
  const { organization } = useAuth();
  const orgId = organization?.id;
  useEffect(() => {
    if (!orgId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel(`analytics-deals-${orgId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "deals" }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["analytics", "workspace", orgId] });
        }, ANALYTICS_REALTIME_DEBOUNCE_MS);
      })
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [queryClient, orgId]);
}

export function findMember(members: WorkspaceMember[] | undefined, userId: string | null): WorkspaceMember | undefined {
  return userId ? members?.find((x) => x.user_id === userId) : undefined;
}

export function memberName(members: WorkspaceMember[] | undefined, userId: string | null): string {
  if (!userId) return "Unassigned";
  const m = members?.find((x) => x.user_id === userId);
  return m?.full_name?.trim() || m?.email || "Former member";
}
