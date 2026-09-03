import { Deal } from "@/hooks/useDeals";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Calendar, DollarSign, GripVertical, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DealCardProps {
  deal: Deal & { priority?: string; ai_score?: number };
  stageColor: string;
  onClick: () => void;
}

export function DealCard({ deal, stageColor, onClick }: DealCardProps) {
  const priority = deal.priority || (deal.value > 100000 ? "urgent" : deal.value > 60000 ? "high" : "medium");

  return (
    <div
      draggable
      id={`deal-${deal.id}`}
      data-deal-id={deal.id}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", deal.id);
        e.dataTransfer.setData("dealId", deal.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onClick}
      className="group relative cursor-grab active:cursor-grabbing rounded-xl border border-border/80 bg-card p-3 shadow-xs transition-all duration-200 hover:shadow-md hover:border-foreground/40 hover:-translate-y-0.5 min-h-[50px] select-none"
    >
      <div
        className="absolute left-0 top-0 h-full w-1 rounded-l-xl transition-all group-hover:w-1.5"
        style={{ backgroundColor: stageColor }}
      />
      <div className="ml-1.5 space-y-2">
        <div className="flex items-start justify-between gap-1">
          <h4 className="text-xs font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
            {deal.title}
          </h4>
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </div>

        {deal.companies && (
          <p className="text-[11px] font-medium text-muted-foreground truncate">
            {deal.companies.name}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {deal.value > 0 && (
              <span className="flex items-center font-semibold text-foreground text-xs">
                {formatCurrency(deal.value)}
              </span>
            )}
            {deal.probability > 0 && (
              <span className="text-[10px] font-mono text-muted-foreground bg-secondary/80 rounded px-1.5 py-0.5">
                {deal.probability}%
              </span>
            )}
          </div>

          <Badge
            variant="outline"
            className={`text-[9px] font-semibold px-1.5 py-0 uppercase tracking-wider ${
              priority === "urgent"
                ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
                : priority === "high"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "border-border/60 text-muted-foreground"
            }`}
          >
            {priority}
          </Badge>
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
          {deal.contacts ? (
            <span className="truncate max-w-[120px]">
              {deal.contacts.first_name} {deal.contacts.last_name}
            </span>
          ) : (
            <span />
          )}

          {deal.close_date && (
            <span className="flex items-center gap-1 shrink-0">
              <Calendar className="h-3 w-3" />
              {formatDate(deal.close_date)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
