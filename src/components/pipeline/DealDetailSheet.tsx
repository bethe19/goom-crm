import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Activity as ActivityIcon, CheckSquare, History, Loader2, Lock, MoreHorizontal, NotebookPen, RotateCcw, Trash2, Trophy, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDeal, useDeleteDeal, useMoveDeal, useUpdateDeal, type Deal } from "@/hooks/useDeals";
import { stageOutcome, usePipelineStages, type PipelineStage } from "@/hooks/usePipelineStages";
import { useActivities, type Activity } from "@/hooks/useActivities";
import { useTasks } from "@/hooks/useTasks";
import { useDealAuditLog, type AuditEntry } from "@/hooks/useDealAuditLog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MarkdownView, RichTextEditor } from "@/components/ui/rich-text-editor";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/States";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, formatRelativeDate } from "@/lib/formatters";
import { errorMessage } from "@/components/settings/validation";
import { UpgradePrompt } from "@/components/settings/UpgradePrompt";
import { canModifyRecord } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { ActivityItem } from "@/components/activities/ActivityItem";
import { ActivityComposer } from "@/components/activities/ActivityComposer";
import { ActivityDetailDialog } from "@/components/activities/ActivityDetailDialog";
import { TaskItem } from "@/components/tasks/TaskItem";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { QuickAddTask } from "@/components/tasks/QuickAddTask";
import { FieldShell, InlineField } from "./InlineField";
import { useSaveStatus } from "./useSaveStatus";
import { LostReasonDialog } from "./LostReasonDialog";
import { CompanyPicker, ContactPicker, MemberPicker } from "./pickers";
import { isDealOverdue } from "./dealUtils";
import { memberName, useWorkspaceMembers, type WorkspaceMember } from "./useWorkspaceMembers";

interface DealDetailSheetProps {
  deal: Deal | null;
  /** Open by id instead (fetched; works for deals in any pipeline). Ignored when `deal` is set. */
  dealId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Stages of the deal's pipeline; fetched when omitted. */
  stages?: PipelineStage[];
}

export function DealDetailSheet({ deal: dealProp, dealId, open, onOpenChange, stages: stagesProp }: DealDetailSheetProps) {
  const id = dealProp?.id ?? dealId ?? null;
  const { data: live, isLoading, error, refetch } = useDeal(open ? id : null, { initialData: dealProp });
  const deal = live === undefined ? dealProp : live;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {deal ? (
          <DealDetailBody key={deal.id} deal={deal} stagesProp={stagesProp} onClose={() => onOpenChange(false)} />
        ) : isLoading ? (
          <div className="space-y-3 p-6">
            <SheetTitle className="sr-only">Loading deal</SheetTitle>
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <ListSkeleton rows={4} />
          </div>
        ) : error ? (
          <div className="p-6">
            <SheetTitle className="sr-only">Couldn't load deal</SheetTitle>
            <ErrorState error={error} onRetry={() => refetch()} compact />
          </div>
        ) : (
          <div className="p-6">
            <SheetTitle className="sr-only">Deal not found</SheetTitle>
            <EmptyState compact icon={XCircle} title="This deal no longer exists" description="It may have been deleted by a teammate." />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DealDetailBody({ deal, stagesProp, onClose }: { deal: Deal; stagesProp?: PipelineStage[]; onClose: () => void }) {
  const { organization, user, userRole, can, hasFeature } = useAuth();
  const canDelete = canModifyRecord(userRole, user?.id, deal, "delete");
  const canReassign = can("deals.reassign");
  const hasHistory = hasFeature("audit_history");
  const currency = organization?.currency;
  const { toast } = useToast();
  const confirm = useConfirm();
  const updateDeal = useUpdateDeal();
  const moveDeal = useMoveDeal();
  const deleteDeal = useDeleteDeal();
  const { byId } = useWorkspaceMembers();
  const { data: fetchedStages } = usePipelineStages(deal.pipeline_id);
  const stages = fetchedStages?.length ? fetchedStages : stagesProp ?? [];
  const stage = stages.find((s) => s.id === deal.stage_id);
  const outcome = stageOutcome(stage);
  const wonStage = stages.find((s) => s.is_won);
  const lostStage = stages.find((s) => s.is_lost);
  const reopenStage = [...stages].reverse().find((s) => !s.is_won && !s.is_lost);

  const [tab, setTab] = useState("overview");
  const [lostPrompt, setLostPrompt] = useState<PipelineStage | null>(null);
  const stageStatus = useSaveStatus();
  const ownerStatus = useSaveStatus();
  const companyStatus = useSaveStatus();
  const contactStatus = useSaveStatus();

  const save = async (patch: Record<string, unknown>) => {
    try {
      await updateDeal.mutateAsync({ id: deal.id, ...patch });
    } catch (err) {
      toast({ title: "Couldn't save change", description: errorMessage(err), variant: "destructive" });
      throw err;
    }
  };

  const move = async (target: PipelineStage, lostReason?: string) => {
    await stageStatus.run(async () => {
      try {
        await moveDeal.mutateAsync({ deal, stage: target, lostReason });
        toast({ title: target.is_won ? "Deal won" : target.is_lost ? "Deal marked as lost" : `Moved to ${target.name}`, variant: "success" });
      } catch (err) {
        toast({ title: "Couldn't move deal", description: errorMessage(err), variant: "destructive" });
        throw err;
      }
    });
  };

  const requestMove = (target: PipelineStage) => {
    if (target.id === deal.stage_id) return;
    if (target.is_lost) setLostPrompt(target);
    else void move(target);
  };

  const handleDelete = async () => {
    if (!(await confirm({ title: `Delete “${deal.title}”?`, description: "The deal is permanently deleted. Linked activities and tasks stay but lose the link.", confirmLabel: "Delete deal" }))) return;
    deleteDeal.mutate(deal.id, {
      onSuccess: () => {
        toast({ title: "Deal deleted", variant: "success" });
        onClose();
      },
      onError: (err) => toast({ title: "Couldn't delete deal", description: errorMessage(err), variant: "destructive" }),
    });
  };

  const overdue = isDealOverdue(deal, stage);

  return (
    <>
      <SheetHeader className="space-y-3 border-b px-6 pb-4 pt-6 text-left">
        <div className="flex flex-wrap items-center gap-2 pr-8 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage?.color }} aria-hidden />
            {stage?.name ?? "Unknown stage"}
          </span>
          {outcome === "won" && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-300">Won{deal.won_at ? ` · ${formatDate(deal.won_at)}` : ""}</span>}
          {outcome === "lost" && <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive">Lost{deal.lost_at ? ` · ${formatDate(deal.lost_at)}` : ""}</span>}
          <span className="ml-auto text-sm font-semibold tabular-nums">{formatCurrency(deal.value, currency)}</span>
        </div>
        <SheetTitle className="sr-only">{deal.title}</SheetTitle>
        <SheetDescription className="sr-only">Deal details, activity, tasks, notes and history.</SheetDescription>
        <InlineField
          id="deal-title-inline"
          label="Deal name"
          value={deal.title}
          validate={(v) => (!v ? "Name can't be empty" : v.length > 200 ? "Keep it under 200 characters" : null)}
          onSave={(v) => save({ title: v })}
          displayClassName="text-lg font-semibold"
        />
        <div className="flex flex-wrap items-center gap-2">
          {outcome === "open" && wonStage && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => requestMove(wonStage)} disabled={moveDeal.isPending}>
              <Trophy className="h-4 w-4" aria-hidden /> Mark won
            </Button>
          )}
          {outcome === "open" && lostStage && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => requestMove(lostStage)} disabled={moveDeal.isPending}>
              <XCircle className="h-4 w-4" aria-hidden /> Mark lost
            </Button>
          )}
          {outcome !== "open" && reopenStage && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => requestMove(reopenStage)} disabled={moveDeal.isPending}>
              <RotateCcw className="h-4 w-4" aria-hidden /> Reopen
            </Button>
          )}
          {moveDeal.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Saving" />}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="ml-auto h-9 w-9" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setTab("activity")}>Log activity</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setTab("tasks")}>Add task</DropdownMenuItem>
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleDelete} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" aria-hidden /> Delete deal
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SheetHeader>

      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <div className="overflow-x-auto border-b px-6">
          <TabsList className="my-2 h-9">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="activity" className="text-xs sm:text-sm">Activity</TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs sm:text-sm">Tasks</TabsTrigger>
            <TabsTrigger value="notes" className="text-xs sm:text-sm">Notes</TabsTrigger>
            <TabsTrigger value="history" className="gap-1 text-xs sm:text-sm">
              {!hasHistory && <Lock className="h-3 w-3" aria-label="Not included in your plan" />}
              History
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <TabsContent value="overview" className="mt-0 space-y-5">
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <InlineField
                id="deal-value-inline"
                label={`Value (${currency ?? "USD"})`}
                type="number"
                value={String(deal.value ?? 0)}
                display={<span className="font-medium tabular-nums">{formatCurrency(deal.value, currency)}</span>}
                validate={(v) => (v === "" || Number.isNaN(Number(v)) || Number(v) < 0 ? "Enter an amount of 0 or more" : null)}
                onSave={(v) => save({ value: Number(v) })}
                inputProps={{ min: 0, step: "any", inputMode: "decimal" }}
              />
              <InlineField
                id="deal-probability-inline"
                label="Probability"
                type="number"
                value={String(deal.probability ?? 0)}
                display={<span className="tabular-nums">{deal.probability}%</span>}
                validate={(v) => (v === "" || Number.isNaN(Number(v)) || Number(v) < 0 || Number(v) > 100 ? "Enter a number from 0 to 100" : null)}
                onSave={(v) => save({ probability: Math.round(Number(v)) })}
                inputProps={{ min: 0, max: 100, inputMode: "numeric" }}
              />
              <FieldShell label="Stage" htmlFor="deal-stage-select" status={stageStatus.status}>
                <Select value={deal.stage_id} onValueChange={(id) => { const s = stages.find((x) => x.id === id); if (s) requestMove(s); }}>
                  <SelectTrigger id="deal-stage-select" className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                          {s.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldShell>
              <FieldShell label="Owner" htmlFor="deal-owner-picker" status={ownerStatus.status}>
                <MemberPicker
                  id="deal-owner-picker"
                  value={deal.owner_id}
                  className="h-9"
                  disabled={!canReassign}
                  selectedLabel={!canReassign && deal.owner_id && deal.owner_id === user?.id ? "You" : undefined}
                  onChange={(v) => void ownerStatus.run(() => save({ owner_id: v }))}
                />
                {!canReassign && <p className="mt-1 text-xs text-muted-foreground">Only managers and admins can reassign deals.</p>}
              </FieldShell>
              <InlineField
                id="deal-close-inline"
                label="Close date"
                type="date"
                value={deal.close_date?.slice(0, 10) ?? ""}
                emptyText="Set a date"
                display={<span className={cn(overdue && "font-medium text-destructive")}>{deal.close_date ? formatDate(deal.close_date) : ""}{overdue ? " · overdue" : ""}</span>}
                onSave={(v) => save({ close_date: v || null })}
              />
              <FieldShell label="Company" htmlFor="deal-company-picker" status={companyStatus.status}>
                <CompanyPicker
                  id="deal-company-picker"
                  value={deal.company_id}
                  selectedLabel={deal.companies?.name}
                  className="h-9"
                  onChange={(v) => void companyStatus.run(() => save({ company_id: v }))}
                />
              </FieldShell>
              <FieldShell label="Contact" htmlFor="deal-contact-picker" status={contactStatus.status}>
                <ContactPicker
                  id="deal-contact-picker"
                  value={deal.contact_id}
                  companyId={deal.company_id}
                  selectedLabel={deal.contacts ? `${deal.contacts.first_name} ${deal.contacts.last_name}` : null}
                  className="h-9"
                  onChange={(v) => void contactStatus.run(() => save({ contact_id: v }))}
                />
              </FieldShell>
              {outcome === "lost" && (
                <InlineField
                  id="deal-lost-reason-inline"
                  label="Lost reason"
                  value={deal.lost_reason ?? ""}
                  emptyText="Add a reason"
                  onSave={(v) => save({ lost_reason: v || null })}
                />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Created {format(new Date(deal.created_at), "MMM d, yyyy")}
              {deal.created_by && byId.get(deal.created_by) ? ` by ${memberName(byId.get(deal.created_by))}` : ""} · Updated {formatRelativeDate(deal.updated_at)}
            </p>
          </TabsContent>

          <TabsContent value="activity" className="mt-0 space-y-4">
            <ActivityComposer dealId={deal.id} contactId={deal.contact_id} />
            <DealActivities dealId={deal.id} />
          </TabsContent>

          <TabsContent value="tasks" className="mt-0 space-y-4">
            <QuickAddTask dealId={deal.id} contactId={deal.contact_id ?? undefined} />
            <DealTasks dealId={deal.id} />
          </TabsContent>

          <TabsContent value="notes" className="mt-0">
            <DealNotes deal={deal} onSave={(notes) => save({ notes })} />
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            {hasHistory ? (
              <DealHistory deal={deal} members={byId} currency={currency} />
            ) : (
              <UpgradePrompt feature="audit_history" className="py-10" />
            )}
          </TabsContent>
        </div>
      </Tabs>

      <LostReasonDialog
        open={!!lostPrompt}
        dealTitle={deal.title}
        stageName={lostPrompt?.name}
        pending={moveDeal.isPending}
        onCancel={() => setLostPrompt(null)}
        onConfirm={async (reason) => {
          const target = lostPrompt;
          if (!target) return;
          await move(target, reason).catch(() => undefined);
          setLostPrompt(null);
        }}
      />
    </>
  );
}

function DealActivities({ dealId }: { dealId: string }) {
  const { data, isLoading, error, refetch } = useActivities({ deal_id: dealId, limit: 100 });
  const [editing, setEditing] = useState<Activity | null>(null);
  if (isLoading) return <ListSkeleton rows={3} />;
  if (error) return <ErrorState compact error={error} onRetry={() => refetch()} />;
  if (!data?.length) return <EmptyState compact icon={ActivityIcon} title="No activity yet" description="Log calls, emails, meetings and notes above." />;
  return (
    <>
      <ol className="space-y-2" aria-label="Activity timeline">
        {data.map((a) => (
          <li key={a.id}>
            <ActivityItem activity={a} hideDeal onOpen={setEditing} />
          </li>
        ))}
      </ol>
      <ActivityDetailDialog activity={editing} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} />
    </>
  );
}

function DealTasks({ dealId }: { dealId: string }) {
  const { data, isLoading, error, refetch } = useTasks({ deal_id: dealId, limit: 200 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => data?.find((t) => t.id === selectedId) ?? null, [data, selectedId]);
  if (isLoading) return <ListSkeleton rows={3} />;
  if (error) return <ErrorState compact error={error} onRetry={() => refetch()} />;
  if (!data?.length) return <EmptyState compact icon={CheckSquare} title="No tasks on this deal" description="Add the next step above and press Enter." />;
  return (
    <>
      <ul className="space-y-2" aria-label="Tasks">
        {data.map((t) => (
          <li key={t.id}>
            <TaskItem task={t} hideDeal onClick={() => setSelectedId(t.id)} />
          </li>
        ))}
      </ul>
      <TaskDetailDialog task={selected} open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)} />
    </>
  );
}

function DealNotes({ deal, onSave }: { deal: Deal; onSave: (notes: string | null) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(deal.notes ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(deal.notes ?? "");
  }, [deal.notes, editing]);

  if (editing) {
    return (
      <div className="space-y-3">
        <RichTextEditor value={draft} onChange={setDraft} rows={8} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(draft.trim() || null);
                setEditing(false);
              } catch {
                /* toast shown by onSave; keep the draft */
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Saving…
              </>
            ) : (
              "Save notes"
            )}
          </Button>
        </div>
      </div>
    );
  }
  if (!deal.notes) {
    return (
      <EmptyState
        compact
        icon={NotebookPen}
        title="No notes yet"
        description="Capture context, requirements and next steps."
        action={
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Add notes
          </Button>
        }
      />
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          Edit notes
        </Button>
      </div>
      <MarkdownView value={deal.notes} className="prose prose-sm max-w-none break-words text-sm text-foreground dark:prose-invert" />
    </div>
  );
}

const FIELD_LABELS: Record<string, string> = {
  stage_id: "Stage",
  value: "Value",
  probability: "Probability",
  owner_id: "Owner",
  close_date: "Close date",
  title: "Name",
  company_id: "Company",
  contact_id: "Contact",
  lost_reason: "Lost reason",
};

function describeEntry(e: AuditEntry, members: Map<string, WorkspaceMember>, currency?: string): string {
  switch (e.field) {
    case "stage_id":
      return `Moved from ${e.old_stage_name ?? "a deleted stage"} to ${e.new_stage_name ?? "a deleted stage"}`;
    case "value":
      return `Value changed from ${formatCurrency(Number(e.old_value || 0), currency)} to ${formatCurrency(Number(e.new_value || 0), currency)}`;
    case "probability":
      return `Probability changed from ${e.old_value ?? 0}% to ${e.new_value ?? 0}%`;
    case "owner_id": {
      const from = e.old_value ? memberName(members.get(e.old_value)) : "nobody";
      const to = e.new_value ? memberName(members.get(e.new_value)) : "nobody";
      return `Owner changed from ${from} to ${to}`;
    }
    case "close_date":
      return `Close date ${e.new_value ? `set to ${formatDate(e.new_value)}` : "cleared"}`;
    default: {
      const label = FIELD_LABELS[e.field] ?? e.field.replace(/_/g, " ");
      return e.new_value ? `${label} changed to “${e.new_value}”` : `${label} cleared`;
    }
  }
}

function DealHistory({ deal, members, currency }: { deal: Deal; members: Map<string, WorkspaceMember>; currency?: string }) {
  const { data, isLoading, error, refetch } = useDealAuditLog(deal.id);
  if (isLoading) return <ListSkeleton rows={3} />;
  if (error) return <ErrorState compact error={error} onRetry={() => refetch()} />;
  const creator = deal.created_by ? members.get(deal.created_by) : undefined;
  return (
    <ol className="relative space-y-4 border-l border-border pl-5" aria-label="Deal history">
      {(data ?? []).map((e) => {
        const actor = e.user_id ? members.get(e.user_id) : undefined;
        return (
          <li key={e.id} className="relative">
            <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-muted-foreground/60" aria-hidden />
            <p className="text-sm">{describeEntry(e, members, currency)}</p>
            <p className="text-xs text-muted-foreground">
              {actor ? `${memberName(actor)} · ` : ""}
              <time dateTime={e.created_at} title={format(new Date(e.created_at), "PPpp")}>
                {formatRelativeDate(e.created_at)}
              </time>
            </p>
          </li>
        );
      })}
      <li className="relative">
        <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-foreground" aria-hidden />
        <p className="flex items-center gap-1.5 text-sm">
          <History className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /> Deal created
        </p>
        <p className="text-xs text-muted-foreground">
          {creator ? `${memberName(creator)} · ` : ""}
          {format(new Date(deal.created_at), "MMM d, yyyy")}
        </p>
      </li>
    </ol>
  );
}
