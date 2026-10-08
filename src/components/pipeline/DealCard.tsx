import { memo } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, Check, MoreHorizontal, ArrowRightLeft } from "lucide-react";
import type { Deal } from "@/hooks/useDeals";
import type { PipelineStage } from "@/hooks/usePipelineStages";
import { formatCurrency, formatFriendlyDate } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { isDealOverdue } from "./dealUtils";
import { MemberAvatar } from "./MemberAvatar";
import type { WorkspaceMember } from "./useWorkspaceMembers";

interface DealCardProps {
  deal: Deal;
  stage: PipelineStage | undefined;
  stages: PipelineStage[];
  owner: WorkspaceMember | undefined;
  currency?: string;
  /** Days in the current stage, when known. */
  daysInStage?: number | null;
  stageEnteredAt?: string | null;
  dragging?: boolean;
  onOpen: (deal: Deal) => void;
  onMove: (deal: Deal, stage: PipelineStage) => void;
  onDragStart?: (deal: Deal) => void;
  onDragEnd?: () => void;
}

function DealCardImpl({
  deal,
  stage,
  stages,
  owner,
  currency,
  daysInStage,
  stageEnteredAt,
  dragging,
  onOpen,
  onMove,
  onDragStart,
  onDragEnd,
}: DealCardProps) {
  const overdue = isDealOverdue(deal, stage);

  return (
    <div
      draggable
      data-deal-id={deal.id}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", deal.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.(deal);
      }}
      onDragEnd={() => onDragEnd?.()}
      className={cn(
        "group relative cursor-grab select-none rounded-lg border border-border bg-card p-3 shadow-sm transition-[box-shadow,opacity,border-color] duration-150 ease-out hover:border-foreground/25 hover:shadow-md active:cursor-grabbing motion-reduce:transition-none",
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onOpen(deal)}
          className="min-w-0 text-left text-sm font-medium leading-snug text-foreground after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
        >
          <span className="line-clamp-2 break-words">{deal.title}</span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative z-10 -mr-1.5 -mt-1 h-7 w-7 shrink-0 rounded-md text-muted-foreground opacity-100 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 data-[state=open]:opacity-100"
              aria-label={`Actions for ${deal.title}`}
              data-deal-actions=""
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => onOpen(deal)}>Open deal</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
              <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden /> Move to…
            </DropdownMenuLabel>
            {stages.map((s) => (
              <DropdownMenuItem key={s.id} disabled={s.id === deal.stage_id} onSelect={() => onMove(deal, s)} className="gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                <span className="flex-1 truncate">{s.name}</span>
                {s.id === deal.stage_id && <Check className="h-3.5 w-3.5" aria-label="Current stage" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {deal.companies?.name && <p className="mt-0.5 truncate text-xs text-muted-foreground">{deal.companies.name}</p>}

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold tabular-nums text-foreground">{formatCurrency(deal.value, currency)}</span>
        <MemberAvatar member={owner} label="Owner" className="relative z-10" />
      </div>

      {(deal.close_date || daysInStage != null) && (
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-2 text-xs text-muted-foreground">
          {deal.close_date ? (
            <span className={cn("inline-flex items-center gap-1", overdue && "font-medium text-destructive")}>
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">Close date</span>
              {formatFriendlyDate(deal.close_date)}
              {overdue && <span className="sr-only">(overdue)</span>}
            </span>
          ) : (
            <span />
          )}
          {daysInStage != null && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="relative z-10 tabular-nums">{daysInStage}d in stage</span>
              </TooltipTrigger>
              <TooltipContent>
                In {stage?.name ?? "this stage"} since {stageEnteredAt ? format(parseISO(stageEnteredAt), "MMM d, yyyy") : "creation"}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );
}

export const DealCard = memo(DealCardImpl);
