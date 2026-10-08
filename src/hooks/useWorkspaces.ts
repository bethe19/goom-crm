import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole, type BillingState } from "@/contexts/AuthContext";

export interface MyWorkspace {
  id: string;
  name: string;
  role: AppRole;
  suspended: boolean;
  billingState: BillingState;
}

/** Same rule as the database's _billing_state(). */
export function billingStateOf(trialEndsAt: string | null, paidUntil: string | null, now = Date.now()): BillingState {
  if (paidUntil && Date.parse(paidUntil) > now) return "active";
  if (trialEndsAt && Date.parse(trialEndsAt) > now) return "trialing";
  return "expired";
}

type MembershipRow = {
  role: AppRole;
  organizations: { id: string; name: string; status: string; trial_ends_at: string | null; paid_until: string | null } | null;
};

/** Every workspace the signed-in user belongs to (including ones whose trial ended). */
export function useMyWorkspaces() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-workspaces", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<MyWorkspace[]> => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("role, organizations!inner(id, name, status, trial_ends_at, paid_until)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return ((data ?? []) as unknown as MembershipRow[])
        .filter((m) => m.organizations)
        .map((m) => ({
          id: m.organizations!.id,
          name: m.organizations!.name,
          role: m.role,
          suspended: m.organizations!.status === "suspended",
          billingState: billingStateOf(m.organizations!.trial_ends_at, m.organizations!.paid_until),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

/**
 * Makes another workspace current. The database checks membership; refreshUserRole() reloads the
 * context, drops the previous workspace's cached records and tells other open tabs.
 */
export function useSwitchWorkspace() {
  const { user, refreshUserRole } = useAuth();
  return useMutation({
    mutationFn: async (organizationId: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ current_organization_id: organizationId })
        .eq("user_id", user!.id);
      if (error) throw error;
      await refreshUserRole();
    },
  });
}
