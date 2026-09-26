import { useState } from "react";
import { Inbox } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/States";
import { formatDate, formatRelativeDate } from "@/lib/formatters";
import { usePlatformContactRequests, type PlatformContactRequestRow } from "@/hooks/usePlatform";
import { Pagination, TableFrame } from "./Pagination";
import { useClampPage } from "./usePagedList";

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

export function ContactRequestsList() {
  const [page, setPage] = useState(0);
  const query = usePlatformContactRequests(page);
  useClampPage(page, setPage, query.data);

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;

  if (query.isPending) return <ListSkeleton rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} title="Couldn't load contact requests" />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No contact requests yet"
        description="Messages sent through the contact form on the public site appear here."
      />
    );
  }

  return (
    <TableFrame busy={query.isFetching}>
      <Table className="min-w-[860px]" aria-label="Contact requests">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Date</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Company</TableHead>
            <TableHead className="w-[40%] pr-4">Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <RequestRow key={r.id} item={r} />
          ))}
        </TableBody>
      </Table>
      <Pagination page={page} rowCount={rows.length} total={total} onPageChange={setPage} fetching={query.isFetching} noun="Contact requests" />
    </TableFrame>
  );
}

function RequestRow({ item: r }: { item: PlatformContactRequestRow }) {
  const [expanded, setExpanded] = useState(false);
  const message = r.message?.trim() ?? "";
  const long = message.length > 140 || message.includes("\n");
  const email = r.email?.trim() ?? "";
  return (
    <TableRow className="align-top">
      <TableCell className="whitespace-nowrap pl-4 text-muted-foreground">
        {r.created_at ? (
          <time dateTime={r.created_at} title={formatRelativeDate(r.created_at)}>
            {formatDate(r.created_at)}
          </time>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="max-w-[180px] font-medium text-foreground">
        <span className="block truncate" title={r.name ?? undefined}>
          {r.name || "—"}
        </span>
      </TableCell>
      <TableCell className="max-w-[240px]">
        {email && EMAIL_RE.test(email) ? (
          <a
            href={`mailto:${encodeURIComponent(email).replace(/%40/g, "@")}`}
            className="block truncate rounded text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={email}
          >
            {email}
          </a>
        ) : (
          <span className="block truncate text-muted-foreground">{email || "—"}</span>
        )}
      </TableCell>
      <TableCell className="max-w-[180px] text-muted-foreground">
        <span className="block truncate" title={r.company ?? undefined}>
          {r.company || "—"}
        </span>
      </TableCell>
      <TableCell className="max-w-[420px] pr-4">
        {message ? (
          <div>
            <p className={expanded ? "whitespace-pre-wrap break-words" : "line-clamp-2 break-words"}>{message}</p>
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
          <span className="text-muted-foreground">No message</span>
        )}
      </TableCell>
    </TableRow>
  );
}
