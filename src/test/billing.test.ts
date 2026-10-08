import { describe, expect, it } from "vitest";
import {
  billingStatusLabel,
  daysUntil,
  effectiveLimits,
  endedTitle,
  isStaleTrialBannerKey,
  isTrialUrgent,
  planChangeMode,
  planRequestMessage,
  trialBannerDismissKey,
  trialDaysLeftLabel,
} from "@/components/settings/billing";
import { PLANS, TRIAL_AI_REQUESTS_PER_MONTH } from "@/lib/plans";

// Local-time noon keeps calendar-day maths independent of the machine's time zone.
const NOW = new Date(2026, 9, 7, 12);
const at = (month: number, day: number, hour = 12) => new Date(2026, month, day, hour).toISOString();

describe("daysUntil", () => {
  it("counts calendar days and never goes negative", () => {
    expect(daysUntil(at(9, 16), NOW)).toBe(9);
    expect(daysUntil(at(9, 8, 1), NOW)).toBe(1);
    expect(daysUntil(at(9, 7, 23), NOW)).toBe(0);
    expect(daysUntil(at(9, 1), NOW)).toBe(0);
  });

  it("is null without a valid date", () => {
    expect(daysUntil(null, NOW)).toBeNull();
    expect(daysUntil(undefined, NOW)).toBeNull();
    expect(daysUntil("not a date", NOW)).toBeNull();
  });
});

describe("trial labels", () => {
  it("phrases the days left", () => {
    expect(trialDaysLeftLabel(12)).toBe("12 days left in your free trial");
    expect(trialDaysLeftLabel(1)).toBe("1 day left in your free trial");
    expect(trialDaysLeftLabel(0)).toBe("Last day of your free trial");
  });

  it("turns urgent in the last three days", () => {
    expect(isTrialUrgent(4)).toBe(false);
    expect(isTrialUrgent(3)).toBe(true);
    expect(isTrialUrgent(0)).toBe(true);
  });

  it("titles the paywall by whether the workspace ever paid", () => {
    expect(endedTitle(null)).toBe("Your free trial has ended");
    expect(endedTitle(at(8, 1))).toBe("Your subscription has ended");
  });
});

describe("billingStatusLabel", () => {
  it("describes a running trial", () => {
    expect(billingStatusLabel({ billingState: "trialing", trialEndsAt: at(9, 16), paidUntil: null }, NOW)).toBe(
      "Free trial · 9 days left (ends Oct 16, 2026)",
    );
    expect(billingStatusLabel({ billingState: "trialing", trialEndsAt: at(9, 7, 20), paidUntil: null }, NOW)).toBe(
      "Free trial · last day (ends Oct 7, 2026)",
    );
  });

  it("describes a paid period", () => {
    expect(billingStatusLabel({ billingState: "active", trialEndsAt: at(8, 1), paidUntil: at(10, 7) }, NOW)).toBe(
      "Paid · current period ends Nov 7, 2026",
    );
  });

  it("describes an ended trial or subscription", () => {
    expect(billingStatusLabel({ billingState: "expired", trialEndsAt: at(9, 1), paidUntil: null }, NOW)).toBe(
      "Free trial ended Oct 1, 2026",
    );
    expect(billingStatusLabel({ billingState: "expired", trialEndsAt: at(8, 1), paidUntil: at(9, 2) }, NOW)).toBe(
      "Subscription ended Oct 2, 2026",
    );
  });
});

describe("planChangeMode", () => {
  it("lets trials switch to any plan", () => {
    expect(planChangeMode("trialing", "growth", "enterprise")).toBe("switch");
    expect(planChangeMode("trialing", "growth", "starter")).toBe("switch");
    expect(planChangeMode("trialing", "growth", "growth")).toBe("current");
  });

  it("never switches to a bigger plan while paid", () => {
    expect(planChangeMode("active", "starter", "growth")).toBe("request");
    expect(planChangeMode("active", "enterprise", "starter")).toBe("switch");
  });

  it("only requests once expired", () => {
    expect(planChangeMode("expired", "growth", "starter")).toBe("request");
    expect(planChangeMode("expired", "growth", "enterprise")).toBe("request");
  });
});

describe("effectiveLimits", () => {
  it("caps AI requests during the trial only", () => {
    expect(effectiveLimits("enterprise", "trialing").ai_requests_per_month).toBe(TRIAL_AI_REQUESTS_PER_MONTH);
    expect(effectiveLimits("enterprise", "active")).toEqual(PLANS.enterprise.limits);
    expect(effectiveLimits("growth", "trialing").seats).toBe(PLANS.growth.limits.seats);
  });

  it("keeps a plan allowance that is already below the trial cap", () => {
    const starterAi = PLANS.starter.limits.ai_requests_per_month;
    const expected = starterAi === null ? TRIAL_AI_REQUESTS_PER_MONTH : Math.min(starterAi, TRIAL_AI_REQUESTS_PER_MONTH);
    expect(effectiveLimits("starter", "trialing").ai_requests_per_month).toBe(expected);
  });
});

describe("planRequestMessage", () => {
  it("names the plan, the email and what happens after payment", () => {
    expect(planRequestMessage("Growth", "a@b.co", "expired")).toBe(
      "We've received your request for Growth. We'll email a@b.co with payment details; your workspace reopens as soon as payment is confirmed.",
    );
    expect(planRequestMessage("Growth", null, "trialing")).toContain("We'll email you with payment details; Growth starts");
  });
});

describe("trial banner dismissal keys", () => {
  it("is per workspace and per local day", () => {
    const key = trialBannerDismissKey("org-1", NOW);
    expect(key).toBe("goom:trial-banner-dismissed:org-1:2026-10-07");
    expect(trialBannerDismissKey("org-1", new Date(2026, 9, 8, 0, 5))).not.toBe(key);
  });

  it("flags only the same workspace's older keys for cleanup", () => {
    const keep = trialBannerDismissKey("org-1", NOW);
    expect(isStaleTrialBannerKey("goom:trial-banner-dismissed:org-1:2026-10-06", "org-1", keep)).toBe(true);
    expect(isStaleTrialBannerKey(keep, "org-1", keep)).toBe(false);
    expect(isStaleTrialBannerKey("goom:trial-banner-dismissed:org-2:2026-10-06", "org-1", keep)).toBe(false);
    expect(isStaleTrialBannerKey("goom:current-org", "org-1", keep)).toBe(false);
  });
});
