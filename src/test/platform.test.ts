import { describe, expect, it } from "vitest";
import {
  activationEndsAt,
  defaultActivationPlan,
  fillDailySeries,
  lastPage,
  normalizeOverview,
  pageRange,
  splitWorkspaces,
  summarizeSeries,
  toNumber,
  toPlanIdOrNull,
  totalFromRows,
  trialExtendedTo,
  workspaceBillingBadge,
  workspaceBillingState,
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

  it("defaults the new billing counts in the overview", () => {
    const o = normalizeOverview({ paying_workspaces: "3", plan_requests: 2 });
    expect(o.paying_workspaces).toBe(3);
    expect(o.plan_requests).toBe(2);
    expect(o.trialing_workspaces).toBe(0);
    expect(o.expired_workspaces).toBe(0);
  });
});

describe("platform billing", () => {
  const NOW = new Date(2026, 9, 7, 12);
  const at = (month: number, day: number) => new Date(2026, month, day, 12).toISOString();

  it("trusts a valid billing_state and otherwise derives it like the database", () => {
    expect(workspaceBillingState("expired", at(9, 20), null, NOW)).toBe("expired");
    expect(workspaceBillingState(null, at(9, 20), at(10, 1), NOW)).toBe("active");
    expect(workspaceBillingState(undefined, at(9, 20), at(9, 1), NOW)).toBe("trialing");
    expect(workspaceBillingState("bogus", at(9, 1), null, NOW)).toBe("expired");
    expect(workspaceBillingState(null, null, null, NOW)).toBe("expired");
  });

  it("keeps only known requested plans", () => {
    expect(toPlanIdOrNull("growth")).toBe("growth");
    expect(toPlanIdOrNull("platinum")).toBeNull();
    expect(toPlanIdOrNull(null)).toBeNull();
  });

  it("labels the billing badge", () => {
    expect(workspaceBillingBadge({ billing_state: "trialing", trial_ends_at: at(9, 16), paid_until: null }, NOW)).toMatchObject({
      label: "Trial · 9 days left",
      attention: false,
    });
    expect(workspaceBillingBadge({ billing_state: "trialing", trial_ends_at: at(9, 9), paid_until: null }, NOW)).toMatchObject({
      label: "Trial · 2 days left",
      attention: true,
    });
    expect(workspaceBillingBadge({ billing_state: "active", trial_ends_at: null, paid_until: at(10, 7) }, NOW)).toMatchObject({
      label: "Paid until Nov 7, 2026",
      attention: false,
    });
    const expired = workspaceBillingBadge({ billing_state: "expired", trial_ends_at: at(8, 1), paid_until: at(9, 2) }, NOW);
    expect(expired).toMatchObject({ label: "Expired", attention: true });
    expect(expired.detail).toContain("Subscription ended Oct 2, 2026");
  });

  it("previews activation from the later of now and the current paid period", () => {
    expect(activationEndsAt(null, 3, NOW)).toEqual(new Date(2027, 0, 7, 12));
    expect(activationEndsAt(at(8, 1), 1, NOW)).toEqual(new Date(2026, 10, 7, 12));
    expect(activationEndsAt(at(10, 7), 12, NOW)).toEqual(new Date(2027, 10, 7, 12));
  });

  it("previews a trial extension from the later of now and the trial end", () => {
    expect(trialExtendedTo(at(9, 10), 7, NOW)).toEqual(new Date(2026, 9, 17, 12));
    expect(trialExtendedTo(at(9, 1), 14, NOW)).toEqual(new Date(2026, 9, 21, 12));
    expect(trialExtendedTo(null, 30, NOW)).toEqual(new Date(2026, 10, 6, 12));
  });

  it("preselects the requested plan, then the current one", () => {
    expect(defaultActivationPlan({ requested_plan: "enterprise", plan: "starter" })).toBe("enterprise");
    expect(defaultActivationPlan({ requested_plan: null, plan: "starter" })).toBe("starter");
    expect(defaultActivationPlan({ requested_plan: null, plan: "legacy" })).toBe("growth");
  });
});
