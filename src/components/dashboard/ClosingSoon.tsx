import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/common/States";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/formatters";
import { daysUntil, parseDate, type AnalyticsDeal } from "@/hooks/useAnalytics";
import { cn } from "@/lib/utils";
import { SectionCard } from "./ChartParts";

interface ClosingSoonProps {
  deals: AnalyticsDeal[];
  currency?: string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  onOpenDeal: (dealId: string) => void;
  limit?: number;
  /** Deal (or stage) probability, for the chip next to each deal. */
  probabilityOf?: (deal: AnalyticsDeal) => number | null;
  /** Where "View more" goes (the forecast when the plan includes it). */
  moreHref?: string;
}

function whenLabel(days: number | null): string {
  if (days === null) return "";
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

/** Open deals with a close date in the next 30 days (computed by the caller). */
export function ClosingSoon({
  deals,
  currency = "USD",
  loading,
  error,
  onRetry,
  onOpenDeal,
  limit = 5,
  probabilityOf,
  moreHref = "/pipeline",
}: ClosingSoonProps) {
  const shown = deals.slice(0, limit);
  const total = deals.reduce((s, d) => s + d.value, 0);

  return (
    <SectionCard
      title="Closing soon"
      description={
        !loading && !error && deals.length > 0
          ? `${deals.length} open ${deals.length === 1 ? "deal" : "deals"} · ${formatCurrency(total, currency)} in the next 30 days`
          : "Open deals expected to close in the next 30 days"
      }
      action={
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground">
          <Link to={moreHref}>
            {moreHref.startsWith("/forecast") ? "Forecast" : "Pipeline"} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </Button>
      }
      bodyClassName="px-2 sm:px-3"
    >
      {loading ? (
        <div className="space-y-2 px-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState compact error={error} onRetry={onRetry} title="Couldn't load deals" />
      ) : shown.length === 0 ? (
        <EmptyState compact icon={CalendarClock} title="Nothing closing in the next 30 days" description="Set close dates on your deals to see what's coming up." />
      ) : (
        <ul>
          {shown.map((d) => {
            const days = daysUntil(d.close_date);
            const p = probabilityOf?.(d) ?? null;
            const close = parseDate(d.close_date);
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => onOpenDeal(d.id)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-150 hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg border text-center leading-none",
                      days !== null && days <= 3 ? "border-warning/40 bg-warning/10" : "border-border bg-secondary/50",
                    )}
                    aria-hidden
                  >
                    <span className="text-[11px] uppercase text-muted-foreground">{close ? format(close, "MMM") : ""}</span>
                    <span className="text-sm font-semibold text-foreground">{close ? format(close, "d") : ""}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{d.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {whenLabel(days)}
                      {d.company_name ? ` · ${d.company_name}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-medium tabular-nums text-foreground">{formatCurrency(d.value, currency)}</span>
                    {p !== null && <span className="block text-[11px] tabular-nums text-muted-foreground">{p}% likely</span>}
                  </span>
                </button>
              </li>
            );
          })}
          {deals.length > shown.length && (
            <li className="px-2 pt-1">
              <Link to={moreHref} className="text-xs font-medium text-muted-foreground hover:text-foreground">
                View {deals.length - shown.length} more
              </Link>
            </li>
          )}
        </ul>
      )}
    </SectionCard>
  );
}
