import { describe, expect, it, beforeEach } from "vitest";
import { featuresLost, limitsExceeded, planDirection, usageMeter } from "@/components/settings/billing";
import { partitionDeletable, type RecordOwnership } from "@/hooks/useRecordPermissions";
import {
  PermissionDeniedError,
  assertAffected,
  errorMessage,
  invitableRoles,
  isPermissionError,
  isPlanLimitError,
} from "@/components/settings/validation";
import { AiNotDeployedError, AiPlanLimitError, AiRateLimitError, aiErrorFromStatus } from "@/lib/ai";
import { SELECTED_PLAN_KEY, clearSelectedPlan, readSelectedPlan, storeSelectedPlan } from "@/components/onboarding/selectedPlan";

describe("usageMeter", () => {
  it("formats used of limit and picks a tone", () => {
    expect(usageMeter(10, 100)).toMatchObject({ percent: 10, tone: "ok", label: "10 of 100", unlimited: false });
    expect(usageMeter(80, 100).tone).toBe("warning");
    expect(usageMeter(100, 100).tone).toBe("full");
    expect(usageMeter(120, 100)).toMatchObject({ percent: 100, tone: "full" });
  });
  it("handles unlimited limits", () => {
    expect(usageMeter(5, null)).toMatchObject({ unlimited: true, tone: "ok", percent: 0 });
    expect(usageMeter(5, null).label).toMatch(/Unlimited/);
  });
});

describe("plan switching helpers", () => {
  it("knows upgrade vs downgrade", () => {
    expect(planDirection("starter", "growth")).toBe("upgrade");
    expect(planDirection("enterprise", "growth")).toBe("downgrade");
    expect(planDirection("growth", "growth")).toBe("same");
  });
  it("lists features lost on downgrade", () => {
    expect(featuresLost("enterprise", "growth")).toEqual(["audit_history", "workspace_backup", "priority_support"]);
    expect(featuresLost("starter", "growth")).toEqual([]);
  });
  it("previews limits that would block a downgrade", () => {
    expect(limitsExceeded("starter", { seats_used: 4, pipelines: 1, contacts: 10 })).toHaveLength(1);
    expect(limitsExceeded("starter", { seats_used: 2, pipelines: 2, contacts: 5000 })).toHaveLength(2);
    expect(limitsExceeded("enterprise", { seats_used: 400, pipelines: 40, contacts: 1e6 })).toEqual([]);
    expect(limitsExceeded("starter", undefined)).toEqual([]);
  });
});

describe("partitionDeletable", () => {
  const lookup = new Map<string, RecordOwnership>([
    ["a", { created_by: "me" }],
    ["b", { created_by: "other" }],
    ["c", { created_by: null }],
  ]);
  it("lets admins and managers delete everything", () => {
    expect(partitionDeletable(["a", "b", "x"], lookup, "manager", "me")).toEqual({ allowed: ["a", "b", "x"], denied: 0 });
  });
  it("limits reps to their own records and counts the rest", () => {
    expect(partitionDeletable(["a", "b", "c", "unknown"], lookup, "rep", "me")).toEqual({ allowed: ["a"], denied: 3 });
  });
});

describe("error helpers", () => {
  it("recognises permission and plan-limit errors", () => {
    expect(isPermissionError({ code: "42501", message: "x" })).toBe(true);
    expect(isPermissionError({ message: "new row violates row-level security policy" })).toBe(true);
    expect(isPlanLimitError({ code: "P0001", message: "Your Starter plan includes 1,000 contacts. Upgrade to add more." })).toBe(true);
    expect(isPlanLimitError({ code: "P0001", message: "You can't remove the last admin" })).toBe(false);
  });
  it("shows plan-limit messages verbatim and permission errors kindly", () => {
    const msg = "Your Starter plan includes 1 pipeline. Upgrade to add more.";
    expect(errorMessage({ code: "P0001", message: msg })).toBe(msg);
    expect(errorMessage(new PermissionDeniedError())).toMatch(/permission/);
    expect(errorMessage({ code: "PGRST116", message: "JSON object requested" })).toMatch(/no longer exists/);
  });
  it("assertAffected throws only when nothing was written", () => {
    expect(() => assertAffected(0)).toThrow(PermissionDeniedError);
    expect(() => assertAffected(1)).not.toThrow();
    expect(() => assertAffected(null)).not.toThrow();
  });
  it("limits managers to inviting reps", () => {
    expect(invitableRoles(false).map((r) => r.value)).toEqual(["rep"]);
    expect(invitableRoles(true).map((r) => r.value)).toEqual(["admin", "manager", "rep"]);
  });
});

describe("aiErrorFromStatus", () => {
  it("treats a missing edge function as not deployed", () => {
    expect(aiErrorFromStatus(404)).toBeInstanceOf(AiNotDeployedError);
    expect(aiErrorFromStatus(undefined, { message: "Requested function was not found" })).toBeInstanceOf(AiNotDeployedError);
  });
  it("separates the monthly plan limit from per-minute throttling and keeps the server text", () => {
    const plan = aiErrorFromStatus(429, { code: "plan_limit", error: "Your workspace has used its 50 AI requests for this month." });
    expect(plan).toBeInstanceOf(AiPlanLimitError);
    expect(plan.message).toMatch(/50 AI requests/);
    const rate = aiErrorFromStatus(429, { code: "rate_limit", error: "You're sending requests too quickly." });
    expect(rate).toBeInstanceOf(AiRateLimitError);
    expect(rate).not.toBeInstanceOf(AiPlanLimitError);
    expect(rate.message).toMatch(/too quickly/);
  });
});

describe("selected plan from the pricing page", () => {
  beforeEach(() => sessionStorage.clear());
  it("stores only valid plan ids", () => {
    expect(storeSelectedPlan("bogus")).toBeNull();
    expect(sessionStorage.getItem(SELECTED_PLAN_KEY)).toBeNull();
    expect(storeSelectedPlan("growth")).toBe("growth");
    expect(readSelectedPlan()).toBe("growth");
    clearSelectedPlan();
    expect(readSelectedPlan()).toBeNull();
  });
});
