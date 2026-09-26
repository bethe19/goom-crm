import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PipelineStage {
  id: string;
  pipeline_id: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
  /** Closed-won stage (backend contract). Use this flag, never the stage name. */
  is_won?: boolean | null;
  /** Closed-lost stage (backend contract). */
  is_lost?: boolean | null;
  /** Default win probability (0–100) for deals entering this stage. */
  probability?: number | null;
}

export interface Pipeline {
  id: string;
  name: string;
  team_id?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function usePipelines(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["pipelines"],
    queryFn: async (): Promise<Pipeline[]> => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Pipeline[];
    },
    enabled: options?.enabled ?? true,
  });
}

export function usePipelineStages(pipelineId: string | undefined) {
  return useQuery({
    queryKey: ["pipeline_stages", pipelineId],
    queryFn: async (): Promise<PipelineStage[]> => {
      if (!pipelineId) return [];
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("*")
        .eq("pipeline_id", pipelineId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PipelineStage[];
    },
    enabled: !!pipelineId,
  });
}

/** "won" | "lost" | "open" — based on the stage flags, never the stage name. */
export function stageOutcome(stage: Pick<PipelineStage, "is_won" | "is_lost"> | null | undefined): "won" | "lost" | "open" {
  if (stage?.is_won) return "won";
  if (stage?.is_lost) return "lost";
  return "open";
}

/** Default probability for a deal entering `stage`: the stage's configured probability, else 100/0 for won/lost, else 50. */
export function defaultProbabilityForStage(stage: PipelineStage | null | undefined): number {
  if (!stage) return 50;
  if (typeof stage.probability === "number") return Math.max(0, Math.min(100, stage.probability));
  if (stage.is_won) return 100;
  if (stage.is_lost) return 0;
  return 50;
}
