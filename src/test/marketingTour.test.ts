import { describe, expect, it } from "vitest";
import {
  INITIAL_DEALS,
  atRiskDeals,
  forecastSeries,
  moveDeal,
  nextStage,
  plansWithFeature,
  stageTotals,
  weightedPipeline,
} from "@/components/marketing/tour/data";
import { signupPathFor } from "@/components/marketing/site";

describe("marketing product tour data", () => {
  it("moves a deal without mutating the input", () => {
    const moved = moveDeal(INITIAL_DEALS, "d5", "negotiation");
    expect(moved.find((d) => d.id === "d5")?.stage).toBe("negotiation");
    expect(INITIAL_DEALS.find((d) => d.id === "d5")?.stage).toBe("proposal");
  });

  it("totals every stage and counts every deal once", () => {
    const totals = stageTotals(INITIAL_DEALS);
    expect(totals.reduce((s, t) => s + t.count, 0)).toBe(INITIAL_DEALS.length);
    expect(totals.reduce((s, t) => s + t.value, 0)).toBe(INITIAL_DEALS.reduce((s, d) => s + d.value, 0));
  });

  it("weights only open deals", () => {
    const allWon = INITIAL_DEALS.map((d) => ({ ...d, stage: "won" as const }));
    expect(weightedPipeline(allWon)).toBe(0);
    expect(weightedPipeline(INITIAL_DEALS)).toBeGreaterThan(0);
  });

  it("flags overdue and quiet open deals only", () => {
    const flagged = atRiskDeals(INITIAL_DEALS).map((r) => r.deal.id);
    expect(flagged).toContain("d5"); // close date passed
    expect(flagged).toContain("d3"); // 21 days quiet
    expect(flagged).not.toContain("d10"); // won
  });

  it("stops at the last stage", () => {
    expect(nextStage("negotiation")).toBe("won");
    expect(nextStage("won")).toBeNull();
  });

  it("builds forecast months for the horizon", () => {
    expect(forecastSeries(3, new Date(2026, 10, 15)).map((m) => m.month)).toEqual(["Nov", "Dec", "Jan"]);
    expect(forecastSeries(6)).toHaveLength(6);
  });

  it("labels plan-gated features from the plan catalog", () => {
    expect(plansWithFeature("forecast")).toBe("Growth & Enterprise");
    expect(plansWithFeature("audit_history")).toBe("Enterprise");
  });

  it("carries the plan through the signup link", () => {
    expect(signupPathFor("enterprise")).toBe("/auth?mode=signup&plan=enterprise");
  });
});
