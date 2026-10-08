import { describe, it, expect } from "vitest";
import { groupTasks, parseQuickTask, taskBucket, dueDateToIso, isoToDueInputs, isTaskOverdue } from "@/components/tasks/taskUtils";
import {
  filterDeals,
  summarizeDeals,
  sortDeals,
  isDealOverdue,
  daysSince,
  hasActiveDealFilters,
  EMPTY_DEAL_FILTERS,
  initials,
  openDeals,
  parseDealValue,
  parseDealProbability,
} from "@/components/pipeline/dealUtils";
import { groupByDay, dayLabel } from "@/components/activities/activityUtils";
import { bucketByDay, monthGrid, parseCalendarDate, type CalendarItem } from "@/components/activities/calendarUtils";
import { defaultProbabilityForStage, stageOutcome, type PipelineStage } from "@/hooks/usePipelineStages";
import { stageMoveUpdates, type Deal } from "@/hooks/useDeals";

const NOW = new Date(2026, 8, 26, 10, 0); // Sat Sep 26 2026, 10:00 local
const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).toISOString();

describe("task grouping", () => {
  it("buckets by local day: earlier today is 'today', not overdue", () => {
    expect(taskBucket(local(2026, 9, 26, 8), NOW)).toBe("today");
    expect(taskBucket(local(2026, 9, 25, 23, 59), NOW)).toBe("overdue");
    expect(taskBucket(local(2026, 9, 27), NOW)).toBe("upcoming");
    expect(taskBucket(null, NOW)).toBe("nodate");
    expect(taskBucket("not a date", NOW)).toBe("nodate");
  });

  it("groups in Overdue/Today/Upcoming/No date order, omits empty groups, sorts by due date", () => {
    const tasks = [
      { id: "a", due_date: local(2026, 10, 2) },
      { id: "b", due_date: null },
      { id: "c", due_date: local(2026, 9, 20) },
      { id: "d", due_date: local(2026, 9, 28) },
      { id: "e", due_date: local(2026, 9, 1) },
    ];
    const groups = groupTasks(tasks, NOW);
    expect(groups.map((g) => g.key)).toEqual(["overdue", "upcoming", "nodate"]);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["e", "c"]);
    expect(groups[1].tasks.map((t) => t.id)).toEqual(["d", "a"]);
    expect(groups[2].tasks.map((t) => t.id)).toEqual(["b"]);
  });

  it("completed tasks are never overdue", () => {
    expect(isTaskOverdue({ due_date: local(2026, 9, 1), completed: true }, NOW)).toBe(false);
    expect(isTaskOverdue({ due_date: local(2026, 9, 1), completed: false }, NOW)).toBe(true);
  });
});

describe("quick-add parsing", () => {
  it("extracts due date keywords and priority markers", () => {
    const t = parseQuickTask("Call Ada tomorrow !high", NOW);
    expect(t.title).toBe("Call Ada");
    expect(t.priority).toBe("high");
    expect(new Date(t.due_date!).getDate()).toBe(27);

    const u = parseQuickTask("today send the contract", NOW);
    expect(u.title).toBe("send the contract");
    expect(new Date(u.due_date!).getDate()).toBe(26);

    expect(parseQuickTask("Review !! deck", NOW).priority).toBe("high");
    expect(parseQuickTask("Tidy CRM !low", NOW)).toEqual({ title: "Tidy CRM", due_date: null, priority: "low" });
  });

  it("leaves words that only look like keywords mid-sentence alone", () => {
    expect(parseQuickTask("Ask about today's numbers", NOW)).toEqual({ title: "Ask about today's numbers", due_date: null, priority: "medium" });
  });
});

describe("due date inputs", () => {
  it("round-trips date and optional time in local time", () => {
    const iso = dueDateToIso("2026-10-03", "14:30")!;
    expect(isoToDueInputs(iso)).toEqual({ date: "2026-10-03", time: "14:30" });
    const dateOnly = dueDateToIso("2026-10-03", "")!;
    expect(isoToDueInputs(dateOnly)).toEqual({ date: "2026-10-03", time: "" });
    expect(dueDateToIso("", "10:00")).toBeNull();
  });
});

const deal = (over: Partial<Deal>): Deal => ({
  id: "x",
  title: "Deal",
  company_id: null,
  contact_id: null,
  pipeline_id: "p",
  stage_id: "s1",
  owner_id: "u1",
  value: 0,
  probability: 50,
  close_date: null,
  notes: null,
  created_by: "u1",
  created_at: local(2026, 9, 1),
  updated_at: local(2026, 9, 1),
  ...over,
});

describe("deal filters", () => {
  const deals = [
    deal({ id: "1", title: "Annual plan", owner_id: "me", value: 5000, close_date: "2026-10-05", companies: { id: "c", name: "Northwind" } }),
    deal({ id: "2", title: "Pilot", owner_id: "other", value: 800, close_date: "2026-09-10", contacts: { id: "k", first_name: "Ada", last_name: "Lovelace" } }),
    deal({ id: "3", title: "Expansion", owner_id: null, value: 12000, close_date: null }),
  ];

  it("matches search across title, company and contact name", () => {
    expect(filterDeals(deals, { ...EMPTY_DEAL_FILTERS, search: "north" }, "me").map((d) => d.id)).toEqual(["1"]);
    expect(filterDeals(deals, { ...EMPTY_DEAL_FILTERS, search: "ada love" }, "me").map((d) => d.id)).toEqual(["2"]);
  });

  it("filters by owner (mine / specific), min value and close-date range", () => {
    expect(filterDeals(deals, { ...EMPTY_DEAL_FILTERS, owner: "mine" }, "me").map((d) => d.id)).toEqual(["1"]);
    expect(filterDeals(deals, { ...EMPTY_DEAL_FILTERS, owner: "other" }, "me").map((d) => d.id)).toEqual(["2"]);
    expect(filterDeals(deals, { ...EMPTY_DEAL_FILTERS, minValue: "1000" }, "me").map((d) => d.id)).toEqual(["1", "3"]);
    expect(filterDeals(deals, { ...EMPTY_DEAL_FILTERS, closeFrom: "2026-10-01", closeTo: "2026-10-31" }, "me").map((d) => d.id)).toEqual(["1"]);
    expect(filterDeals(deals, { ...EMPTY_DEAL_FILTERS, closeTo: "2026-09-30" }, "me").map((d) => d.id)).toEqual(["2"]);
  });

  it("'mine' with no signed-in user matches nothing", () => {
    expect(filterDeals(deals, { ...EMPTY_DEAL_FILTERS, owner: "mine" }, undefined)).toEqual([]);
  });

  it("knows when filters are active", () => {
    expect(hasActiveDealFilters(EMPTY_DEAL_FILTERS)).toBe(false);
    expect(hasActiveDealFilters({ ...EMPTY_DEAL_FILTERS, search: "  " })).toBe(false);
    expect(hasActiveDealFilters({ ...EMPTY_DEAL_FILTERS, minValue: "0" })).toBe(true);
    expect(hasActiveDealFilters({ ...EMPTY_DEAL_FILTERS, openOnly: true })).toBe(true);
  });

  it("'open only' (Past due) drops won and lost deals", () => {
    const stages = [
      { id: "open", is_won: false, is_lost: false },
      { id: "won", is_won: true },
      { id: "lost", is_lost: true },
    ];
    const ds = [
      deal({ id: "a", stage_id: "open", close_date: "2026-09-20" }),
      deal({ id: "b", stage_id: "won", close_date: "2026-09-20" }),
      deal({ id: "c", stage_id: "lost", close_date: "2026-09-20" }),
    ];
    const pastDue = { ...EMPTY_DEAL_FILTERS, closeTo: "2026-09-25", openOnly: true };
    expect(filterDeals(ds, pastDue, "me", stages).map((d) => d.id)).toEqual(["a"]);
    expect(filterDeals(ds, { ...pastDue, openOnly: false }, "me", stages).map((d) => d.id)).toEqual(["a", "b", "c"]);
    expect(openDeals(ds, stages).map((d) => d.id)).toEqual(["a"]);
  });
});

describe("amount inputs", () => {
  it("accepts thousands separators and blanks", () => {
    expect(parseDealValue("1,500")).toEqual({ error: null, value: 1500 });
    expect(parseDealValue(" 1 250 000.5 ")).toEqual({ error: null, value: 1250000.5 });
    expect(parseDealValue("0")).toEqual({ error: null, value: 0 });
    expect(parseDealValue(".75")).toEqual({ error: null, value: 0.75 });
    expect(parseDealValue("")).toEqual({ error: null, value: null });
  });

  it("rejects negatives, junk, >2 decimals and values over NUMERIC(14,2)", () => {
    expect(parseDealValue("-5").error).toBeTruthy();
    expect(parseDealValue("1e5").error).toBeTruthy();
    expect(parseDealValue("abc").error).toBeTruthy();
    expect(parseDealValue("10.555").error).toBeTruthy();
    expect(parseDealValue("999,999,999,999.99")).toEqual({ error: null, value: 999999999999.99 });
    expect(parseDealValue("1,000,000,000,000").error).toBeTruthy();
  });

  it("parses probabilities from 0 to 100", () => {
    expect(parseDealProbability("40")).toEqual({ error: null, value: 40 });
    expect(parseDealProbability("33.6%")).toEqual({ error: null, value: 34 });
    expect(parseDealProbability(" ")).toEqual({ error: null, value: null });
    expect(parseDealProbability("101").error).toBeTruthy();
    expect(parseDealProbability("-1").error).toBeTruthy();
  });
});

describe("deal math & sorting", () => {
  it("sums totals and probability-weighted value", () => {
    expect(summarizeDeals([{ value: 1000, probability: 50 }, { value: 400, probability: 25 }])).toEqual({ count: 2, total: 1400, weighted: 600 });
  });

  it("sorts with blanks last in both directions", () => {
    const ds = [deal({ id: "a", close_date: "2026-10-01" }), deal({ id: "b", close_date: null }), deal({ id: "c", close_date: "2026-09-01" })];
    const ctx = { stagePosition: () => 0, ownerName: () => "" };
    expect(sortDeals(ds, "close_date", "asc", ctx).map((d) => d.id)).toEqual(["c", "a", "b"]);
    expect(sortDeals(ds, "close_date", "desc", ctx).map((d) => d.id)).toEqual(["a", "c", "b"]);
  });

  it("only open-stage deals past their close date are overdue", () => {
    const d = deal({ close_date: "2026-09-25" });
    expect(isDealOverdue(d, { is_won: false, is_lost: false }, NOW)).toBe(true);
    expect(isDealOverdue(d, { is_won: true }, NOW)).toBe(false);
    expect(isDealOverdue(deal({ close_date: "2026-09-26" }), {}, NOW)).toBe(false);
  });

  it("computes whole days since a timestamp", () => {
    expect(daysSince(local(2026, 9, 20, 18), NOW)).toBe(6);
    expect(daysSince(null, NOW)).toBeNull();
  });

  it("builds initials", () => {
    expect(initials("Ada King Lovelace")).toBe("AL");
    expect(initials("  ")).toBe("?");
  });
});

describe("stage rules", () => {
  const stage = (over: Partial<PipelineStage>): PipelineStage => ({ id: "s", pipeline_id: "p", name: "Stage", color: "#000", position: 0, created_at: "", ...over });

  it("classifies stages by flags and derives default probability", () => {
    expect(stageOutcome(stage({ is_won: true }))).toBe("won");
    expect(stageOutcome(stage({ name: "Lost" }))).toBe("open"); // names never decide
    expect(defaultProbabilityForStage(stage({ probability: 30 }))).toBe(30);
    expect(defaultProbabilityForStage(stage({ is_lost: true }))).toBe(0);
    expect(defaultProbabilityForStage(undefined)).toBe(50);
  });

  it("sets probability and lost reason when moving into closed stages", () => {
    expect(stageMoveUpdates(stage({ id: "w", is_won: true }))).toEqual({ stage_id: "w", probability: 100 });
    expect(stageMoveUpdates(stage({ id: "l", is_lost: true }), "  Price ")).toEqual({ stage_id: "l", probability: 0, lost_reason: "Price" });
    expect(stageMoveUpdates(stage({ id: "l", is_lost: true }), "")).toEqual({ stage_id: "l", probability: 0, lost_reason: null });
    expect(stageMoveUpdates(stage({ id: "o" }))).toEqual({ stage_id: "o" });
  });

  it("reopening a won/lost deal into a stage without a probability uses the stage default", () => {
    expect(stageMoveUpdates(stage({ id: "o" }), null, { from: stage({ is_lost: true }) })).toEqual({ stage_id: "o", probability: 50 });
    expect(stageMoveUpdates(stage({ id: "o" }), null, { from: stage({ is_won: true }) })).toEqual({ stage_id: "o", probability: 50 });
    expect(stageMoveUpdates(stage({ id: "o", probability: 20 }), null, { from: stage({ is_lost: true }) })).toEqual({ stage_id: "o", probability: 20 });
    // Open → open keeps the deal's own probability when the stage has none.
    expect(stageMoveUpdates(stage({ id: "o" }), null, { from: stage({}) })).toEqual({ stage_id: "o" });
  });

  it("restore wins over stage-derived values (Undo)", () => {
    // Undo of a move to Won puts back the deal's 35%, not the old stage's default.
    expect(stageMoveUpdates(stage({ id: "n", probability: 75 }), null, { from: stage({ is_won: true }), restore: { probability: 35, lost_reason: null } })).toEqual({
      stage_id: "n",
      probability: 35,
      lost_reason: null,
    });
    // Undo of a reopen puts back the original lost reason.
    expect(stageMoveUpdates(stage({ id: "l", is_lost: true }), undefined, { restore: { probability: 0, lost_reason: "Price" } })).toEqual({
      stage_id: "l",
      probability: 0,
      lost_reason: "Price",
    });
    expect(stageMoveUpdates(stage({ id: "o" }), null, { restore: {} })).toEqual({ stage_id: "o" });
  });
});

describe("deal totals", () => {
  it("open deals only: won and lost don't count toward pipeline totals", () => {
    const stages = [{ id: "s1" }, { id: "w", is_won: true }, { id: "l", is_lost: true }];
    const ds = [deal({ stage_id: "s1", value: 1000, probability: 50 }), deal({ stage_id: "w", value: 5000, probability: 100 }), deal({ stage_id: "l", value: 700, probability: 0 })];
    expect(summarizeDeals(openDeals(ds, stages))).toEqual({ count: 1, total: 1000, weighted: 500 });
  });
});

describe("day grouping", () => {
  it("groups feed items by local day with friendly labels", () => {
    const items = [{ t: local(2026, 9, 26, 9) }, { t: local(2026, 9, 26, 7) }, { t: local(2026, 9, 25, 22) }, { t: local(2025, 12, 31, 12) }];
    const groups = groupByDay(items, (i) => i.t, NOW);
    expect(groups.map((g) => [g.key, g.label, g.items.length])).toEqual([
      ["2026-09-26", "Today", 2],
      ["2026-09-25", "Yesterday", 1],
      ["2025-12-31", "Dec 31, 2025", 1],
    ]);
    expect(dayLabel(new Date(2026, 8, 21), NOW)).toBe("Monday, Sep 21");
  });
});

describe("calendar helpers", () => {
  it("builds full Monday-first weeks for a month", () => {
    const grid = monthGrid(new Date(2026, 8, 1));
    expect(grid.length % 7).toBe(0);
    expect(grid[0].getDay()).toBe(1);
    expect(grid[0].getDate()).toBe(31); // Mon Aug 31
    expect(grid[grid.length - 1].getDay()).toBe(0);
  });

  it("parses date-only values as local dates", () => {
    const { date, timed } = parseCalendarDate("2026-09-30");
    expect([date.getFullYear(), date.getMonth(), date.getDate(), timed]).toEqual([2026, 8, 30, false]);
  });

  it("buckets items per day: deals, then tasks, then activities", () => {
    const mk = (id: string, kind: CalendarItem["kind"], date: Date): CalendarItem => ({ id, kind, title: id, date, timed: true, href: "#" });
    const map = bucketByDay([mk("a1", "activity", new Date(2026, 8, 3, 9)), mk("t1", "task", new Date(2026, 8, 3, 15)), mk("d1", "deal", new Date(2026, 8, 3)), mk("t2", "task", new Date(2026, 8, 4))]);
    expect(map.get("2026-09-03")!.map((i) => i.id)).toEqual(["d1", "t1", "a1"]);
    expect(map.get("2026-09-04")!.map((i) => i.id)).toEqual(["t2"]);
  });
});
