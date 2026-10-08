import { useCallback, useMemo, useState } from "react";
import type { Deal } from "@/hooks/useDeals";
import type { PipelineStage } from "@/hooks/usePipelineStages";
import { KanbanColumn } from "./KanbanColumn";
import type { WorkspaceMember } from "./useWorkspaceMembers";

interface KanbanBoardProps {
  stages: PipelineStage[];
  deals: Deal[];
  currency?: string;
  ownerOf: (deal: Deal) => WorkspaceMember | undefined;
  stageInfo: (deal: Deal) => { days: number | null; since: string | null };
  onDealClick: (deal: Deal) => void;
  onAddDeal: (stageId: string) => void;
  /**
   * Called for drag-and-drop and for the card's "Move to…" menu. The parent persists (optimistically).
   * `source` tells them apart (after a menu move, keyboard focus should follow the card).
   */
  onDealMove: (deal: Deal, stage: PipelineStage, source: "drag" | "menu") => void;
}

/**
 * Dependency-free kanban (native HTML5 drag and drop). Touch and keyboard users move deals
 * with each card's "Move to…" menu. Columns scroll horizontally with snap on small screens.
 */
export function KanbanBoard({ stages, deals, currency, ownerOf, stageInfo, onDealClick, onAddDeal, onDealMove }: KanbanBoardProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const byStage = useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const s of stages) map.set(s.id, []);
    for (const d of deals) map.get(d.stage_id)?.push(d);
    return map;
  }, [stages, deals]);

  const handleDrop = useCallback(
    (dealId: string, stage: PipelineStage) => {
      setDraggingId(null);
      const deal = deals.find((d) => d.id === dealId);
      if (!deal || deal.stage_id === stage.id) return;
      onDealMove(deal, stage, "drag");
    },
    [deals, onDealMove],
  );
  const handleMenuMove = useCallback((deal: Deal, stage: PipelineStage) => onDealMove(deal, stage, "menu"), [onDealMove]);

  const handleDragStart = useCallback((deal: Deal) => setDraggingId(deal.id), []);
  const handleDragEnd = useCallback(() => setDraggingId(null), []);

  return (
    <div
      className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:snap-none sm:px-0"
      role="region"
      aria-label="Pipeline board"
    >
      {stages.map((stage) => (
        <KanbanColumn
          key={stage.id}
          stage={stage}
          stages={stages}
          deals={byStage.get(stage.id) ?? []}
          currency={currency}
          ownerOf={ownerOf}
          stageInfo={stageInfo}
          draggingId={draggingId}
          onDropDeal={handleDrop}
          onOpen={onDealClick}
          onMove={handleMenuMove}
          onAddDeal={onAddDeal}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />
      ))}
    </div>
  );
}
