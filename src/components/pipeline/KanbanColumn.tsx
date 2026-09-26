import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { Deal } from "@/hooks/useDeals";
import type { PipelineStage } from "@/hooks/usePipelineStages";
import { formatCompactCurrency, formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DealCard } from "./DealCard";
import { summarizeDeals } from "./dealUtils";
import type { WorkspaceMember } from "./useWorkspaceMembers";

export interface KanbanColumnProps {
  stage: PipelineStage;
  stages: PipelineStage[];
  deals: Deal[];
  currency?: string;
  ownerOf: (deal: Deal) => WorkspaceMember | undefined;
  stageInfo: (deal: Deal) => { days: number | null; since: string | null };
  draggingId: string | null;
  onDropDeal: (dealId: string, stage: PipelineStage) => void;
  onOpen: (deal: Deal) => void;
  onMove: (deal: Deal, stage: PipelineStage) => void;
  onAddDeal: (stageId: string) => void;
  onDragStart: (deal: Deal) => void;
  onDragEnd: () => void;
}

export function KanbanColumn({
  stage,
  stages,
  deals,
  currency,
  ownerOf,
  stageInfo,
  draggingId,
  onDropDeal,
  onOpen,
  onMove,
  onAddDeal,
  onDragStart,
  onDragEnd,
}: KanbanColumnProps) {
  const [isOver, setIsOver] = useState(false);
  // dragenter/dragleave fire for every child; count them so the highlight doesn't flicker.
  const depth = useRef(0);
  const summary = summarizeDeals(deals);
  const draggingFromHere = !!draggingId && deals.some((d) => d.id === draggingId);
  const canDrop = !!draggingId && !draggingFromHere;

  return (
    <section
      aria-label={`${stage.name}: ${summary.count} deals`}
      className="flex w-[85vw] max-w-[320px] shrink-0 snap-start flex-col sm:w-72"
    >
      <header className="mb-2 flex items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} aria-hidden />
          <h2 className="truncate text-sm font-semibold text-foreground">{stage.name}</h2>
          <span className="rounded-full bg-secondary px-1.5 text-xs font-medium tabular-nums text-muted-foreground" aria-label={`${summary.count} deals`}>
            {summary.count}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="rounded text-xs font-medium tabular-nums text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {formatCompactCurrency(summary.total, currency)}
              </span>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              <p>Total: {formatCurrency(summary.total, currency)}</p>
              <p>Weighted: {formatCurrency(summary.weighted, currency)}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => onAddDeal(stage.id)} aria-label={`Add deal to ${stage.name}`}>
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add deal</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <div
        data-stage-id={stage.id}
        className={cn(
          "flex min-h-[420px] flex-1 flex-col gap-2 rounded-xl border p-2 transition-colors duration-150 ease-out",
          isOver && canDrop ? "border-foreground/40 bg-secondary/70" : canDrop ? "border-dashed border-border bg-muted/40" : "border-border/60 bg-muted/30",
        )}
        onDragEnter={(e) => {
          e.preventDefault();
          depth.current += 1;
          setIsOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDragLeave={() => {
          depth.current = Math.max(0, depth.current - 1);
          if (depth.current === 0) setIsOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          depth.current = 0;
          setIsOver(false);
          const dealId = e.dataTransfer.getData("text/plain") || draggingId;
          if (dealId) onDropDeal(dealId, stage);
        }}
      >
        {deals.map((deal) => {
          const info = stageInfo(deal);
          return (
            <DealCard
              key={deal.id}
              deal={deal}
              stage={stage}
              stages={stages}
              owner={ownerOf(deal)}
              currency={currency}
              daysInStage={info.days}
              stageEnteredAt={info.since}
              dragging={draggingId === deal.id}
              onOpen={onOpen}
              onMove={onMove}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          );
        })}
        {deals.length === 0 && (
          <button
            type="button"
            onClick={() => onAddDeal(stage.id)}
            className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/70 px-3 py-8 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {canDrop ? "Drop here" : "No deals — add one"}
          </button>
        )}
      </div>
    </section>
  );
}
