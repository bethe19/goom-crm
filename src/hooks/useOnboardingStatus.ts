import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useOnboardingStatus() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["onboarding-status", user?.id],
    queryFn: async () => {
      if (!user) return { needsOnboarding: false };

      try {
        // Check if user has any pipelines — if not, they need onboarding
        const { data: pipelines, error } = await supabase
          .from("pipelines")
          .select("id")
          .limit(1);

        if (error) {
          console.warn("[Onboarding] Error checking pipelines:", error.message);
          return { needsOnboarding: false };
        }

        return { needsOnboarding: !pipelines || pipelines.length === 0 };
      } catch (err) {
        console.warn("[Onboarding] Exception checking pipelines:", err);
        return { needsOnboarding: false };
      }
    },
    enabled: !!user,
    retry: 1,
    staleTime: 60000,
  });
}
