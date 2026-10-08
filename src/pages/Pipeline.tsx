import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Columns3, FileSpreadsheet, Kanban, List, Loader2, Plus, SearchX, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePipelines, usePipelineStages, type PipelineStage } from "@/hooks/usePipelineStages";
import { useDeal, useDeals, useMoveDeal, type Deal, type DealMoveRestore } from "@/hooks/useDeals";
import { useStageEnteredAt } from "@/hooks/useDealAuditLog";
import { useDebounce } from "@/hooks/useDebounce";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatters";
import { errorMessage } from "@/components/settings/validation";
import { PageBanner } from "@/components/PageBanner";
import { RepScopeNotice } from "@/components/settings/AccessNotice";
import { EmptyState, ErrorState } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { KanbanBoard } from "@/components/pipeline/KanbanBoard";
import { DealsTable } from "@/components/pipeline/DealsTable";
import { CreateDealDialog } from "@/components/pipeline/CreateDealDialog";
import { DealDetailSheet } from "@/components/pipeline/DealDetailSheet";
import { PipelineFilters } from "@/components/pipeline/PipelineFilters";
import { LostReasonDialog } from "@/components/pipeline/LostReasonDialog";
import { useWorkspaceMembers } from "@/components/pipeline/useWorkspaceMembers";
import { EMPTY_DEAL_FILTERS, daysSince, filterDeals, hasActiveDealFilters, openDeals, summarizeDeals, type DealFilters } from "@/components/pipeline/dealUtils";

const PIPELINE_KEY = "goom.pipeline.selected";
const VIEW_KEY = "goom.pipeline.view";
type ViewMode = "board" | "list";

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode) — the choice just isn't remembered */
  }
}

/** Focuses a board card's actions ("…") button, if the card is on screen. */
function focusDealActions(dealId: string) {
  document.querySelector<HTMLElement>(`[data-deal-id="${CSS.escape(dealId)}"] [data-deal-actions]`)?.focus();
}

function BoardSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden" aria-busy="true" aria-label="Loading pipeline">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="w-[85vw] max-w-[320px] shrink-0 space-y-2 sm:w-72">
          <Skeleton className="h-6 w-2/3" />
          <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-2">
            {Array.from({ length: 3 - (i % 2) }).map((__, j) => (
              <Skeleton key={j} className="h-[92px] w-full rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Pipeline() {
  const { user, organization, can, hasFeature } = useAuth();
  // "Days in stage" comes from the deal audit log, which is an Enterprise feature.
  const hasStageHistory = hasFeature("audit_history");
  const seesAll = can("records.view_all");
  const canManagePipelines = can("pipelines.manage");
  const currency = organization?.currency ?? "ETB";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Pipeline selection: ?pipeline= → remembered choice → first pipeline ──
  const pipelinesQ = usePipelines();
  const pipelines = useMemo(() => pipelinesQ.data ?? [], [pipelinesQ.data]);
  const [storedPipeline, setStoredPipeline] = useState(() => readStorage(PIPELINE_KEY));
  const urlPipeline = searchParams.get("pipeline");
  const pipeline = pipelines.find((p) => p.id === urlPipeline) ?? pipelines.find((p) => p.id === storedPipeline) ?? pipelines[0];

  const selectPipeline = useCallback(
    (id: string) => {
      writeStorage(PIPELINE_KEY, id);
      setStoredPipeline(id);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("pipeline", id);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const stagesQ = usePipelineStages(pipeline?.id);
  const dealsQ = useDeals(pipeline?.id);
  const enteredQ = useStageEnteredAt(pipeline?.id, { enabled: hasStageHistory });
  const { members, byId } = useWorkspaceMembers();
  const stages = useMemo(() => stagesQ.data ?? [], [stagesQ.data]);
  const deals = useMemo(() => dealsQ.data ?? [], [dealsQ.data]);

  // ── Filters & view ──
  const [filters, setFilters] = useState<DealFilters>(EMPTY_DEAL_FILTERS);
  const debouncedSearch = useDebounce(filters.search, 250);
  const effectiveFilters = useMemo(() => ({ ...filters, search: debouncedSearch }), [filters, debouncedSearch]);
  const filtered = useMemo(() => filterDeals(deals, effectiveFilters, user?.id, stages), [deals, effectiveFilters, user?.id, stages]);
  const filtersActive = hasActiveDealFilters(filters);
  // Money totals cover open deals only (won/lost aren't pipeline; won would count at 100% weighted).
  const openSummary = useMemo(() => summarizeDeals(openDeals(filtered, stages)), [filtered, stages]);
  const [view, setView] = useState<ViewMode>(() => (readStorage(VIEW_KEY) === "list" ? "list" : "board"));
  const changeView = (v: ViewMode) => {
    setView(v);
    writeStorage(VIEW_KEY, v);
  };

  // ── Dialogs, sheet and URL params ──
  const [createOpen, setCreateOpen] = useState(false);
  const [createStageId, setCreateStageId] = useState<string | undefined>();
  const [openDealId, setOpenDealId] = useState<string | null>(null);
  const openDealFromList = deals.find((d) => d.id === openDealId) ?? null;
  const { data: openedDeal } = useDeal(openDealFromList ? null : openDealId);
  const switchToOpenedPipeline = useRef(false);

  useEffect(() => {
    const openId = searchParams.get("open");
    const isNew = searchParams.get("new");
    if (!openId && !isNew) return;
    if (openId) {
      setOpenDealId(openId);
      switchToOpenedPipeline.current = true;
    }
    if (isNew) {
      setCreateStageId(undefined);
      setCreateOpen(true);
    }
    const next = new URLSearchParams(searchParams);
    next.delete("open");
    next.delete("new");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // A deal opened via ?open= may live in another pipeline: show that pipeline behind the sheet.
  useEffect(() => {
    if (switchToOpenedPipeline.current && openedDeal && pipeline && openedDeal.pipeline_id !== pipeline.id) {
      switchToOpenedPipeline.current = false;
      selectPipeline(openedDeal.pipeline_id);
    }
  }, [openedDeal, pipeline, selectPipeline]);

  // ── Moving deals (drag and drop or "Move to…") ──
  // mutateAsync per move: callbacks passed to mutate() are dropped once another move starts, losing toasts.
  const { mutateAsync: moveDealAsync } = useMoveDeal();
  const [pendingLost, setPendingLost] = useState<{ deal: Deal; stage: PipelineStage; refocus: boolean } | null>(null);
  // A "Move to…" re-creates the card in another column: keyboard focus follows it to its actions button.
  const refocusAfterMove = useRef<{ dealId: string; stageId: string } | null>(null);

  const doMove = useCallback(
    async (deal: Deal, stage: PipelineStage, options?: { lostReason?: string; undoable?: boolean; restore?: DealMoveRestore }) => {
      const from = stages.find((s) => s.id === deal.stage_id);
      try {
        await moveDealAsync({ deal, stage, lostReason: options?.lostReason, fromStage: from, restore: options?.restore });
      } catch (err) {
        toast({ title: `Couldn't move “${deal.title}”`, description: errorMessage(err), variant: "destructive" });
        return;
      }
      const undoable = options?.undoable ?? true;
      toast({
        title: stage.is_won ? `Won: ${deal.title}` : stage.is_lost ? `Lost: ${deal.title}` : `Moved to ${stage.name}`,
        description: stage.is_won || stage.is_lost ? undefined : deal.title,
        action:
          undoable && from
            ? {
                label: "Undo",
                // Put back the deal's own probability and lost reason, not the old stage's defaults.
                onClick: () =>
                  void doMove({ ...deal, stage_id: stage.id }, from, {
                    undoable: false,
                    restore: { probability: deal.probability, lost_reason: deal.lost_reason ?? null },
                  }),
              }
            : undefined,
      });
    },
    [moveDealAsync, stages, toast],
  );

  const handleMove = useCallback(
    (deal: Deal, stage: PipelineStage, source?: "drag" | "menu") => {
      if (deal.stage_id === stage.id) return;
      const refocus = source === "menu";
      if (stage.is_lost) {
        setPendingLost({ deal, stage, refocus });
        return;
      }
      if (refocus) refocusAfterMove.current = { dealId: deal.id, stageId: stage.id };
      void doMove(deal, stage);
    },
    [doMove],
  );

  useEffect(() => {
    const target = refocusAfterMove.current;
    if (!target) return;
    const moved = filtered.find((d) => d.id === target.dealId);
    if (moved && moved.stage_id !== target.stageId) return; // the optimistic move hasn't rendered yet
    refocusAfterMove.current = null;
    if (moved) focusDealActions(moved.id);
  }, [filtered]);

  // ── Card helpers ──
  const ownerOf = useCallback((deal: Deal) => (deal.owner_id ? byId.get(deal.owner_id) : undefined), [byId]);
  const entered = enteredQ.data;
  const stageInfo = useCallback(
    (deal: Deal) => {
      if (!hasStageHistory || !entered) return { days: null, since: null };
      const since = entered[deal.id] ?? deal.created_at;
      return { days: daysSince(since), since };
    },
    [entered, hasStageHistory],
  );

  // ── Empty-workspace actions ──
  const [creatingPipeline, setCreatingPipeline] = useState(false);
  const handleCreatePipeline = async () => {
    setCreatingPipeline(true);
    try {
      const { error } = await supabase.rpc("seed_default_pipeline");
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      toast({ title: "Pipeline created", variant: "success" });
    } catch (err) {
      toast({ title: "Couldn't create pipeline", description: errorMessage(err), variant: "destructive" });
    } finally {
      setCreatingPipeline(false);
    }
  };

  const openCreate = (stageId?: string) => {
    setCreateStageId(stageId);
    setCreateOpen(true);
  };

  // ── Content ──
  let content: React.ReactNode;
  if (pipelinesQ.isLoading) {
    content = <BoardSkeleton />;
  } else if (pipelinesQ.error) {
    content = <ErrorState title="Couldn't load pipelines" error={pipelinesQ.error} onRetry={() => pipelinesQ.refetch()} />;
  } else if (!pipeline) {
    content = (
      <EmptyState
        icon={Kanban}
        title="Set up your pipeline"
        description={
          canManagePipelines
            ? "Create a pipeline with standard sales stages to start tracking opportunities."
            : "This workspace doesn't have a pipeline yet. Ask an admin or manager to create one."
        }
        action={
          canManagePipelines ? (
            <Button onClick={handleCreatePipeline} disabled={creatingPipeline}>
              {creatingPipeline ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
              {creatingPipeline ? "Creating…" : "Create pipeline"}
            </Button>
          ) : undefined
        }
      />
    );
  } else if (stagesQ.isLoading || dealsQ.isLoading) {
    content = <BoardSkeleton />;
  } else if (stagesQ.error || dealsQ.error) {
    content = (
      <ErrorState
        title="Couldn't load this pipeline"
        error={stagesQ.error ?? dealsQ.error}
        onRetry={() => {
          stagesQ.refetch();
          dealsQ.refetch();
        }}
      />
    );
  } else if (stages.length === 0) {
    content = (
      <EmptyState
        icon={Columns3}
        title="This pipeline has no stages"
        description={
          canManagePipelines
            ? "Add stages in Settings to start tracking deals."
            : "Ask an admin or manager to add stages to this pipeline."
        }
        action={
          canManagePipelines ? (
            <Button asChild variant="outline">
              <Link to="/settings?tab=pipeline">
                <Settings2 className="h-4 w-4" aria-hidden /> Pipeline settings
              </Link>
            </Button>
          ) : undefined
        }
      />
    );
  } else if (deals.length === 0) {
    content = (
      <EmptyState
        icon={Kanban}
        title={seesAll ? "No deals yet" : "You don't have any deals yet"}
        description={
          seesAll
            ? "Add your first deal to start tracking it through the pipeline."
            : "Deals you create or that are assigned to you appear here."
        }
        action={
          <Button onClick={() => openCreate(stages[0]?.id)}>
            <Plus className="h-4 w-4" aria-hidden /> Add deal
          </Button>
        }
        secondaryAction={
          seesAll ? (
            <Button variant="outline" asChild>
              <Link to="/data">
                <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Import deals
              </Link>
            </Button>
          ) : undefined
        }
      />
    );
  } else if (filtered.length === 0) {
    content = (
      <EmptyState
        icon={SearchX}
        title="No deals match your filters"
        description="Try a different search or widen the filters."
        action={
          <Button variant="outline" onClick={() => setFilters(EMPTY_DEAL_FILTERS)}>
            Clear filters
          </Button>
        }
      />
    );
  } else if (view === "list") {
    content = <DealsTable deals={filtered} stages={stages} currency={currency} membersById={byId} onOpen={(d) => setOpenDealId(d.id)} />;
  } else {
    content = (
      <KanbanBoard
        stages={stages}
        deals={filtered}
        currency={currency}
        ownerOf={ownerOf}
        stageInfo={stageInfo}
        onDealClick={(d) => setOpenDealId(d.id)}
        onAddDeal={openCreate}
        onDealMove={handleMove}
      />
    );
  }

  const showToolbar = !!pipeline && stages.length > 0 && deals.length > 0;

  return (
    <div className="space-y-6">
      <PageBanner
        title="Pipeline"
        description={seesAll ? "Track every deal from first conversation to close." : "Your deals, from first conversation to close."}
      >
        <div className="flex flex-wrap items-center gap-2">
          {pipelines.length > 1 && pipeline && (
            <Select value={pipeline.id} onValueChange={selectPipeline}>
              <SelectTrigger className="h-10 w-[180px] text-sm" aria-label="Pipeline">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && changeView(v as ViewMode)} variant="outline" aria-label="View">
            <ToggleGroupItem value="board" aria-label="Board view" className="h-10 w-10 p-0">
              <Kanban className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view" className="h-10 w-10 p-0">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          <Button onClick={() => openCreate(stages[0]?.id)} disabled={!pipeline}>
            <Plus className="h-4 w-4" aria-hidden /> New deal
          </Button>
        </div>
      </PageBanner>

      {showToolbar && (
        <div className="space-y-3">
          <PipelineFilters
            filters={filters}
            onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
            onClear={() => setFilters(EMPTY_DEAL_FILTERS)}
            members={members}
            currentUserId={user?.id}
            currency={currency}
          />
          <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
            {filtersActive ? `${filtered.length} of ${deals.length} deals` : `${filtered.length} ${filtered.length === 1 ? "deal" : "deals"}`} ·{" "}
            {formatCurrency(openSummary.total, currency)} open · {formatCurrency(openSummary.weighted, currency)} weighted
          </p>
        </div>
      )}

      {!seesAll && <RepScopeNotice scope="deals" className="-mt-3" />}

      {content}

      <CreateDealDialog open={createOpen} onOpenChange={setCreateOpen} pipelineId={pipeline?.id} stages={stages} defaultStageId={createStageId} />

      <DealDetailSheet
        deal={openDealFromList}
        dealId={openDealId}
        open={!!openDealId}
        onOpenChange={(o) => !o && setOpenDealId(null)}
        stages={openDealFromList ? stages : undefined}
      />

      <LostReasonDialog
        open={!!pendingLost}
        dealTitle={pendingLost?.deal.title}
        stageName={pendingLost?.stage.name}
        onCancel={() => {
          // The dialog has no trigger to return focus to: put it back on the card's menu button.
          if (pendingLost?.refocus) {
            const id = pendingLost.deal.id;
            setTimeout(() => focusDealActions(id), 0);
          }
          setPendingLost(null);
        }}
        onConfirm={(reason) => {
          if (pendingLost) {
            if (pendingLost.refocus) refocusAfterMove.current = { dealId: pendingLost.deal.id, stageId: pendingLost.stage.id };
            void doMove(pendingLost.deal, pendingLost.stage, { lostReason: reason });
          }
          setPendingLost(null);
        }}
      />
    </div>
  );
}
