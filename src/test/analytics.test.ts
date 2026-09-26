import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  type AnalyticsDeal,
  type AnalyticsStage,
  activityCountsByType,
  activityHeatmap,
  activityMixSeries,
  averageDealSize,
  averageSalesCycleDays,
  buildForecast,
  buildStagesById,
  closingSoon,
  cycleDistribution,
  dealRisk,
  dealStatus,
  effectiveProbability,
  fetchAll,
  getPeriodRange,
  getPreviousPeriodRange,
  lastActivityByDeal,
  lastMonthsBuckets,
  lostReasonBreakdown,
  median,
  monthAttainment,
  monthlyWonRevenue,
  NO_LOST_REASON,
  openPipelineValue,
  ownerLeaderboard,
  parseDate,
  performanceSeries,
  periodDelta,
  pickBucketUnit,
  rateDelta,
  salesCycleDays,
  stageBreakdown,
  stageFlow,
  timeBuckets,
  valueHistogram,
  weightedPipelineValue,
  winRate,
  wonRevenue,
} from "@/hooks/useAnalytics";

const NOW = new Date(2026, 8, 15, 12, 0, 0); // Sep 15 2026, local

const stages: AnalyticsStage[] = [
  { id: "s1", pipeline_id: "p1", name: "Prospect", color: "#111", position: 0, probability: 10, is_won: false, is_lost: false },
  { id: "s2", pipeline_id: "p1", name: "Proposal", color: "#222", position: 1, probability: 60, is_won: false, is_lost: false },
  { id: "won", pipeline_id: "p1", name: "Won", color: "#0a0", position: 2, probability: 100, is_won: true, is_lost: false },
  { id: "lost", pipeline_id: "p1", name: "Lost", color: "#a00", position: 3, probability: 0, is_won: false, is_lost: true },
  { id: "x1", pipeline_id: "p2", name: "Other", color: null, position: 0, probability: null, is_won: false, is_lost: false },
];
const byId = buildStagesById(stages);

let seq = 0;
function deal(p: Partial<AnalyticsDeal>): AnalyticsDeal {
  seq += 1;
  return {
    id: `d${seq}`,
    title: `Deal ${seq}`,
    value: 1000,
    probability: null,
    stage_id: "s1",
    pipeline_id: "p1",
    owner_id: "u1",
    close_date: null,
    created_at: "2026-08-01T00:00:00Z",
    won_at: null,
    lost_at: null,
    lost_reason: null,
    company_name: null,
    ...p,
  };
}

describe("parseDate", () => {
  it("parses date-only strings as local dates", () => {
    const d = parseDate("2026-03-04")!;
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 2, 4, 0]);
    expect(parseDate(null)).toBeNull();
    expect(parseDate("nope")).toBeNull();
  });
});

describe("status & probability", () => {
  it("classifies by stage flags, not names", () => {
    expect(dealStatus(deal({ stage_id: "won" }), byId)).toBe("won");
    expect(dealStatus(deal({ stage_id: "lost" }), byId)).toBe("lost");
    expect(dealStatus(deal({ stage_id: "s2", won_at: "2026-01-01" }), byId)).toBe("open");
    expect(dealStatus(deal({ stage_id: "unknown", won_at: "2026-01-01" }), byId)).toBe("won");
  });

  it("falls back to stage probability, and to null when neither is set", () => {
    expect(effectiveProbability(deal({ probability: 25, stage_id: "s2" }), byId)).toBe(25);
    expect(effectiveProbability(deal({ probability: 0, stage_id: "s2" }), byId)).toBe(0);
    expect(effectiveProbability(deal({ stage_id: "s2" }), byId)).toBe(60);
    expect(effectiveProbability(deal({ stage_id: "x1" }), byId)).toBeNull();
  });
});

describe("pipeline values", () => {
  const deals = [
    deal({ value: 1000, stage_id: "s1" }), // 10% → 100
    deal({ value: 2000, stage_id: "s2", probability: 50 }), // 1000
    deal({ value: 500, stage_id: "x1" }), // unknown probability → 0 weighted
    deal({ value: 9999, stage_id: "won" }),
    deal({ value: 7777, stage_id: "lost" }),
  ];
  it("sums only open deals", () => {
    expect(openPipelineValue(deals, byId)).toBe(3500);
    expect(weightedPipelineValue(deals, byId)).toBe(1100);
  });
});

describe("closed-deal metrics", () => {
  const sep = getPeriodRange("this_month", NOW);
  const deals = [
    deal({ value: 3000, stage_id: "won", created_at: "2026-09-01T00:00:00Z", won_at: "2026-09-11T00:00:00Z" }),
    deal({ value: 1000, stage_id: "won", created_at: "2026-08-01T00:00:00Z", won_at: "2026-08-21T00:00:00Z" }),
    deal({ value: 500, stage_id: "lost", lost_at: "2026-09-05T10:00:00Z", lost_reason: "Budget" }),
    deal({ value: 700, stage_id: "lost", lost_at: "2026-09-06T10:00:00Z", lost_reason: " budget " }),
    deal({ value: 100, stage_id: "lost", lost_at: "2026-09-07T10:00:00Z" }),
    deal({ value: 999, stage_id: "won", won_at: null }), // won but undated → not in any period
  ];

  it("counts won revenue by won_at", () => {
    expect(wonRevenue(deals, byId, sep)).toEqual({ count: 1, value: 3000 });
  });

  it("computes win rate over closed deals, null when nothing closed", () => {
    expect(winRate(deals, byId, sep)).toEqual({ won: 1, lost: 3, rate: 0.25 });
    const empty = { start: new Date(2020, 0, 1), end: new Date(2020, 1, 1) };
    expect(winRate(deals, byId, empty).rate).toBeNull();
  });

  it("averages won deal size and sales cycle", () => {
    expect(averageDealSize(deals, byId, sep)).toBe(3000);
    expect(averageDealSize([], byId)).toBeNull();
    expect(averageSalesCycleDays(deals, byId)).toBeCloseTo(15, 5); // (10 + 20) / 2, undated excluded
    expect(averageSalesCycleDays([deal({ stage_id: "s1" })], byId)).toBeNull();
  });

  it("groups lost reasons case-insensitively with a bucket for blanks", () => {
    expect(lostReasonBreakdown(deals, byId, sep)).toEqual([
      { reason: "Budget", count: 2, value: 1200 },
      { reason: NO_LOST_REASON, count: 1, value: 100 },
    ]);
  });

  it("buckets monthly won revenue", () => {
    const pts = monthlyWonRevenue(deals, byId, 3, NOW);
    expect(pts.map((p) => p.key)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(pts.map((p) => p.value)).toEqual([0, 1000, 3000]);
  });

  it("builds an owner leaderboard", () => {
    const rows = ownerLeaderboard(
      [...deals, deal({ owner_id: "u2", value: 50, stage_id: "s1" }), deal({ owner_id: null, value: 10, stage_id: "s2" })],
      byId,
      sep,
    );
    expect(rows[0]).toMatchObject({ ownerId: "u1", wonCount: 1, wonValue: 3000, lostCount: 3, winRate: 0.25 });
    expect(rows.find((r) => r.ownerId === "u2")).toMatchObject({ openCount: 1, openValue: 50, winRate: null });
    expect(rows.find((r) => r.ownerId === null)).toMatchObject({ openCount: 1 });
  });
});

describe("periods & deltas", () => {
  it("returns null pct when the previous value is zero", () => {
    expect(periodDelta(150, 100)).toEqual({ abs: 50, pct: 0.5 });
    expect(periodDelta(150, 0)).toEqual({ abs: 150, pct: null });
  });

  it("compares month-to-date with the same span last month", () => {
    const cur = getPeriodRange("this_month", NOW);
    const prev = getPreviousPeriodRange("this_month", NOW);
    expect(cur.start).toEqual(new Date(2026, 8, 1));
    expect(cur.end).toEqual(new Date(2026, 8, 16));
    expect(prev.start).toEqual(new Date(2026, 7, 1));
    expect(prev.end).toEqual(new Date(2026, 7, 16));
    expect(getPreviousPeriodRange("last_month", NOW)).toEqual({ start: new Date(2026, 6, 1), end: new Date(2026, 7, 1) });
  });
});

describe("stageBreakdown", () => {
  it("lists a pipeline's open stages in position order with totals", () => {
    const rows = stageBreakdown(
      [deal({ stage_id: "s2", value: 200, probability: 50 }), deal({ stage_id: "s1", value: 100 }), deal({ stage_id: "won" })],
      stages,
      "p1",
    );
    expect(rows.map((r) => [r.name, r.count, r.value, r.weighted])).toEqual([
      ["Prospect", 1, 100, 10],
      ["Proposal", 1, 200, 100],
    ]);
    expect(stageBreakdown([], stages, "p1", { includeClosed: true })).toHaveLength(4);
  });
});

describe("forecast", () => {
  const deals = [
    deal({ value: 1000, stage_id: "s2", probability: 80, close_date: "2026-09-20" }), // commit, Sep
    deal({ value: 2000, stage_id: "s2", close_date: "2026-10-03" }), // stage 60% → best case, Oct
    deal({ value: 300, stage_id: "x1", close_date: "2026-10-10" }), // unknown → pipeline, Oct
    deal({ value: 400, stage_id: "s1", close_date: "2026-09-01" }), // overdue
    deal({ value: 500, stage_id: "s1", close_date: null }), // no date
    deal({ value: 600, stage_id: "s1", close_date: "2027-06-01" }), // later
    deal({ value: 9000, stage_id: "won", close_date: "2026-09-20" }), // excluded
  ];
  const f = buildForecast(deals, byId, 3, NOW);

  it("groups open deals by close month and category", () => {
    expect(f.months.map((m) => m.key)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(f.months[0]).toMatchObject({ commit: 1000, bestCase: 0, pipeline: 0, total: 1000, weighted: 800 });
    expect(f.months[1]).toMatchObject({ commit: 0, bestCase: 2000, pipeline: 300, total: 2300, weighted: 1200 });
    expect(f.totals).toEqual({ commit: 1000, bestCase: 2000, pipeline: 300, total: 3300, weighted: 2000 });
  });

  it("separates overdue, undated and beyond-horizon deals", () => {
    expect(f.overdue.map((d) => d.value)).toEqual([400]);
    expect(f.noCloseDate.map((d) => d.value)).toEqual([500]);
    expect(f.later.map((d) => d.value)).toEqual([600]);
  });

  it("lists open deals closing in the next 30 days", () => {
    expect(closingSoon(deals, byId, 30, NOW).map((d) => d.value)).toEqual([1000, 2000, 300]);
  });
});

describe("activityCountsByType", () => {
  it("always includes the four core types", () => {
    const rows = activityCountsByType([
      { id: "1", type: "call", created_at: "", user_id: null },
      { id: "2", type: "call", created_at: "", user_id: null },
      { id: "3", type: "note", created_at: "", user_id: null },
    ]);
    expect(rows).toEqual([
      { type: "call", count: 2 },
      { type: "email", count: 0 },
      { type: "meeting", count: 0 },
      { type: "note", count: 1 },
    ]);
  });
});

describe("fetchAll", () => {
  it("pages until a short page and surfaces errors", async () => {
    const all = Array.from({ length: 5 }, (_, i) => i);
    const calls: [number, number][] = [];
    const rows = await fetchAll<number>(async (from, to) => {
      calls.push([from, to]);
      return { data: all.slice(from, to + 1), error: null };
    }, 2);
    expect(rows).toEqual(all);
    expect(calls).toEqual([[0, 1], [2, 3], [4, 5]]);
    await expect(fetchAll(async () => ({ data: null, error: new Error("boom") }))).rejects.toThrow("boom");
  });
});

describe("time buckets & performance series", () => {
  it("builds clipped Monday weeks and calendar months", () => {
    const range = { start: new Date(2026, 8, 1), end: new Date(2026, 8, 16) }; // Tue Sep 1 → Sep 15
    expect(pickBucketUnit(range)).toBe("week");
    const weeks = timeBuckets(range, "week");
    expect(weeks.map((w) => w.label)).toEqual(["Sep 1", "Sep 7", "Sep 14"]);
    expect(weeks[0].start).toEqual(new Date(2026, 8, 1));
    expect(weeks[2].end).toEqual(new Date(2026, 8, 16));
    const months = lastMonthsBuckets(3, NOW);
    expect(months.map((m) => m.key)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(pickBucketUnit({ start: new Date(2026, 0, 1), end: new Date(2026, 8, 1) })).toBe("month");
    expect(timeBuckets({ start: new Date(2025, 11, 1), end: new Date(2026, 1, 1) }, "month").map((m) => m.label)).toEqual(["Dec 25", "Jan 26"]);
  });

  it("computes won/lost/created/win rate/cycle per bucket", () => {
    const deals = [
      deal({ value: 3000, stage_id: "won", created_at: "2026-09-01T00:00:00Z", won_at: "2026-09-11T00:00:00Z" }),
      deal({ value: 1000, stage_id: "won", created_at: "2026-08-01T00:00:00Z", won_at: "2026-08-21T00:00:00Z" }),
      deal({ value: 500, stage_id: "lost", created_at: "2026-08-02T00:00:00Z", lost_at: "2026-08-25T10:00:00Z" }),
      deal({ value: 200, stage_id: "s1", created_at: "2026-09-03T00:00:00Z" }),
    ];
    const pts = performanceSeries(deals, byId, lastMonthsBuckets(3, NOW));
    expect(pts.map((p) => [p.wonValue, p.wonCount, p.lostCount, p.winRate, p.createdCount])).toEqual([
      [0, 0, 0, null, 0],
      [1000, 1, 1, 0.5, 2],
      [3000, 1, 0, 1, 2],
    ]);
    expect(pts[1].avgCycleDays).toBeCloseTo(20, 5);
    expect(pts[2].avgDealSize).toBe(3000);
    expect(pts[0].avgDealSize).toBeNull();
  });

  it("reports rate deltas in points, null when a side is missing", () => {
    expect(rateDelta(0.5, 0.25)).toBe(0.25);
    expect(rateDelta(null, 0.25)).toBeNull();
  });
});

describe("distributions", () => {
  it("bins deal values on 1-2.5-5 edges, trimmed to the data", () => {
    const bins = valueHistogram([500, 1200, 1800, 30_000]);
    expect(bins.map((b) => [b.min, b.max, b.count])).toEqual([
      [0, 1000, 1],
      [1000, 2500, 2],
      [2500, 5000, 0],
      [5000, 10000, 0],
      [10000, 25000, 0],
      [25000, 50000, 1],
    ]);
    expect(valueHistogram([])).toEqual([]);
    expect(valueHistogram([20_000_000])[0]).toMatchObject({ min: 10_000_000, max: null, count: 1 });
  });

  it("groups sales cycles and computes a median", () => {
    const deals = [
      deal({ stage_id: "won", created_at: "2026-09-01T00:00:00Z", won_at: "2026-09-04T00:00:00Z" }),
      deal({ stage_id: "won", created_at: "2026-08-01T00:00:00Z", won_at: "2026-09-10T00:00:00Z" }),
    ];
    const days = salesCycleDays(deals, byId);
    expect(days).toEqual([3, 40]);
    expect(cycleDistribution(days).map((r) => r.count)).toEqual([1, 0, 0, 1]);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("activity mix & heatmap", () => {
  const acts = [
    { id: "1", type: "call", created_at: new Date(2026, 8, 7, 10, 15).toISOString(), user_id: null }, // Mon 10h
    { id: "2", type: "call", created_at: new Date(2026, 8, 7, 10, 45).toISOString(), user_id: null },
    { id: "3", type: "email", created_at: new Date(2026, 8, 13, 22, 0).toISOString(), user_id: null }, // Sun 22h
    { id: "4", type: "sms", created_at: new Date(2026, 8, 14, 9, 0).toISOString(), user_id: null }, // unknown → note
  ];
  it("stacks activity types per bucket", () => {
    const buckets = timeBuckets({ start: new Date(2026, 8, 7), end: new Date(2026, 8, 21) }, "week");
    expect(activityMixSeries(acts, buckets).map((p) => [p.call, p.email, p.meeting, p.note, p.total])).toEqual([
      [2, 1, 0, 0, 3],
      [0, 0, 0, 1, 1],
    ]);
  });
  it("counts by weekday (Monday first) and hour", () => {
    const h = activityHeatmap(acts);
    expect(h.grid[0][10]).toBe(2);
    expect(h.grid[6][22]).toBe(1);
    expect(h.total).toBe(4);
    expect(h.peak).toEqual({ day: 0, hour: 10, count: 2 });
    expect(activityHeatmap([]).peak).toBeNull();
  });
});

describe("stageFlow", () => {
  const d1 = deal({ id: "f1", stage_id: "won", created_at: "2026-09-01T00:00:00Z" });
  const d2 = deal({ id: "f2", stage_id: "lost", created_at: "2026-09-01T00:00:00Z" });
  const d3 = deal({ id: "f3", stage_id: "s1", created_at: "2026-09-02T00:00:00Z" });
  const d4 = deal({ id: "f4", stage_id: "s2", created_at: "2026-09-02T00:00:00Z" }); // created in s2, never moved
  const audit = [
    { deal_id: "f1", old_value: "s1", new_value: "s2", created_at: "2026-09-05T00:00:00Z" },
    { deal_id: "f1", old_value: "s2", new_value: "won", created_at: "2026-09-11T00:00:00Z" },
    { deal_id: "f2", old_value: "s1", new_value: "s2", created_at: "2026-09-03T00:00:00Z" },
    { deal_id: "f2", old_value: "s2", new_value: "lost", created_at: "2026-09-05T00:00:00Z" },
  ];
  it("derives reach, conversion and time in stage from stage changes", () => {
    const flow = stageFlow([d1, d2, d3, d4], stages, "p1", audit);
    expect(flow.hasHistory).toBe(true);
    expect(flow.cohortSize).toBe(4);
    expect(flow.rows.map((r) => [r.name, r.reached, r.conversion])).toEqual([
      ["Prospect", 4, 0.75],
      ["Proposal", 3, 1 / 3],
      ["Won", 1, null],
    ]);
    // Prospect stays: f1 4 days, f2 2 days → 3; Proposal stays: f1 6 days, f2 2 days → 4.
    expect(flow.rows[0].avgDaysInStage).toBeCloseTo(3, 5);
    expect(flow.rows[1].avgDaysInStage).toBeCloseTo(4, 5);
    expect(flow.rows[2].avgDaysInStage).toBeNull();
  });
  it("reports no history without audit rows and respects the cohort", () => {
    expect(stageFlow([d3], stages, "p1", []).hasHistory).toBe(false);
    const cohort = { start: new Date("2026-09-02T00:00:00Z"), end: new Date("2026-09-03T00:00:00Z") };
    expect(stageFlow([d1, d2, d3, d4], stages, "p1", audit, { cohort }).cohortSize).toBe(2);
  });
});

describe("deal risk & attainment", () => {
  it("flags overdue and stale deals from edits and activity", () => {
    const stale = deal({ close_date: "2026-09-10", created_at: "2026-07-01T00:00:00Z", updated_at: "2026-08-20T00:00:00Z" });
    expect(dealRisk(stale, null, NOW)).toMatchObject({ overdue: true, overdueDays: 5, stale: true, idleDays: 26 });
    expect(dealRisk(stale, "2026-09-12T09:00:00Z", NOW)).toMatchObject({ stale: false });
    expect(dealRisk(deal({ close_date: "2026-09-30", created_at: "2026-09-14T00:00:00Z" }), null, NOW)).toMatchObject({
      overdue: false,
      overdueDays: null,
      stale: false,
    });
  });

  it("keeps the latest activity per deal", () => {
    const m = lastActivityByDeal([
      { deal_id: "a", created_at: "2026-09-01T00:00:00Z" },
      { deal_id: "a", created_at: "2026-09-03T00:00:00Z" },
      { deal_id: null, created_at: "2026-09-04T00:00:00Z" },
    ]);
    expect([...m.entries()]).toEqual([["a", "2026-09-03T00:00:00Z"]]);
  });

  it("computes quota attainment, null without a quota", () => {
    expect(monthAttainment({ won: 500, commit: 1000, weighted: 1500 }, 4000)).toEqual({ wonPct: 0.125, commitPct: 0.375, projectedPct: 0.5 });
    expect(monthAttainment({ commit: 1, weighted: 1 }, 0)).toBeNull();
  });

  it("puts this month's won revenue on the first forecast month only", () => {
    const f = buildForecast(
      [deal({ value: 700, stage_id: "won", won_at: "2026-09-02T00:00:00Z" }), deal({ value: 50, stage_id: "won", won_at: "2026-08-02T00:00:00Z" })],
      byId,
      2,
      NOW,
    );
    expect(f.months.map((m) => m.won)).toEqual([700, 0]);
  });
});
