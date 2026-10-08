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
import { startOfDay } from "date-fns";
import { parseQuickTask } from "@/components/tasks/taskUtils";
import { patchTaskCache } from "@/hooks/useTasks";
import { lastPageIndex, rangeNotSatisfiableTotal } from "@/lib/postgrest";
import { contactFormSchema, isValidPhone } from "@/components/contacts/contactForm";

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

describe("quick-add task parsing", () => {
  const NOW = new Date(2026, 9, 7, 10, 30);
  it("cuts the matched trailing date word, not an earlier occurrence", () => {
    const t = parseQuickTask("Review today's numbers today", NOW);
    expect(t.title).toBe("Review today's numbers");
    expect(t.due_date).toBe(startOfDay(NOW).toISOString());
  });
  it("cuts the matched priority flag, not a lookalike earlier in the title", () => {
    expect(parseQuickTask("Plan !highway trip !high", NOW)).toEqual({ title: "Plan !highway trip", due_date: null, priority: "high" });
  });
});

describe("patchTaskCache", () => {
  const task = { id: "t1", completed: false };
  it("leaves non-object cache data (e.g. the sidebar's overdue count) untouched", () => {
    expect(patchTaskCache(2, "t1", { completed: true })).toBe(2);
    expect(patchTaskCache(undefined, "t1", { completed: true })).toBeUndefined();
    expect(patchTaskCache(null, "t1", { completed: true })).toBeNull();
  });
  it("patches lists, infinite pages and single tasks", () => {
    expect(patchTaskCache([task, { id: "t2", completed: false }], "t1", { completed: true })).toEqual([
      { id: "t1", completed: true },
      { id: "t2", completed: false },
    ]);
    const infinite = { pages: [{ rows: [task], count: 1, from: 0 }], pageParams: [0] };
    expect(patchTaskCache(infinite, "t1", { completed: true })).toEqual({ pages: [{ rows: [{ id: "t1", completed: true }], count: 1, from: 0 }], pageParams: [0] });
    expect(patchTaskCache(task, "t1", { completed: true })).toEqual({ id: "t1", completed: true });
    expect(patchTaskCache(task, "other", { completed: true })).toBe(task);
  });
});

describe("out-of-range pages", () => {
  it("reads the total from PostgREST's PGRST103 error", () => {
    const err = { code: "PGRST103", message: "Requested range not satisfiable", details: "An offset of 50 was requested, but there are only 12 rows." };
    expect(rangeNotSatisfiableTotal(err)).toBe(12);
    expect(rangeNotSatisfiableTotal({ code: "PGRST103", details: null })).toBe(0);
    expect(rangeNotSatisfiableTotal({ code: "42501", message: "permission denied" })).toBeNull();
    expect(rangeNotSatisfiableTotal(null)).toBeNull();
  });
  it("finds the last page that has rows", () => {
    expect(lastPageIndex(0, 50)).toBe(0);
    expect(lastPageIndex(12, 50)).toBe(0);
    expect(lastPageIndex(50, 50)).toBe(0);
    expect(lastPageIndex(51, 50)).toBe(1);
  });
});

describe("contact phone validation", () => {
  it.each(["+1 (555) 123-4567", "555.123.4567", "020 7946 0958 x12", "12345"])("accepts %s", (phone) => {
    expect(isValidPhone(phone)).toBe(true);
  });
  it.each(["call me", "1234", "555-CALL-NOW", "+1 555 123 4567; DROP"])("rejects %s", (phone) => {
    expect(isValidPhone(phone)).toBe(false);
  });
  it("shows a friendly message and allows a blank phone", () => {
    const base = { first_name: "Ada", last_name: "", email: "", position: "", tags: "", company: null };
    expect(contactFormSchema.safeParse({ ...base, phone: "" }).success).toBe(true);
    const bad = contactFormSchema.safeParse({ ...base, phone: "abc" });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.message).toBe("Enter a valid phone number");
  });
});
