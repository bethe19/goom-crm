import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PLANS, type Plan, type PlanId, type PlanLimits } from "@/lib/plans";
import { effectiveLimits } from "@/components/settings/billing";

export interface WorkspaceUsage {
  members: number;
  pending_invites: number;
  /** members + pending invitations (what the seat limit counts) */
  seats_used: number;
  pipelines: number;
  contacts: number;
  ai_requests_this_month: number;
}

type UsageKey = keyof PlanLimits;
const USAGE_FOR_LIMIT: Record<UsageKey, keyof WorkspaceUsage> = {
  seats: "seats_used",
  pipelines: "pipelines",
  contacts: "contacts",
  ai_requests_per_month: "ai_requests_this_month",
};

export const workspaceUsageKey = (orgId: string | undefined) => ["workspace-usage", orgId] as const;

/** Current usage of the plan-limited resources in this workspace (RPC `get_workspace_usage`). */
export function useWorkspaceUsage() {
  const { organization } = useAuth();
  return useQuery({
    queryKey: workspaceUsageKey(organization?.id),
    enabled: !!organization,
    queryFn: async (): Promise<WorkspaceUsage> => {
      const { data, error } = await supabase.rpc("get_workspace_usage");
      if (error) throw error;
      const u = (data ?? {}) as Partial<WorkspaceUsage>;
      return {
        members: Number(u.members ?? 0),
        pending_invites: Number(u.pending_invites ?? 0),
        seats_used: Number(u.seats_used ?? 0),
        pipelines: Number(u.pipelines ?? 0),
        contacts: Number(u.contacts ?? 0),
        ai_requests_this_month: Number(u.ai_requests_this_month ?? 0),
      };
    },
  });
}

/** The workspace's plan plus helpers to check limits before offering an action. */
export function usePlan() {
  const { organization, hasFeature } = useAuth();
  const usage = useWorkspaceUsage();
  const plan: Plan = PLANS[organization?.plan ?? "starter"];
  const billingState = organization?.billingState ?? "active";
  /** Limits in force now: the plan's, except that trials cap AI requests (see effectiveLimits). */
  const limits: PlanLimits = effectiveLimits(plan.id, billingState);

  /** Remaining capacity for a limit (null = unlimited, undefined = usage not loaded yet). */
  const remaining = (limit: UsageKey): number | null | undefined => {
    const max = limits[limit];
    if (max === null) return null;
    if (!usage.data) return undefined;
    return Math.max(0, max - usage.data[USAGE_FOR_LIMIT[limit]]);
  };

  /** True when adding `count` more would exceed the plan (false while usage is loading). */
  const wouldExceed = (limit: UsageKey, count = 1): boolean => {
    const left = remaining(limit);
    return typeof left === "number" && left < count;
  };

  return { plan, limits, billingState, usage, hasFeature, remaining, wouldExceed };
}

/**
 * Admin-only plan switch (RPC `set_workspace_plan`): any plan during the trial, downgrades once
 * paid (upgrades go through `useRequestPlan`). Blocked server-side if usage exceeds the target plan.
 */
export function useSetWorkspacePlan() {
  const { refreshUserRole } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (plan: PlanId) => {
      const { error } = await supabase.rpc("set_workspace_plan", { p_plan: plan });
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshUserRole();
      queryClient.invalidateQueries({ queryKey: ["workspace-usage"] });
    },
  });
}

/**
 * Admin-only: ask the Goom team to activate (or upgrade to) a paid plan; `null` withdraws the
 * request (RPC `request_plan`, works while the workspace is expired). There is no payment
 * gateway: the operator emails payment details and activates the plan once paid.
 */
export function useRequestPlan() {
  const { refreshUserRole } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (plan: PlanId | null) => {
      const { error } = await supabase.rpc("request_plan", { p_plan: plan });
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshUserRole();
      queryClient.invalidateQueries({ queryKey: ["workspace-usage"] });
    },
  });
}
