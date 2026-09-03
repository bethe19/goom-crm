import { Deal, useUpdateDeal } from "@/hooks/useDeals";
import { PipelineStage } from "@/hooks/usePipelineStages";
import { KanbanColumn } from "./KanbanColumn";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getDemoDeals, saveDemoDeals } from "@/lib/demoData";
import { useQueryClient } from "@tanstack/react-query";

interface KanbanBoardProps {
  stages: PipelineStage[];
  deals: Deal[];
  onDealClick: (deal: Deal) => void;
  onAddDeal: (stageId: string) => void;
  onDealMove?: (dealId: string, stageId: string) => void;
}

export function KanbanBoard({ stages, deals, onDealClick, onAddDeal, onDealMove }: KanbanBoardProps) {
  const { isDemoMode } = useAuth();
  const updateDeal = useUpdateDeal();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDrop = (dealId: string, stageId: string) => {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage_id === stageId) return;

    const targetStage = stages.find((s) => s.id === stageId);

    // Call optimistic parent updater immediately!
    if (onDealMove) {
      onDealMove(dealId, stageId);
    }

    if (isDemoMode) {
      // Local demo persistence
      const demoDeals = getDemoDeals();
      const updated = demoDeals.map((d) =>
        d.id === dealId ? { ...d, stage_id: stageId, stage_name: targetStage?.name || d.stage_name } : d
      );
      saveDemoDeals(updated);
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast({
        title: "Deal stage updated",
        description: `Moved "${deal.title}" to ${targetStage?.name || "new stage"}`,
      });
      return;
    }

    // Cloud Supabase update
    updateDeal.mutate(
      { id: dealId, stage_id: stageId },
      {
        onSuccess: () => {
          toast({ title: "Deal moved", description: `Moved to ${targetStage?.name || "new stage"}` });
        },
        onError: (err: any) => {
          queryClient.invalidateQueries({ queryKey: ["deals"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
          toast({
            title: "Failed to move deal",
            description: err?.message || "Could not update deal stage in database.",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 pt-1">
      {stages.map((stage) => (
        <KanbanColumn
          key={stage.id}
          stage={stage}
          deals={deals.filter((d) => d.stage_id === stage.id)}
          onDrop={handleDrop}
          onDealClick={onDealClick}
          onAddDeal={onAddDeal}
        />
      ))}
    </div>
  );
}
