/**
 * Pure helpers and row types for the platform owner console (`/platform`).
 * Row shapes mirror the `platform_*` RPCs exactly (see the round-2 brief).
 */
import { addDays, addMonths, differenceInCalendarDays } from "date-fns";
import { isPlanId, type PlanId } from "@/lib/plans";
import { formatDate } from "@/lib/formatters";

export interface PlatformOverview {
  total_workspaces: number;
  active_workspaces_30d: number;
  suspended_workspaces: number;
  /** paid_until in the future */
  paying_workspaces: number;
  /** on a free trial and not paid */
  trialing_workspaces: number;
  /** trial and paid period both over: data locked behind the paywall */
  expired_workspaces: number;
  /** workspaces with a pending requested_plan (awaiting payment details / activation) */
  plan_requests: number;
  total_users: number;
  signups_7d: number;
  signups_30d: number;
  confirmed_users: number;
  plan_counts: Record<PlanId, number>;
  ai_requests_30d: number;
  total_deals: number;
  total_contacts: number;
}

export interface PlatformTimeseriesPoint {
  /** ISO date, `YYYY-MM-DD` */
  day: string;
  signups: number;
  new_workspaces: number;
  ai_requests: number;
}

export type WorkspaceStatus = "active" | "suspended";

/** Same values as `_billing_state()` in the database. */
export type WorkspaceBillingState = "trialing" | "active" | "expired";

export interface PlatformWorkspaceRow {
  id: string;
  name: string;
  plan: string;
  status: string;
  created_at: string;
  owner_email: string | null;
  member_count: number;
  deal_count: number;
  contact_count: number;
  ai_requests_30d: number;
  last_activity_at: string | null;
  trial_ends_at: string | null;
  paid_until: string | null;
  billing_state: WorkspaceBillingState;
  /** Plan an admin asked for (awaiting payment), or null. */
  requested_plan: PlanId | null;
  plan_requested_at: string | null;
  total_count: number;
}

export interface PlatformUserRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed: boolean;
  /** Comma-separated workspace names. */
  workspaces: string | null;
  is_platform_admin: boolean;
  total_count: number;
}

export interface PlatformFeedbackRow {
  id: string;
  created_at: string;
  rating: number | null;
  category: string | null;
  comment: string | null;
  status: string | null;
  user_email: string | null;
  workspace_name: string | null;
  total_count: number;
}

export interface PlatformContactRequestRow {
  id: string;
  created_at: string;
  name: string | null;
  email: string | null;
  company: string | null;
  message: string | null;
  total_count: number;
}

export interface PlatformPage<T> {
  rows: T[];
  total: number;
}

/** Coerces numeric-ish RPC values (int, bigint-as-string, null) to a finite number. */
export function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : 0;
}

export function normalizeOverview(raw: unknown): PlatformOverview {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const plans = (o.plan_counts && typeof o.plan_counts === "object" ? o.plan_counts : {}) as Record<string, unknown>;
  return {
    total_workspaces: toNumber(o.total_workspaces),
    active_workspaces_30d: toNumber(o.active_workspaces_30d),
    suspended_workspaces: toNumber(o.suspended_workspaces),
    paying_workspaces: toNumber(o.paying_workspaces),
    trialing_workspaces: toNumber(o.trialing_workspaces),
    expired_workspaces: toNumber(o.expired_workspaces),
    plan_requests: toNumber(o.plan_requests),
    total_users: toNumber(o.total_users),
    signups_7d: toNumber(o.signups_7d),
    signups_30d: toNumber(o.signups_30d),
    confirmed_users: toNumber(o.confirmed_users),
    plan_counts: {
      starter: toNumber(plans.starter),
      growth: toNumber(plans.growth),
      enterprise: toNumber(plans.enterprise),
    },
    ai_requests_30d: toNumber(o.ai_requests_30d),
    total_deals: toNumber(o.total_deals),
    total_contacts: toNumber(o.total_contacts),
  };
}

/** Total row count from a window-counted page (`total_count` on every row); 0 when empty. */
export function totalFromRows(rows: ReadonlyArray<{ total_count?: unknown }> | null | undefined): number {
  if (!rows || rows.length === 0) return 0;
  return toNumber(rows[0].total_count);
}

/** 1-based range shown in "Showing 1–50 of 312". `from` is 0 when there are no rows. */
export function pageRange(page: number, pageSize: number, rowCount: number): { from: number; to: number } {
  if (rowCount <= 0) return { from: 0, to: 0 };
  const from = page * pageSize + 1;
  return { from, to: from + rowCount - 1 };
}

/** Last valid page index for a total (0 when empty). */
export function lastPage(total: number, pageSize: number): number {
  return Math.max(0, Math.ceil(total / pageSize) - 1);
}

function addUtcDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Normalizes timeseries rows: coerces numbers, sorts by day and fills any missing days between
 * the first and last row with zeros so the x axis is continuous.
 */
export function fillDailySeries(rows: ReadonlyArray<Record<string, unknown>> | null | undefined): PlatformTimeseriesPoint[] {
  const points = (rows ?? [])
    .map((r) => ({
      day: String(r.day ?? "").slice(0, 10),
      signups: toNumber(r.signups),
      new_workspaces: toNumber(r.new_workspaces),
      ai_requests: toNumber(r.ai_requests),
    }))
    .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.day))
    .sort((a, b) => a.day.localeCompare(b.day));
  if (points.length < 2) return points;
  const byDay = new Map(points.map((p) => [p.day, p]));
  const out: PlatformTimeseriesPoint[] = [];
  const last = points[points.length - 1].day;
  // Guard against malformed input producing an unbounded loop.
  for (let day = points[0].day, i = 0; day <= last && i < 3660; day = addUtcDays(day, 1), i++) {
    out.push(byDay.get(day) ?? { day, signups: 0, new_workspaces: 0, ai_requests: 0 });
  }
  return out;
}

export interface SeriesSummary {
  total: number;
  peak: { day: string; value: number } | null;
}

export function summarizeSeries(points: PlatformTimeseriesPoint[], key: "signups" | "new_workspaces" | "ai_requests"): SeriesSummary {
  let total = 0;
  let peak: SeriesSummary["peak"] = null;
  for (const p of points) {
    total += p[key];
    if (p[key] > 0 && (!peak || p[key] > peak.value)) peak = { day: p.day, value: p[key] };
  }
  return { total, peak };
}

/** "Acme, Beta Co" → ["Acme", "Beta Co"] */
export function splitWorkspaces(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/* --------------------------------------------------------------------- billing */

const toTime = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
};

/**
 * The workspace's billing state: the RPC's `billing_state` when it's valid, otherwise derived from
 * the dates with the database rule (paid beats trial; neither in the future = expired).
 */
export function workspaceBillingState(
  raw: unknown,
  trialEndsAt: string | null,
  paidUntil: string | null,
  now: Date = new Date(),
): WorkspaceBillingState {
  if (raw === "trialing" || raw === "active" || raw === "expired") return raw;
  const paid = toTime(paidUntil);
  if (paid !== null && paid > now.getTime()) return "active";
  const trial = toTime(trialEndsAt);
  if (trial !== null && trial > now.getTime()) return "trialing";
  return "expired";
}

export function toPlanIdOrNull(value: unknown): PlanId | null {
  return isPlanId(value) ? value : null;
}

export interface BillingBadgeInfo {
  state: WorkspaceBillingState;
  /** "Trial · 5 days left", "Paid until Nov 7, 2026", "Expired" */
  label: string;
  /** Longer explanation for a tooltip / title. */
  detail: string;
  /** Trial ending within 3 days, or expired. */
  attention: boolean;
}

/** Badge text for the workspaces table. */
export function workspaceBillingBadge(
  row: Pick<PlatformWorkspaceRow, "billing_state" | "trial_ends_at" | "paid_until">,
  now: Date = new Date(),
): BillingBadgeInfo {
  if (row.billing_state === "trialing") {
    const t = toTime(row.trial_ends_at);
    const days = t === null ? null : Math.max(0, differenceInCalendarDays(new Date(t), now));
    const left = days === null ? "" : days === 0 ? " · last day" : ` · ${days} ${days === 1 ? "day" : "days"} left`;
    return {
      state: "trialing",
      label: `Trial${left}`,
      detail: row.trial_ends_at ? `Free trial ends ${formatDate(row.trial_ends_at)}` : "On a free trial",
      attention: days !== null && days <= 3,
    };
  }
  if (row.billing_state === "active") {
    return {
      state: "active",
      label: row.paid_until ? `Paid until ${formatDate(row.paid_until)}` : "Paid",
      detail: row.paid_until ? `Paid period ends ${formatDate(row.paid_until)}` : "Paid",
      attention: false,
    };
  }
  const ended = row.paid_until
    ? `Subscription ended ${formatDate(row.paid_until)}`
    : row.trial_ends_at
      ? `Trial ended ${formatDate(row.trial_ends_at)}`
      : "No active trial or paid period";
  return { state: "expired", label: "Expired", detail: `${ended} — data locked until activated`, attention: true };
}

/** Choices offered by the activation dialog (the RPC accepts 1–36). */
export const ACTIVATION_MONTHS = [1, 3, 6, 12, 24] as const;
/** Choices offered by the extend-trial dialog (the RPC accepts 1–90). */
export const TRIAL_EXTENSION_DAYS = [7, 14, 30] as const;

/** Preview of `platform_activate_workspace`: paid_until = max(paid_until, now) + months. */
export function activationEndsAt(paidUntil: string | null, months: number, now: Date = new Date()): Date {
  const paid = toTime(paidUntil);
  const from = paid !== null && paid > now.getTime() ? new Date(paid) : now;
  return addMonths(from, months);
}

/** Preview of `platform_extend_trial`: trial_ends_at = max(trial_ends_at, now) + days. */
export function trialExtendedTo(trialEndsAt: string | null, days: number, now: Date = new Date()): Date {
  const trial = toTime(trialEndsAt);
  const from = trial !== null && trial > now.getTime() ? new Date(trial) : now;
  return addDays(from, days);
}

/** Plan preselected when activating: the requested plan, else the current one (else Growth). */
export function defaultActivationPlan(row: Pick<PlatformWorkspaceRow, "requested_plan" | "plan">): PlanId {
  return row.requested_plan ?? (isPlanId(row.plan) ? row.plan : "growth");
}
