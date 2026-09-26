import type { LucideIcon } from "lucide-react";
import { Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DeltaChip } from "./ChartParts";
import { Sparkline, type SparkPoint } from "./Sparkline";

export interface KpiDelta {
  /**
   * Signed change, or null when there's no honest comparison (then `fallback` is shown).
   * pct: relative change ratio (0.12 = +12%); pp: difference of two ratios; days: difference in days.
   */
  value: number | null;
  kind?: "pct" | "pp" | "days";
  /** Whether an increase is good (green) — e.g. "down" for sales cycle length. */
  goodWhen?: "up" | "down";
  /** Text after the change, e.g. "vs same days last month". */
  label: string;
  fallback?: string;
}

interface KpiCardProps {
  label: string;
  icon?: LucideIcon;
  /** Formatted value, or null when it can't be computed (renders "—" with `unavailableReason`). */
  value: string | null;
  unavailableReason?: string;
  /** Short explanation of how the number is calculated. */
  hint?: string;
  sub?: React.ReactNode;
  delta?: KpiDelta | null;
  /** Real per-period values (oldest first); the last point is the current period. */
  trend?: SparkPoint[] | null;
  trendLabel?: string;
  loading?: boolean;
}

/** Stat tile: label · value · delta vs a named period · sparkline of the underlying series. */
export function KpiCard({ label, icon: Icon, value, unavailableReason, hint, sub, delta, trend, trendLabel, loading }: KpiCardProps) {
  const hasTrend = !!trend && trend.length > 1 && trend.some((p) => p.value !== null && p.value !== 0);
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
          {hint && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="rounded-sm text-muted-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`How ${label.toLowerCase()} is calculated`}
                >
                  <Info className="h-3.5 w-3.5" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-[260px] text-xs">{hint}</TooltipContent>
            </Tooltip>
          )}
        </div>
        {Icon && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
      </div>

      <div className="mt-1.5 flex flex-1 flex-col">
        {loading ? (
          <>
            <Skeleton className="h-8 w-28" />
            <Skeleton className="mt-2 h-3.5 w-36" />
            <Skeleton className="mt-3 h-9 w-full" />
          </>
        ) : (
          <>
            {value === null ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    tabIndex={0}
                    className="inline-block w-fit cursor-help rounded-sm text-[1.75rem] font-semibold leading-tight tracking-tight text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`${label}: not available. ${unavailableReason ?? ""}`}
                  >
                    —
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-[240px] text-xs">{unavailableReason ?? "Not enough data yet."}</TooltipContent>
              </Tooltip>
            ) : (
              <div className="truncate text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground">{value}</div>
            )}
            {(delta || sub) && (
              <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                {delta &&
                  (delta.value === null ? (
                    <span>{delta.fallback ?? delta.label}</span>
                  ) : (
                    <>
                      <DeltaChip value={delta.value} kind={delta.kind} goodWhen={delta.goodWhen} />
                      <span>{delta.label}</span>
                    </>
                  ))}
                {delta && sub && <span aria-hidden>·</span>}
                {sub}
              </div>
            )}
            <div className="mt-auto">
              {hasTrend ? (
                <Sparkline points={trend!} label={trendLabel ?? `${label} trend`} />
              ) : trend ? (
                <p className="mt-3 flex h-[52px] items-end text-[11px] text-muted-foreground">Trend appears once there's history to show.</p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
