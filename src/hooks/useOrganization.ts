import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface OrganizationPatch {
  name: string;
  monthly_quota: number;
  currency: string;
}

/** Admin only: renames the workspace and sets its currency / monthly quota, then reloads the auth context. */
export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  const { refreshUserRole } = useAuth();
  return useMutation({
    mutationFn: async ({ name, monthly_quota, currency }: OrganizationPatch) => {
      const { error } = await supabase.rpc("update_organization", {
        p_name: name.trim(),
        p_monthly_quota: monthly_quota,
        p_currency: currency,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshUserRole();
      // Currency and quota feed dashboards, forecasts and reports.
      queryClient.invalidateQueries();
    },
  });
}
