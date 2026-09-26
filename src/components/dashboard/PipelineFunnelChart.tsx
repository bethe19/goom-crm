import { Link } from "react-router-dom";
import { ArrowUpRight, ChevronDown, History, Layers, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState, ErrorState } from "@/components/common/States";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import type { AnalyticsPipeline, StageBreakdownRow, StageFlow } from "@/hooks/useAnalytics";
import { ChartTooltipBox, SectionCard } from "./ChartParts";
import { stageColor } from "./chartTheme";

interface PipelineFunnelChartProps {
  rows: StageBreakdownRow[];
  currency?: string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  title?: string;
  description?: React.ReactNode;
  /** Bar width by deal value (default) or deal count. */
  measure?: "value" | "count";
  /** Real stage-to-stage conversion from deal history; conversion is shown only when present. */
  flow?: StageFlow | null;
  /** Why conversion isn't shown (plan without history, or nothing has moved yet). */
  flowNote?: React.ReactNode;
  pipelines?: AnalyticsPipeline[];
  pipelineId?: string;
  onPipelineChange?: (id: string) => void;
  emptyAction?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

function days(n: number) {
  const r = Math.round(n);
  return r < 1 ? "under a day" : `${r} ${r === 1 ? "day" : "days"}`;
}

/**
 * Funnel of deals per stage in pipeline order (stage colors from the data). Without deal history
 * it is the current distribution; with history it adds real conversion and time in stage.
 */
export function PipelineFunnelChart({
  rows,
  currency = "USD",
  loading,
  error,
  onRetry,
  title = "Pipeline funnel",
  description = "Open deals in each stage right now",
  measure = "value",
  flow,
  flowNote,
  pipelines,
  pipelineId,
  onPipelineChange,
  emptyAction,
  emptyTitle = "No open deals in this pipeline",
  emptyDescription = "Create a deal to see how your pipeline is distributed.",
  className,
}: PipelineFunnelChartProps) {
  const amountOf = (r: StageBreakdownRow) => (measure === "value" ? r.value : r.count);
  const max = Math.max(0, ...rows.map(amountOf));
  const totalCount = rows.reduce((s, r) => s + r.count, 0);
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const flowById = new Map((flow?.hasHistory ? flow.rows : []).map((r) => [r.id, r]));
  const wonFlow = flow?.hasHistory ? flow.rows.find((r) => r.isWon) : undefined;
  const showFlow = flowById.size > 0;

  const action =
    pipelines && pipelines.length > 1 && onPipelineChange ? (
      <Select value={pipelineId} onValueChange={onPipelineChange}>
        <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="Pipeline">
          <SelectValue placeholder="Pipeline" />
        </SelectTrigger>
        <SelectContent>
          {pipelines.map((p) => (
            <SelectItem key={p.id} value={p.id} className="text-sm">
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : (
      <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground">
        <Link to="/pipeline">
          Open pipeline <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </Button>
    );

  const table =
    !loading && !error && totalCount > 0
      ? {
          columns: ["Stage", "Deals", "Value", "Weighted", "Share of value", ...(showFlow ? ["Moved on", "Avg time in stage"] : [])],
          rows: rows.map((r) => {
            const f = flowById.get(r.id);
            return [
              r.name,
              r.count,
              formatCurrency(r.value, currency),
              formatCurrency(r.weighted, currency),
              totalValue > 0 ? formatPercent(r.value / totalValue) : "—",
              ...(showFlow ? [f?.conversion == null ? "—" : formatPercent(f.conversion), f?.avgDaysInStage == null ? "—" : days(f.avgDaysInStage)] : []),
            ];
          }),
        }
      : null;

  return (
    <SectionCard
      title={title}
      description={description}
      action={action}
      table={table}
      className={className}
      headline={
        !loading && !error && totalCount > 0 ? (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-2xl font-semibold tracking-tight text-foreground">{formatCurrency(totalValue, currency)}</span>
            <span className="text-xs text-muted-foreground">
              {totalCount} open {totalCount === 1 ? "deal" : "deals"} · {formatCurrency(rows.reduce((s, r) => s + r.weighted, 0), currency)} weighted
            </span>
          </div>
        ) : undefined
      }
    >
      {loading ? (
        <div className="space-y-3">
          {[92, 74, 56, 40].map((w) => (
            <Skeleton key={w} className="mx-auto h-6" style={{ width: `${w}%` }} />
          ))}
        </div>
      ) : error ? (
        <ErrorState compact error={error} onRetry={onRetry} title="Couldn't load the pipeline" />
      ) : rows.length === 0 ? (
        <EmptyState compact icon={Layers} title="No stages yet" description="Add stages to your pipeline to see deals by stage." action={emptyAction} />
      ) : totalCount === 0 ? (
        <EmptyState compact icon={Layers} title={emptyTitle} description={emptyDescription} action={emptyAction} />
      ) : (
        <div>
          <ol className="space-y-0.5" aria-label={`${title}: stages in order`}>
            {rows.map((r, i) => {
              const amount = amountOf(r);
              const pct = max > 0 ? Math.max((amount / max) * 100, amount > 0 ? 4 : 1.5) : 1.5;
              const share = totalValue > 0 ? r.value / totalValue : null;
              const f = flowById.get(r.id);
              const color = stageColor(r.color);
              const next = rows[i + 1];
              return (
                <li key={r.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        tabIndex={0}
                        className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-md px-1 py-1 outline-none transition-colors duration-150 hover:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,9rem)_1fr_auto]"
                        aria-label={`${r.name}: ${r.count} ${r.count === 1 ? "deal" : "deals"}, ${formatCurrency(r.value, currency)}${
                          f?.conversion != null ? `, ${formatPercent(f.conversion)} moved on` : ""
                        }`}
                      >
                        <span className="order-1 flex min-w-0 items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: color }} aria-hidden />
                          <span className="truncate text-sm text-foreground">{r.name}</span>
                        </span>
                        <span className="order-3 col-span-2 flex h-6 items-center justify-center sm:order-2 sm:col-span-1" aria-hidden>
                          <span
                            className="h-6 rounded-[4px] transition-[width,filter] duration-200 ease-out group-hover:brightness-110 motion-reduce:transition-none"
                            style={{ width: `${pct}%`, backgroundColor: color, opacity: amount > 0 ? 0.9 : 0.25 }}
                          />
                        </span>
                        <span className="order-2 min-w-[5.5rem] text-right sm:order-3">
                          <span className="block text-sm font-medium tabular-nums text-foreground">
                            {measure === "value" ? formatCurrency(r.value, currency) : `${r.count} ${r.count === 1 ? "deal" : "deals"}`}
                          </span>
                          <span className="block text-[11px] tabular-nums text-muted-foreground">
                            {measure === "value" ? `${r.count} ${r.count === 1 ? "deal" : "deals"}` : formatCurrency(r.value, currency)}
                            {share !== null && !showFlow ? ` · ${formatPercent(share)}` : ""}
                          </span>
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="border-0 bg-transparent p-0 shadow-none">
                      <ChartTooltipBox
                        title={r.name}
                        rows={[
                          { label: "Value", value: formatCurrency(r.value, currency), color, shape: "rect" },
                          { label: "Deals", value: String(r.count) },
                          { label: "Weighted", value: formatCurrency(r.weighted, currency) },
                          ...(share !== null ? [{ label: "Share of pipeline", value: formatPercent(share) }] : []),
                          ...(f?.conversion != null ? [{ label: "Moved to next stage", value: formatPercent(f.conversion) }] : []),
                          ...(f?.avgDaysInStage != null ? [{ label: "Avg time in stage", value: days(f.avgDaysInStage) }] : []),
                        ]}
                      />
                    </TooltipContent>
                  </Tooltip>
                  {showFlow && next && f && (
                    <div className="flex items-center gap-1.5 py-0.5 pl-1 text-[11px] text-muted-foreground sm:pl-[calc(9rem+1.25rem)]">
                      <ChevronDown className="h-3 w-3" aria-hidden />
                      {f.conversion != null ? (
                        <span>
                          <span className="font-medium tabular-nums text-foreground">{formatPercent(f.conversion)}</span> moved on
                        </span>
                      ) : (
                        <span>No deals reached this stage yet</span>
                      )}
                      {f.avgDaysInStage != null && <span>· avg {days(f.avgDaysInStage)} here</span>}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          {showFlow && wonFlow && flow && flow.cohortSize > 0 && (
            <p className="mt-3 flex items-center gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
              <Trophy className="h-3.5 w-3.5 text-success" aria-hidden />
              <span>
                <span className="font-medium tabular-nums text-foreground">
                  {wonFlow.reached} of {flow.cohortSize}
                </span>{" "}
                deals reached a won stage ({formatPercent(wonFlow.reached / flow.cohortSize)}), from deal history.
              </span>
            </p>
          )}
          {!showFlow && flowNote && (
            <p className="mt-3 flex items-start gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
              <History className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{flowNote}</span>
            </p>
          )}
        </div>
      )}
    </SectionCard>
  );
}
