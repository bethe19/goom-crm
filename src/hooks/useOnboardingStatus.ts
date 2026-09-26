import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const onboardingStatusKey = (userId: string | undefined) => ["onboarding-status", userId] as const;

/**
 * Whether the signed-in user still needs the first-run setup: true until `complete_onboarding()`
 * stamps `profiles.onboarding_completed_at`. Fails open (no wizard) if the profile can't be read,
 * so a transient error never blocks the app.
 */
export function useOnboardingStatus() {
  const { user } = useAuth();

  return useQuery({
    queryKey: onboardingStatusKey(user?.id),
    enabled: !!user,
    retry: 1,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{ needsOnboarding: boolean }> => {
      if (!user) return { needsOnboarding: false };
      const { data, error } = await supabase
        .from("profiles")
        .select("onboarding_completed_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        console.warn("[Onboarding] Could not read onboarding status:", error.message);
        return { needsOnboarding: false };
      }
      const row = data as { onboarding_completed_at?: string | null } | null;
      return { needsOnboarding: !!row && !row.onboarding_completed_at };
    },
  });
}

/** Marks onboarding as done (persisted server-side) and refreshes everything the wizard may have changed. */
export function useCompleteOnboarding() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("complete_onboarding");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.setQueryData(onboardingStatusKey(user?.id), { needsOnboarding: false });
      queryClient.invalidateQueries();
    },
  });
}
