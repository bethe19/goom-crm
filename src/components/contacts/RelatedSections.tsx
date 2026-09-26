import { useNavigate } from "react-router-dom";
import { Briefcase, Calendar, FileText, Mail, Phone, type LucideIcon } from "lucide-react";
import type { RelatedActivity, RelatedDeal } from "@/hooks/useContacts";
import { stageOutcome } from "@/hooks/usePipelineStages";
import { useAuth } from "@/contexts/AuthContext";
import { MarkdownView } from "@/components/ui/rich-text-editor";
import { ErrorState } from "@/components/common/States";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatRelativeDate } from "@/lib/formatters";

/** Section heading with an optional action on the right. */
export function SectionHeader({ title, count, action }: { title: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold">
        {title}
        {typeof count === "number" && <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">{count}</span>}
      </h3>
      {action}
    </div>
  );
}

function RowsSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

interface QueryLike<T> {
  data?: T;
  isLoading: boolean;
  error: unknown;
  refetch: () => unknown;
}

/** Deals linked to a record; clicking one opens it in the pipeline. */
export function RelatedDealsList({ query, emptyText }: { query: QueryLike<RelatedDeal[]>; emptyText: string }) {
  const navigate = useNavigate();
  const { organization } = useAuth();
  if (query.isLoading) return <RowsSkeleton />;
  if (query.error) return <ErrorState compact error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data?.length) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ul className="space-y-1.5">
      {query.data.map((d) => {
        const outcome = stageOutcome(d.pipeline_stages);
        return (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => navigate(`/pipeline?open=${d.id}`)}
              className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Briefcase className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.title}</p>
                <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                  {d.pipeline_stages && (
                    <>
                      <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: d.pipeline_stages.color }} aria-hidden />
                      {d.pipeline_stages.name}
                    </>
                  )}
                  {d.close_date && <span>· closes {formatDate(d.close_date)}</span>}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <span className="text-sm font-medium tabular-nums">{formatCurrency(d.value ?? 0, organization?.currency)}</span>
                {outcome !== "open" && (
                  <Badge variant={outcome === "won" ? "secondary" : "outline"} className="text-[11px] capitalize">
                    {outcome}
                  </Badge>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

const ACTIVITY_ICONS: Record<string, LucideIcon> = { call: Phone, email: Mail, meeting: Calendar, note: FileText };

/** Vertical activity timeline with safe markdown notes. */
export function ActivityTimeline({ query, emptyText, showContact }: { query: QueryLike<RelatedActivity[]>; emptyText: string; showContact?: boolean }) {
  if (query.isLoading) return <RowsSkeleton rows={3} />;
  if (query.error) return <ErrorState compact error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data?.length) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {query.data.map((a) => {
        const Icon = ACTIVITY_ICONS[a.type] ?? FileText;
        return (
          <li key={a.id} className="relative">
            <span className="absolute -left-[1.95rem] top-0 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card">
              <Icon className="h-3 w-3 text-muted-foreground" aria-hidden />
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <p className="text-sm font-medium">{a.title}</p>
              <time dateTime={a.created_at} className="text-xs text-muted-foreground" title={new Date(a.created_at).toLocaleString()}>
                {formatRelativeDate(a.created_at)}
              </time>
            </div>
            <p className="text-xs capitalize text-muted-foreground">
              {a.type}
              {showContact && a.contacts && (
                <span className="normal-case">
                  {" "}
                  · {a.contacts.first_name} {a.contacts.last_name}
                </span>
              )}
              {a.deals && <span className="normal-case"> · {a.deals.title}</span>}
            </p>
            {a.description && <MarkdownView value={a.description} className="mt-1 text-sm leading-relaxed text-foreground/90 break-words" />}
          </li>
        );
      })}
    </ol>
  );
}
