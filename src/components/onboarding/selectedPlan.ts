import { isPlanId, type PlanId } from "@/lib/plans";

/** sessionStorage key for the plan picked on the pricing page (/auth?mode=signup&plan=growth). */
export const SELECTED_PLAN_KEY = "goom_selected_plan";

export function readSelectedPlan(): PlanId | null {
  try {
    const value = sessionStorage.getItem(SELECTED_PLAN_KEY);
    return isPlanId(value) ? value : null;
  } catch {
    return null;
  }
}

export function storeSelectedPlan(value: string | null): PlanId | null {
  if (!isPlanId(value)) return null;
  try {
    sessionStorage.setItem(SELECTED_PLAN_KEY, value);
  } catch {
    // storage unavailable (private mode): the plan can still be chosen later in Settings
  }
  return value;
}

export function clearSelectedPlan() {
  try {
    sessionStorage.removeItem(SELECTED_PLAN_KEY);
  } catch {
    // ignore
  }
}
