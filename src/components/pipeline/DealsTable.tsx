import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { Deal } from "@/hooks/useDeals";
import type { PipelineStage } from "@/hooks/usePipelineStages";
import { formatCurrency, formatFriendlyDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { isDealOverdue, openDeals, sortDeals, summarizeDeals, type DealSortKey, type SortDir } from "./dealUtils";
import { MemberAvatar } from "./MemberAvatar";
import { memberName, type WorkspaceMember } from "./useWorkspaceMembers";

interface DealsTableProps {
  deals: Deal[];
  stages: PipelineStage[];
  currency?: string;
  membersById: Map<string, WorkspaceMember>;
  onOpen: (deal: Deal) => void;
}

const COLUMNS: { key: DealSortKey; label: string; className?: string; numeric?: boolean }[] = [
  { key: "title", label: "Deal", className: "min-w-[200px]" },
  { key: "company", label: "Company", className: "min-w-[140px]" },
  { key: "stage", label: "Stage", className: "min-w-[130px]" },
  { key: "owner", label: "Owner", className: "min-w-[140px]" },
  { key: "value", label: "Value", numeric: true },
  { key: "probability", label: "Prob.", numeric: true },
  { key: "close_date", label: "Close date", className: "min-w-[110px]" },
];

export function DealsTable({ deals, stages, currency, membersById, onOpen }: DealsTableProps) {
  const [sort, setSort] = useState<{ key: DealSortKey; dir: SortDir }>({ key: "close_date", dir: "asc" });
  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);

  const sorted = useMemo(
    () =>
      sortDeals(deals, sort.key, sort.dir, {
        stagePosition: (id) => stageById.get(id)?.position ?? Number.MAX_SAFE_INTEGER,
        ownerName: (id) => {
          const m = id ? membersById.get(id) : undefined;
          return m ? memberName(m) : "";
        },
      }),
    [deals, sort, stageById, membersById],
  );
  // Totals cover open deals only: won/lost value isn't pipeline (and won would count at 100% weighted).
  const openSummary = useMemo(() => summarizeDeals(openDeals(deals, stages)), [deals, stages]);

  const toggleSort = (key: DealSortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "value" || key === "probability" ? "desc" : "asc" }));

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full caption-bottom text-sm">
          <thead className="sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_hsl(var(--border))]">
            <tr>
              {COLUMNS.map((c) => {
                const active = sort.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                    className={cn("h-10 px-3 text-left align-middle text-xs font-medium text-muted-foreground", c.numeric && "text-right", c.className)}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active && "text-foreground",
                      )}
                    >
                      {c.label}
                      {active ? (
                        sort.dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" aria-hidden /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden />
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((d) => {
              const stage = stageById.get(d.stage_id);
              const owner = d.owner_id ? membersById.get(d.owner_id) : undefined;
              const overdue = isDealOverdue(d, stage);
              return (
                <tr
                  key={d.id}
                  className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
                  onClick={() => onOpen(d)}
                >
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      className="text-left font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(d);
                      }}
                    >
                      {d.title}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{d.companies?.name ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage?.color }} aria-hidden />
                      {stage?.name ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-2">
                      <MemberAvatar member={owner} tooltip={false} className="h-5 w-5" />
                      <span className="truncate text-muted-foreground">{owner ? memberName(owner) : "Unassigned"}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">{formatCurrency(d.value, currency)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{d.probability}%</td>
                  <td className={cn("px-3 py-2.5 tabular-nums", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                    {d.close_date ? formatFriendlyDate(d.close_date) : "—"}
                    {overdue && <span className="sr-only"> (overdue)</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
        <span>
          {deals.length} {deals.length === 1 ? "deal" : "deals"}
        </span>
        <span className="tabular-nums">
          {formatCurrency(openSummary.total, currency)} open · {formatCurrency(openSummary.weighted, currency)} weighted
        </span>
      </div>
    </div>
  );
}
