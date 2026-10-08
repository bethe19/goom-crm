import { differenceInCalendarDays, format } from "date-fns";
import type { BillingState } from "@/contexts/AuthContext";
import { formatDate } from "@/lib/formatters";
import {
  PLAN_ORDER,
  PLANS,
  TRIAL_AI_REQUESTS_PER_MONTH,
  formatLimit,
  type PlanFeature,
  type PlanId,
  type PlanLimits,
} from "@/lib/plans";

/** Settings → Plan & usage. */
export const BILLING_PATH = "/settings?tab=billing";

export type MeterTone = "ok" | "warning" | "full";

export interface UsageMeter {
  /** 0–100 for the bar (0 when unlimited). */
  percent: number;
  tone: MeterTone;
  /** "812 of 1,000" / "812 · Unlimited" */
  label: string;
  unlimited: boolean;
}

/** Warning from 80% of a limit; "full" at or above it. */
export const WARNING_THRESHOLD = 0.8;

export function usageMeter(used: number, limit: number | null): UsageMeter {
  const fmt = new Intl.NumberFormat();
  if (limit === null) {
    return { percent: 0, tone: "ok", label: `${fmt.format(used)} · Unlimited`, unlimited: true };
  }
  const ratio = limit <= 0 ? 1 : used / limit;
  const tone: MeterTone = ratio >= 1 ? "full" : ratio >= WARNING_THRESHOLD ? "warning" : "ok";
  return {
    percent: Math.max(0, Math.min(100, Math.round(ratio * 100))),
    tone,
    label: `${fmt.format(used)} of ${formatLimit(limit)}`,
    unlimited: false,
  };
}

export function planDirection(current: PlanId, target: PlanId): "upgrade" | "downgrade" | "same" {
  const diff = PLAN_ORDER.indexOf(target) - PLAN_ORDER.indexOf(current);
  return diff > 0 ? "upgrade" : diff < 0 ? "downgrade" : "same";
}

/** Features the workspace would lose by moving from `current` to `target`. */
export function featuresLost(current: PlanId, target: PlanId): PlanFeature[] {
  return PLANS[current].features.filter((f) => !PLANS[target].features.includes(f));
}

const LIMIT_LABELS: Record<keyof PlanLimits, string> = {
  seats: "seats",
  pipelines: "pipelines",
  contacts: "contacts",
  ai_requests_per_month: "AI requests / month",
};

/** Limits where current usage wouldn't fit in `target` (client-side preview; the server decides). */
export function limitsExceeded(
  target: PlanId,
  usage: { seats_used: number; pipelines: number; contacts: number } | undefined,
): string[] {
  if (!usage) return [];
  const limits = PLANS[target].limits;
  const out: string[] = [];
  if (limits.seats !== null && usage.seats_used > limits.seats) out.push(`${usage.seats_used} ${LIMIT_LABELS.seats} (max ${formatLimit(limits.seats)})`);
  if (limits.pipelines !== null && usage.pipelines > limits.pipelines)
    out.push(`${usage.pipelines} ${LIMIT_LABELS.pipelines} (max ${formatLimit(limits.pipelines)})`);
  if (limits.contacts !== null && usage.contacts > limits.contacts)
    out.push(`${new Intl.NumberFormat().format(usage.contacts)} ${LIMIT_LABELS.contacts} (max ${formatLimit(limits.contacts)})`);
  return out;
}

/* ------------------------------------------------------------- trial & billing state */

/** Trial banner turns urgent with this many days (or fewer) left. */
export const TRIAL_URGENT_DAYS = 3;

/**
 * Calendar days from `now` until the ISO timestamp `iso`: 0 on the last day, never negative.
 * Null when there is no (valid) date.
 */
export function daysUntil(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const end = new Date(iso);
  if (Number.isNaN(end.getTime())) return null;
  return Math.max(0, differenceInCalendarDays(end, now));
}

/** "12 days left in your free trial" / "1 day left…" / "Last day of your free trial". */
export function trialDaysLeftLabel(days: number): string {
  if (days <= 0) return "Last day of your free trial";
  return `${days} ${days === 1 ? "day" : "days"} left in your free trial`;
}

export function isTrialUrgent(days: number): boolean {
  return days <= TRIAL_URGENT_DAYS;
}

export interface BillingInfo {
  billingState: BillingState;
  trialEndsAt: string | null;
  paidUntil: string | null;
}

/**
 * One-line billing status for settings:
 * "Free trial · 9 days left (ends Oct 16, 2026)", "Paid · current period ends Nov 7, 2026",
 * "Free trial ended Oct 7, 2026" / "Subscription ended Oct 7, 2026".
 */
export function billingStatusLabel(info: BillingInfo, now: Date = new Date()): string {
  if (info.billingState === "trialing") {
    const days = daysUntil(info.trialEndsAt, now) ?? 0;
    const left = days <= 0 ? "last day" : `${days} ${days === 1 ? "day" : "days"} left`;
    return info.trialEndsAt ? `Free trial · ${left} (ends ${formatDate(info.trialEndsAt)})` : `Free trial · ${left}`;
  }
  if (info.billingState === "active") {
    return info.paidUntil ? `Paid · current period ends ${formatDate(info.paidUntil)}` : "Paid";
  }
  if (info.paidUntil) return `Subscription ended ${formatDate(info.paidUntil)}`;
  return info.trialEndsAt ? `Free trial ended ${formatDate(info.trialEndsAt)}` : "Free trial ended";
}

/** Paywall title: a workspace that has paid before had a subscription; otherwise its trial ended. */
export function endedTitle(paidUntil: string | null): string {
  return paidUntil ? "Your subscription has ended" : "Your free trial has ended";
}

/**
 * What changing to `target` means for an admin:
 * - "current": already on it;
 * - "switch": `set_workspace_plan` (any plan during the trial; downgrades once paid);
 * - "request": `request_plan` (upgrades once paid start after payment; anything once expired).
 * Never "switch" for an upgrade while paid: the database refuses it.
 */
export function planChangeMode(state: BillingState, current: PlanId, target: PlanId): "current" | "switch" | "request" {
  if (target === current) return "current";
  if (state === "trialing") return "switch";
  if (state === "active") return planDirection(current, target) === "upgrade" ? "request" : "switch";
  return "request";
}

/** The limits that actually apply: trials get at most TRIAL_AI_REQUESTS_PER_MONTH AI requests. */
export function effectiveLimits(plan: PlanId, state: BillingState | null | undefined): PlanLimits {
  const limits = PLANS[plan].limits;
  if (state !== "trialing") return limits;
  const ai = limits.ai_requests_per_month;
  return { ...limits, ai_requests_per_month: ai === null ? TRIAL_AI_REQUESTS_PER_MONTH : Math.min(ai, TRIAL_AI_REQUESTS_PER_MONTH) };
}

/** Confirmation shown after an admin requests a plan (no gateway: payment details are emailed). */
export function planRequestMessage(planName: string, email: string | null | undefined, state: BillingState): string {
  const who = email || "you";
  const after =
    state === "expired"
      ? "your workspace reopens as soon as payment is confirmed."
      : state === "trialing"
        ? `${planName} starts as soon as payment is confirmed.`
        : `${planName} applies as soon as payment is confirmed.`;
  return `We've received your request for ${planName}. We'll email ${who} with payment details; ${after}`;
}

const TRIAL_BANNER_KEY_PREFIX = "goom:trial-banner-dismissed:";

/** localStorage key that hides the trial banner for one workspace for the rest of the (local) day. */
export function trialBannerDismissKey(orgId: string, now: Date = new Date()): string {
  return `${TRIAL_BANNER_KEY_PREFIX}${orgId}:${format(now, "yyyy-MM-dd")}`;
}

/** True for the banner keys of `orgId` other than `keep` (old days to clean up). */
export function isStaleTrialBannerKey(key: string, orgId: string, keep: string): boolean {
  return key.startsWith(`${TRIAL_BANNER_KEY_PREFIX}${orgId}:`) && key !== keep;
}
