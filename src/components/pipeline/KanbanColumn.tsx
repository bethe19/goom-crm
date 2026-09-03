import { useState } from "react";
import { Deal } from "@/hooks/useDeals";
import { PipelineStage } from "@/hooks/usePipelineStages";
import { DealCard } from "./DealCard";
import { formatCurrency } from "@/lib/formatters";
import { Kanban, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface KanbanColumnProps {
  stage: PipelineStage;
  deals: Deal[];
  onDrop: (dealId: string, stageId: string) => void;
  onDealClick: (deal: Deal) => void;
  onAddDeal: (stageId: string) => void;
}

export function KanbanColumn({ stage, deals, onDrop, onDealClick, onAddDeal }: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const totalValue = deals.reduce((sum, d) => sum + Number(d.value || 0), 0);

  return (
    <div className="w-[280px] flex-shrink-0">
      {/* 2026 Modern Stage Column Header */}
      <div className="mb-2.5 flex items-center justify-between rounded-lg bg-card/60 px-3 py-2 border border-border/70 shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="text-xs font-semibold text-foreground truncate">{stage.name}</h3>
          <span className="rounded-full bg-secondary px-2 py-0.2 text-[10px] font-mono font-medium text-muted-foreground">
            {deals.length}
          </span>
        </div>

        {totalValue > 0 && (
          <span className="text-[11px] font-bold text-foreground font-mono">
            {formatCurrency(totalValue)}
          </span>
        )}
      </div>

      <div
        id={`column-${stage.id}`}
        data-stage-id={stage.id}
        className={`space-y-2.5 rounded-xl p-2.5 min-h-[460px] border transition-all duration-200 ${
          isDragOver
            ? "border-foreground/70 bg-secondary/60 ring-2 ring-foreground/10"
            : "border-border/60 bg-muted/20"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          const dealId = e.dataTransfer.getData("dealId") || e.dataTransfer.getData("text/plain");
          if (dealId) onDrop(dealId, stage.id);
        }}
      >
        {deals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Kanban className="h-7 w-7 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground/60 font-medium">No deals in stage</p>
          </div>
        ) : (
          deals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              stageColor={stage.color}
              onClick={() => onDealClick(deal)}
            />
          ))
        )}

        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 h-8 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-card/70 border border-dashed border-border/70 rounded-lg"
          onClick={() => onAddDeal(stage.id)}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add deal
        </Button>
      </div>
    </div>
  );
}
