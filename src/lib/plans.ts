/**
 * Plan catalog: the single client-side source of truth for plan names, prices, limits and
 * features (pricing page, billing settings, feature gates).
 *
 * MUST stay in sync with `public.plan_limits(text)` in the database, which is what actually
 * enforces seats, pipelines, contacts and AI requests. `null` means unlimited.
 */
export type PlanId = "starter" | "growth" | "enterprise";

export type PlanFeature =
  | "forecast" // Forecast page
  | "advanced_reports" // Reports beyond the core KPIs (period comparison, leaderboard, lost reasons, activity mix)
  | "csv_import"
  | "csv_export"
  | "audit_history" // Deal change history (enforced by RLS on deal_audit_log)
  | "workspace_backup" // JSON backup export of the whole workspace
  | "priority_support";

export interface PlanLimits {
  seats: number | null; // members + pending invitations
  pipelines: number | null;
  contacts: number | null;
  ai_requests_per_month: number | null;
}

export interface Plan {
  id: PlanId;
  name: string;
  /** Monthly price per workspace in USD once the free trial ends (paid by invoice or bank transfer). */
  price: number;
  tagline: string;
  limits: PlanLimits;
  features: PlanFeature[];
  /** Short, user-facing bullet list for pricing cards (in addition to limits). */
  highlights: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    name: "Starter",
    price: 24,
    tagline: "For founders and small teams getting a repeatable sales process in place.",
    limits: { seats: 3, pipelines: 1, contacts: 1_000, ai_requests_per_month: 50 },
    features: [],
    highlights: [
      "Visual pipeline with drag-and-drop",
      "Contacts, companies, activities and tasks",
      "Calendar and command palette",
      "Core dashboard KPIs",
      "AI assistant (50 requests / month)",
    ],
  },
  growth: {
    id: "growth",
    name: "Growth",
    price: 59,
    tagline: "For growing teams that need forecasting, reporting and data tools.",
    limits: { seats: 15, pipelines: 5, contacts: 25_000, ai_requests_per_month: 500 },
    features: ["forecast", "advanced_reports", "csv_import", "csv_export"],
    highlights: [
      "Everything in Starter",
      "Revenue forecast against quota",
      "Full reports: trends, win/loss, leaderboard, lost reasons",
      "CSV import wizard and full CSV export",
      "AI assistant (500 requests / month)",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    price: 119,
    tagline: "For scaling sales organizations that need unlimited scale and full history.",
    limits: { seats: null, pipelines: null, contacts: null, ai_requests_per_month: 2_000 },
    features: ["forecast", "advanced_reports", "csv_import", "csv_export", "audit_history", "workspace_backup", "priority_support"],
    highlights: [
      "Everything in Growth",
      "Unlimited users, pipelines and contacts",
      "Deal change history (audit trail)",
      "Full workspace backup export",
      "AI assistant (2,000 requests / month)",
      "Priority support",
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ["starter", "growth", "enterprise"];

/** Length of the free trial every new workspace starts with (`organizations.trial_ends_at` default). */
export const TRIAL_DAYS = 14;

/** Plan new workspaces trial by default. */
export const TRIAL_DEFAULT_PLAN: PlanId = "growth";

/**
 * AI assistant requests a month while a workspace is on its free trial, whatever the plan
 * (`consume_ai_quota` caps trials at LEAST(plan limit, 100)).
 */
export const TRIAL_AI_REQUESTS_PER_MONTH = 100;

export const FEATURE_LABELS: Record<PlanFeature, string> = {
  forecast: "Revenue forecast",
  advanced_reports: "Advanced reports",
  csv_import: "CSV import",
  csv_export: "CSV export",
  audit_history: "Deal change history",
  workspace_backup: "Workspace backup export",
  priority_support: "Priority support",
};

export function isPlanId(value: unknown): value is PlanId {
  return value === "starter" || value === "growth" || value === "enterprise";
}

export function planHasFeature(plan: PlanId | null | undefined, feature: PlanFeature): boolean {
  return !!plan && PLANS[plan].features.includes(feature);
}

/** The cheapest plan that includes `feature` (for "Upgrade to Growth" prompts). */
export function minimumPlanFor(feature: PlanFeature): Plan {
  return PLANS[PLAN_ORDER.find((id) => PLANS[id].features.includes(feature)) ?? "enterprise"];
}

export function formatLimit(value: number | null): string {
  return value === null ? "Unlimited" : new Intl.NumberFormat().format(value);
}
