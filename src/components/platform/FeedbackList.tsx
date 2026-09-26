import { useState } from "react";
import { MessageSquare, Star } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/States";
import { formatDate, formatRelativeDate } from "@/lib/formatters";
import { usePlatformFeedback, type PlatformFeedbackRow } from "@/hooks/usePlatform";
import { Pagination, TableFrame } from "./Pagination";
import { useClampPage } from "./usePagedList";

const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  new: "info",
  reviewed: "secondary",
  in_progress: "warning",
  planned: "warning",
  resolved: "success",
  done: "success",
  closed: "muted",
  dismissed: "muted",
};

const humanize = (v: string) => {
  const s = v.replace(/[_-]+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : s;
};

export function FeedbackList() {
  const [page, setPage] = useState(0);
  const query = usePlatformFeedback(page);
  useClampPage(page, setPage, query.data);

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;

  if (query.isPending) return <ListSkeleton rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} title="Couldn't load feedback" />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No feedback yet"
        description="When people send product feedback from inside the app, it lands here."
      />
    );
  }

  return (
    <TableFrame busy={query.isFetching}>
      <Table className="min-w-[900px]" aria-label="Product feedback">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Date</TableHead>
            <TableHead>Rating</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="w-[40%]">Comment</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="pr-4">From</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((f) => (
            <FeedbackRow key={f.id} item={f} />
          ))}
        </TableBody>
      </Table>
      <Pagination page={page} rowCount={rows.length} total={total} onPageChange={setPage} fetching={query.isFetching} noun="Feedback" />
    </TableFrame>
  );
}

function FeedbackRow({ item: f }: { item: PlatformFeedbackRow }) {
  const [expanded, setExpanded] = useState(false);
  const comment = f.comment?.trim() ?? "";
  const long = comment.length > 140 || comment.includes("\n");
  return (
    <TableRow className="align-top">
      <TableCell className="whitespace-nowrap pl-4 text-muted-foreground">
        {f.created_at ? (
          <time dateTime={f.created_at} title={formatRelativeDate(f.created_at)}>
            {formatDate(f.created_at)}
          </time>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {f.rating == null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="inline-flex items-center gap-1 font-medium text-foreground" aria-label={`${f.rating} out of 5`}>
            <Star className="h-3.5 w-3.5 fill-current text-warning" aria-hidden />
            {f.rating}
            <span className="text-muted-foreground">/5</span>
          </span>
        )}
      </TableCell>
      <TableCell>{f.category ? <Badge variant="outline">{humanize(f.category)}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
      <TableCell className="max-w-[420px]">
        {comment ? (
          <div>
            <p className={expanded ? "whitespace-pre-wrap break-words" : "line-clamp-2 break-words"}>{comment}</p>
            {long && (
              <button
                type="button"
                className="mt-1 rounded text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">No comment</span>
        )}
      </TableCell>
      <TableCell>
        {f.status ? <Badge variant={STATUS_VARIANT[f.status] ?? "outline"}>{humanize(f.status)}</Badge> : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="max-w-[220px] pr-4">
        <div className="truncate text-foreground" title={f.user_email ?? undefined}>
          {f.user_email || "Anonymous"}
        </div>
        {f.workspace_name && (
          <div className="truncate text-xs text-muted-foreground" title={f.workspace_name}>
            {f.workspace_name}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
