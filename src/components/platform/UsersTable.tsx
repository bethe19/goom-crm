import { SearchX, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/States";
import { formatDate, formatNumber, formatRelativeDate } from "@/lib/formatters";
import { usePlatformUsers } from "@/hooks/usePlatform";
import { Pagination, SearchField, TableFrame } from "./Pagination";
import { useClampPage, usePagedList } from "./usePagedList";
import { splitWorkspaces } from "./platformUtils";

export function UsersTable() {
  const { searchInput, setSearchInput, search, page, setPage } = usePagedList();
  const query = usePlatformUsers({ search, page });
  useClampPage(page, setPage, query.data);

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SearchField value={searchInput} onChange={setSearchInput} label="Search users" placeholder="Search email or name…" />
        {query.data && (
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatNumber(total)} {total === 1 ? "user" : "users"}
            {search ? " match" : ""}
          </p>
        )}
      </div>

      {query.isPending ? (
        <ListSkeleton rows={8} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} title="Couldn't load users" />
      ) : rows.length === 0 ? (
        search ? (
          <EmptyState
            icon={SearchX}
            title="No users match your search"
            description={`Nothing matches “${search}”. Try part of an email address or name.`}
            action={
              <Button variant="outline" onClick={() => setSearchInput("")}>
                Clear search
              </Button>
            }
          />
        ) : (
          <EmptyState icon={Users} title="No users yet" description="Accounts appear here as people sign up." />
        )
      ) : (
        <TableFrame busy={query.isFetching}>
          <Table className="min-w-[900px]" aria-label="Users">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">User</TableHead>
                <TableHead>Workspaces</TableHead>
                <TableHead>Email status</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead className="pr-4">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => {
                const workspaces = splitWorkspaces(u.workspaces);
                return (
                  <TableRow key={u.user_id}>
                    <TableCell className="max-w-[300px] pl-4">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium text-foreground" title={u.full_name ?? undefined}>
                          {u.full_name || u.email || "Unnamed user"}
                        </span>
                        {u.is_platform_admin && (
                          <Badge variant="default" className="shrink-0">
                            <ShieldCheck aria-hidden /> Platform admin
                          </Badge>
                        )}
                      </div>
                      {u.full_name && u.email && (
                        <div className="truncate text-xs text-muted-foreground" title={u.email}>
                          {u.email}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[260px]">
                      {workspaces.length === 0 ? (
                        <span className="text-muted-foreground">None</span>
                      ) : (
                        <span className="block truncate text-muted-foreground" title={workspaces.join(", ")}>
                          <span className="font-medium text-foreground">{formatNumber(workspaces.length)}</span> · {workspaces.join(", ")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.email_confirmed ? <Badge variant="success">Confirmed</Badge> : <Badge variant="warning">Unconfirmed</Badge>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {u.last_sign_in_at ? (
                        <time dateTime={u.last_sign_in_at} title={formatDate(u.last_sign_in_at)}>
                          {formatRelativeDate(u.last_sign_in_at)}
                        </time>
                      ) : (
                        "Never"
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap pr-4 text-muted-foreground">
                      {u.created_at ? <time dateTime={u.created_at}>{formatDate(u.created_at)}</time> : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Pagination page={page} rowCount={rows.length} total={total} onPageChange={setPage} fetching={query.isFetching} noun="Users" />
        </TableFrame>
      )}
    </div>
  );
}
