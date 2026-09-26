import { Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/common/States";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { findMember, memberName, type OwnerStats, type WorkspaceMember } from "@/hooks/useAnalytics";
import { ChartTooltipBox, SectionCard } from "./ChartParts";
import { ACCENT, MUTED_SERIES } from "./chartTheme";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/**
 * Owners ranked by won revenue in the period: won value (accent bar) against their open pipeline
 * (quiet bar), with win rate. Team viewers only — callers hide it for reps.
 */
export function Leaderboard({
  rows,
  members,
  membersLoading,
  currency = "USD",
  loading,
  className,
  description = "Won in the period, with each owner's open pipeline today",
}: {
  rows: OwnerStats[];
  members?: WorkspaceMember[];
  membersLoading?: boolean;
  currency?: string;
  loading?: boolean;
  className?: string;
  description?: React.ReactNode;
}) {
  const max = Math.max(0, ...rows.map((r) => Math.max(r.wonValue, r.openValue)));
  const table =
    rows.length > 0
      ? {
          columns: ["Owner", "Won", "Deals won", "Lost", "Win rate", "Open pipeline", "Open deals"],
          rows: rows.map((r) => [
            memberName(members, r.ownerId),
            formatCurrency(r.wonValue, currency),
            r.wonCount,
            r.lostCount,
            r.winRate === null ? "—" : formatPercent(r.winRate),
            formatCurrency(r.openValue, currency),
            r.openCount,
          ]),
        }
      : null;

  return (
    <SectionCard title="Leaderboard" description={description} className={className} table={table}>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-8 flex-1" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState compact icon={Users} title="No deals to rank yet" description="Owners appear here once they have open, won or lost deals." />
      ) : (
        <>
          <ol className="space-y-1" aria-label="Owners ranked by won revenue">
            {rows.map((r, i) => {
              const name = memberName(members, r.ownerId);
              const member = findMember(members, r.ownerId);
              const wonPct = max > 0 ? (r.wonValue / max) * 100 : 0;
              const openPct = max > 0 ? (r.openValue / max) * 100 : 0;
              return (
                <li key={r.ownerId ?? "none"}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        tabIndex={0}
                        className="grid grid-cols-[1.25rem_2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-1 py-1.5 outline-none transition-colors duration-150 hover:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`${i + 1}. ${name}: won ${formatCurrency(r.wonValue, currency)} from ${r.wonCount} deals, ${r.winRate === null ? "no closed deals" : `${formatPercent(r.winRate)} win rate`}, ${formatCurrency(r.openValue, currency)} open`}
                      >
                        <span className="text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                        <Avatar className="h-8 w-8">
                          {member?.avatar_url && <AvatarImage src={member.avatar_url} alt="" />}
                          <AvatarFallback className="text-[11px]">{r.ownerId ? initials(name) : "—"}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm text-foreground">
                              {membersLoading ? <Skeleton className="inline-block h-3.5 w-24 align-middle" /> : name}
                            </span>
                          </div>
                          <div className="mt-1 space-y-[2px]" aria-hidden>
                            <div className="h-2 w-full rounded-full bg-secondary">
                              <div className="h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none" style={{ width: `${Math.max(wonPct, r.wonValue > 0 ? 2 : 0)}%`, backgroundColor: ACCENT }} />
                            </div>
                            <div className="h-1 w-full rounded-full">
                              <div className="h-full rounded-full" style={{ width: `${Math.max(openPct, r.openValue > 0 ? 2 : 0)}%`, backgroundColor: MUTED_SERIES, opacity: 0.45 }} />
                            </div>
                          </div>
                        </div>
                        <div className="min-w-[6.5rem] text-right">
                          <div className="text-sm font-medium tabular-nums text-foreground">{formatCurrency(r.wonValue, currency)}</div>
                          <div className="text-[11px] tabular-nums text-muted-foreground">
                            {r.wonCount} won · {r.winRate === null ? "—" : formatPercent(r.winRate)}
                          </div>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="border-0 bg-transparent p-0 shadow-none">
                      <ChartTooltipBox
                        title={name}
                        rows={[
                          { label: "Won", value: formatCurrency(r.wonValue, currency), color: ACCENT, shape: "rect" },
                          { label: "Open pipeline", value: formatCurrency(r.openValue, currency), color: MUTED_SERIES, shape: "rect" },
                          { label: "Deals won / lost", value: `${r.wonCount} / ${r.lostCount}` },
                          { label: "Win rate", value: r.winRate === null ? "—" : formatPercent(r.winRate) },
                          { label: "Open deals", value: String(r.openCount) },
                        ]}
                      />
                    </TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ol>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground" aria-hidden>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-full" style={{ backgroundColor: ACCENT }} /> Won in period
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1 w-3 rounded-full" style={{ backgroundColor: MUTED_SERIES, opacity: 0.45 }} /> Open pipeline today
            </span>
          </div>
        </>
      )}
    </SectionCard>
  );
}
