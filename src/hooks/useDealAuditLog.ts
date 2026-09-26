import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AuditEntry {
  id: string;
  deal_id: string;
  user_id: string | null;
  field: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  old_stage_name?: string;
  new_stage_name?: string;
}

export function useDealAuditLog(dealId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["deal-audit-log", dealId],
    queryFn: async (): Promise<AuditEntry[]> => {
      const { data, error } = await supabase
        .from("deal_audit_log")
        .select("*")
        .eq("deal_id", dealId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      const entries = (data ?? []) as AuditEntry[];
      const stageIds = new Set<string>();
      entries.forEach((e) => {
        if (e.field === "stage_id") {
          if (e.old_value) stageIds.add(e.old_value);
          if (e.new_value) stageIds.add(e.new_value);
        }
      });

      const stageMap: Record<string, string> = {};
      if (stageIds.size > 0) {
        const { data: stages, error: stageError } = await supabase
          .from("pipeline_stages")
          .select("id, name")
          .in("id", Array.from(stageIds));
        if (stageError) throw stageError;
        stages?.forEach((s) => {
          stageMap[s.id] = s.name;
        });
      }

      return entries.map((e) => ({
        ...e,
        old_stage_name: e.field === "stage_id" && e.old_value ? stageMap[e.old_value] : undefined,
        new_stage_name: e.field === "stage_id" && e.new_value ? stageMap[e.new_value] : undefined,
      }));
    },
    enabled: !!dealId && (options?.enabled ?? true),
  });
}

/**
 * When each deal in a pipeline entered its current stage: the latest `stage_id` change in the
 * audit log. Deals with no stage change are absent (callers fall back to `created_at`).
 */
export function useStageEnteredAt(pipelineId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["deal-stage-entered", pipelineId],
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase
        .from("deal_audit_log")
        .select("deal_id, created_at, deals!inner(pipeline_id)")
        .eq("field", "stage_id")
        .eq("deals.pipeline_id", pipelineId)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of (data ?? []) as { deal_id: string; created_at: string }[]) {
        if (!map[row.deal_id]) map[row.deal_id] = row.created_at;
      }
      return map;
    },
    // The audit log is an Enterprise feature (RLS returns nothing on other plans).
    enabled: !!pipelineId && (options?.enabled ?? true),
    staleTime: 60_000,
  });
}
