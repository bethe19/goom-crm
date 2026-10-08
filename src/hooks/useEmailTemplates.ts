import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface EmailTemplate {
  id: string;
  user_id: string;
  name: string;
  subject: string;
  body: string;
  created_at: string;
  updated_at: string;
}

const templatesKey = ["email-templates"] as const;

/** The signed-in user's own email templates in the current workspace (personal, RLS-scoped), sorted by name. */
export function useEmailTemplates() {
  const { user, organization } = useAuth();
  return useQuery({
    queryKey: [...templatesKey, organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("email_templates").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as unknown as EmailTemplate[];
    },
    enabled: !!user,
  });
}

export function useCreateEmailTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (template: { user_id: string; name: string; subject: string; body: string }) => {
      const { data, error } = await supabase.from("email_templates").insert(template).select().single();
      if (error) throw error;
      return data as unknown as EmailTemplate;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: templatesKey }),
  });
}

export function useUpdateEmailTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; subject?: string; body?: string }) => {
      const { data, error } = await supabase.from("email_templates").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data as unknown as EmailTemplate;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: templatesKey }),
  });
}

export function useDeleteEmailTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("email_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: templatesKey }),
  });
}
