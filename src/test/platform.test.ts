import { describe, expect, it } from "vitest";
import {
  fillDailySeries,
  lastPage,
  normalizeOverview,
  pageRange,
  splitWorkspaces,
  summarizeSeries,
  toNumber,
  totalFromRows,
} from "@/components/platform/platformUtils";

describe("platform utils", () => {
  it("coerces numeric-ish values", () => {
    expect(toNumber(5)).toBe(5);
    expect(toNumber("12")).toBe(12);
    expect(toNumber(null)).toBe(0);
    expect(toNumber("abc")).toBe(0);
    expect(toNumber(Infinity)).toBe(0);
  });

  it("normalizes the overview payload with defaults", () => {
    const o = normalizeOverview({ total_workspaces: "4", plan_counts: { growth: 2 }, ai_requests_30d: 7 });
    expect(o.total_workspaces).toBe(4);
    expect(o.plan_counts).toEqual({ starter: 0, growth: 2, enterprise: 0 });
    expect(o.ai_requests_30d).toBe(7);
    expect(o.total_contacts).toBe(0);
    expect(normalizeOverview(null).total_users).toBe(0);
  });

  it("reads total_count from the first row", () => {
    expect(totalFromRows([])).toBe(0);
    expect(totalFromRows(null)).toBe(0);
    expect(totalFromRows([{ total_count: "312" }, { total_count: "312" }])).toBe(312);
  });

  it("computes the visible range and last page", () => {
    expect(pageRange(0, 50, 50)).toEqual({ from: 1, to: 50 });
    expect(pageRange(6, 50, 12)).toEqual({ from: 301, to: 312 });
    expect(pageRange(0, 50, 0)).toEqual({ from: 0, to: 0 });
    expect(lastPage(0, 50)).toBe(0);
    expect(lastPage(50, 50)).toBe(0);
    expect(lastPage(51, 50)).toBe(1);
  });

  it("sorts and fills missing days with zeros", () => {
    const filled = fillDailySeries([
      { day: "2026-03-03", signups: 2, new_workspaces: 1, ai_requests: "9" },
      { day: "2026-02-28", signups: 1, new_workspaces: 0, ai_requests: 0 },
    ]);
    expect(filled.map((p) => p.day)).toEqual(["2026-02-28", "2026-03-01", "2026-03-02", "2026-03-03"]);
    expect(filled[1]).toEqual({ day: "2026-03-01", signups: 0, new_workspaces: 0, ai_requests: 0 });
    expect(filled[3].ai_requests).toBe(9);
    expect(fillDailySeries(null)).toEqual([]);
  });

  it("summarizes totals and the peak day", () => {
    const pts = fillDailySeries([
      { day: "2026-01-01", signups: 1, new_workspaces: 0, ai_requests: 0 },
      { day: "2026-01-02", signups: 4, new_workspaces: 0, ai_requests: 0 },
    ]);
    expect(summarizeSeries(pts, "signups")).toEqual({ total: 5, peak: { day: "2026-01-02", value: 4 } });
    expect(summarizeSeries(pts, "ai_requests")).toEqual({ total: 0, peak: null });
  });

  it("splits comma-separated workspace names", () => {
    expect(splitWorkspaces("Acme, Beta Co,,")).toEqual(["Acme", "Beta Co"]);
    expect(splitWorkspaces(null)).toEqual([]);
  });
});
