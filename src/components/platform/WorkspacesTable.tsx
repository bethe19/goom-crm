import { useState } from "react";
import { BadgeCheck, Building2, CalendarPlus, CircleSlash, MoreHorizontal, PauseCircle, PlayCircle, SearchX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/States";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { errorMessage } from "@/components/settings/validation";
import { formatDate, formatNumber, formatRelativeDate } from "@/lib/formatters";
import { isPlanId, PLAN_ORDER, PLANS, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";
import {
  useEndPlatformSubscription,
  usePlatformWorkspaces,
  useSetPlatformWorkspacePlan,
  useSetPlatformWorkspaceStatus,
  type PlatformWorkspaceRow,
} from "@/hooks/usePlatform";
import { Pagination, SearchField, TableFrame } from "./Pagination";
import { useClampPage, usePagedList } from "./usePagedList";
import { BillingStateBadge, PlanBadge, WorkspaceStatusBadge } from "./badges";
import { ActivateWorkspaceDialog, ExtendTrialDialog } from "./BillingDialogs";
import { workspaceBillingBadge } from "./platformUtils";

export function WorkspacesTable() {
  const { searchInput, setSearchInput, search, page, setPage } = usePagedList();
  const query = usePlatformWorkspaces({ search, page });
  useClampPage(page, setPage, query.data);

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SearchField value={searchInput} onChange={setSearchInput} label="Search workspaces" placeholder="Search name or owner email…" />
        {query.data && (
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatNumber(total)} {total === 1 ? "workspace" : "workspaces"}
            {search ? " match" : ""}
          </p>
        )}
      </div>

      {query.isPending ? (
        <ListSkeleton rows={8} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} title="Couldn't load workspaces" />
      ) : rows.length === 0 ? (
        search ? (
          <EmptyState
            icon={SearchX}
            title="No workspaces match your search"
            description={`Nothing matches “${search}”. Try a workspace name or the owner's email.`}
            action={
              <Button variant="outline" onClick={() => setSearchInput("")}>
                Clear search
              </Button>
            }
          />
        ) : (
          <EmptyState icon={Building2} title="No workspaces yet" description="Workspaces appear here as soon as someone signs up and creates one." />
        )
      ) : (
        <TableFrame busy={query.isFetching}>
          <Table className="min-w-[1360px]" aria-label="Workspaces">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Workspace</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>Plan request</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead className="text-right">Deals</TableHead>
                <TableHead className="text-right">Contacts</TableHead>
                <TableHead className="text-right">AI (30d)</TableHead>
                <TableHead>Last activity</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12 pr-4">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((w) => (
                <TableRow key={w.id} className={cn(w.requested_plan && "bg-warning/5 hover:bg-warning/10")}>
                  <TableCell
                    className={cn("max-w-[220px] pl-4 font-medium text-foreground", w.requested_plan && "border-l-2 border-l-warning")}
                  >
                    <span className="block truncate" title={w.name}>
                      {w.name || "Untitled workspace"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <PlanBadge plan={w.plan} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <BillingStateBadge workspace={w} />
                    {w.billing_state !== "active" && (
                      <span className="mt-1 block text-xs text-muted-foreground">{workspaceBillingBadge(w).detail}</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {w.requested_plan ? (
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1.5">
                          <PlanBadge plan={w.requested_plan} />
                          <span className="text-xs font-medium text-warning">Pending</span>
                        </span>
                        {w.plan_requested_at && (
                          <time
                            dateTime={w.plan_requested_at}
                            title={formatDate(w.plan_requested_at)}
                            className="block text-xs text-muted-foreground"
                          >
                            Requested {formatRelativeDate(w.plan_requested_at)}
                          </time>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <WorkspaceStatusBadge status={w.status} />
                  </TableCell>
                  <TableCell className="max-w-[220px]">
                    {w.owner_email ? (
                      <span className="block truncate text-muted-foreground" title={w.owner_email}>
                        {w.owner_email}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(w.member_count)}</TableCell>
                  <TableCell className="text-right">{formatNumber(w.deal_count)}</TableCell>
                  <TableCell className="text-right">{formatNumber(w.contact_count)}</TableCell>
                  <TableCell className="text-right">{formatNumber(w.ai_requests_30d)}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {w.last_activity_at ? (
                      <time dateTime={w.last_activity_at} title={formatDate(w.last_activity_at)}>
                        {formatRelativeDate(w.last_activity_at)}
                      </time>
                    ) : (
                      "No activity"
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {w.created_at ? <time dateTime={w.created_at}>{formatDate(w.created_at)}</time> : "—"}
                  </TableCell>
                  <TableCell className="pr-4">
                    <WorkspaceActions workspace={w} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} rowCount={rows.length} total={total} onPageChange={setPage} fetching={query.isFetching} noun="Workspaces" />
        </TableFrame>
      )}
    </div>
  );
}

function WorkspaceActions({ workspace }: { workspace: PlatformWorkspaceRow }) {
  const confirm = useConfirm();
  const setPlan = useSetPlatformWorkspacePlan();
  const setStatus = useSetPlatformWorkspaceStatus();
  const endSubscription = useEndPlatformSubscription();
  const [dialog, setDialog] = useState<"activate" | "extend" | null>(null);
  const busy = setPlan.isPending || setStatus.isPending || endSubscription.isPending;
  const name = workspace.name || "this workspace";
  const suspended = workspace.status === "suspended";
  const paid = workspace.billing_state === "active";

  const endPaidPeriod = async () => {
    const trialLeft = !!workspace.trial_ends_at && Date.parse(workspace.trial_ends_at) > Date.now();
    const ok = await confirm({
      title: `End ${name}'s subscription now?`,
      description: trialLeft
        ? "The paid period ends immediately (for example after a refund). The workspace falls back to its free trial until that ends. Nothing is deleted."
        : "The paid period ends immediately (for example after a refund). Members lose access to the workspace's data until it's activated again. Nothing is deleted.",
      confirmLabel: "End subscription",
      destructive: true,
    });
    if (!ok) return;
    endSubscription.mutate(
      { orgId: workspace.id },
      {
        onSuccess: () => toast.success(`${name}'s subscription ended`),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  const changePlan = async (next: string) => {
    if (!isPlanId(next) || next === workspace.plan) return;
    const plan: PlanId = next;
    const ok = await confirm({
      title: `Switch ${name} to ${PLANS[plan].name}?`,
      description: `Limits and features change immediately for every member. ${PLANS[plan].name} allows ${describeLimits(plan)}.`,
      confirmLabel: `Switch to ${PLANS[plan].name}`,
      destructive: false,
    });
    if (!ok) return;
    setPlan.mutate(
      { orgId: workspace.id, plan },
      {
        onSuccess: () => toast.success(`${name} is now on ${PLANS[plan].name}`),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  const toggleStatus = async () => {
    const ok = await confirm(
      suspended
        ? {
            title: `Reactivate ${name}?`,
            description: "Members regain access to the workspace and its data right away.",
            confirmLabel: "Reactivate",
            destructive: false,
          }
        : {
            title: `Suspend ${name}?`,
            description:
              "Every member loses access to this workspace until you reactivate it. Nothing is deleted — its data stays intact and returns when reactivated.",
            confirmLabel: "Suspend workspace",
            destructive: true,
          },
    );
    if (!ok) return;
    setStatus.mutate(
      { orgId: workspace.id, status: suspended ? "active" : "suspended" },
      {
        onSuccess: () => toast.success(suspended ? `${name} reactivated` : `${name} suspended`),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" loading={busy} aria-label={`Actions for ${name}`}>
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">{name}</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setDialog("activate")}>
            <BadgeCheck className="mr-2 h-4 w-4" aria-hidden /> {paid ? "Renew / activate…" : "Activate…"}
          </DropdownMenuItem>
          {!paid && (
            <DropdownMenuItem onSelect={() => setDialog("extend")}>
              <CalendarPlus className="mr-2 h-4 w-4" aria-hidden /> Extend trial…
            </DropdownMenuItem>
          )}
          {paid && (
            <DropdownMenuItem onSelect={() => void endPaidPeriod()} className="text-destructive focus:text-destructive">
              <CircleSlash className="mr-2 h-4 w-4" aria-hidden /> End subscription
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Change plan</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={workspace.plan} onValueChange={(v) => void changePlan(v)}>
                {PLAN_ORDER.map((id) => (
                  <DropdownMenuRadioItem key={id} value={id}>
                    {PLANS[id].name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          {suspended ? (
            <DropdownMenuItem onSelect={() => void toggleStatus()}>
              <PlayCircle className="mr-2 h-4 w-4" aria-hidden /> Reactivate workspace
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => void toggleStatus()} className="text-destructive focus:text-destructive">
              <PauseCircle className="mr-2 h-4 w-4" aria-hidden /> Suspend workspace
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ActivateWorkspaceDialog workspace={workspace} open={dialog === "activate"} onOpenChange={(o) => setDialog(o ? "activate" : null)} />
      <ExtendTrialDialog workspace={workspace} open={dialog === "extend"} onOpenChange={(o) => setDialog(o ? "extend" : null)} />
    </>
  );
}

function describeLimits(plan: PlanId): string {
  const { seats, contacts, ai_requests_per_month } = PLANS[plan].limits;
  const fmt = (n: number | null, noun: string) => (n === null ? `unlimited ${noun}` : `${formatNumber(n)} ${noun}`);
  return `${fmt(seats, "seats")}, ${fmt(contacts, "contacts")} and ${fmt(ai_requests_per_month, "AI requests a month")}`;
}
