import { PLAN_ORDER, PLANS, formatLimit, type PlanFeature, type PlanId, type PlanLimits } from "@/lib/plans";

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
