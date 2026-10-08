import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { assertAffected } from "@/components/settings/validation";
import { useEffect, useId } from "react";
import { ilikeAny } from "@/lib/postgrest";
import { fetchAllRows } from "@/lib/fetchAll";
import { defaultProbabilityForStage, type PipelineStage } from "@/hooks/usePipelineStages";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export interface Deal {
  id: string;
  title: string;
  company_id: string | null;
  contact_id: string | null;
  pipeline_id: string;
  stage_id: string;
  owner_id: string | null;
  value: number;
  probability: number;
  close_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  lost_reason?: string | null;
  won_at?: string | null;
  lost_at?: string | null;
  companies?: { id: string; name: string } | null;
  contacts?: { id: string; first_name: string; last_name: string } | null;
  profiles?: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

export const DEAL_SELECT = "*, companies(id, name), contacts(id, first_name, last_name)";

function normalizeDeal(row: Record<string, unknown>): Deal {
  const d = row as unknown as Deal;
  return { ...d, value: Number(d.value ?? 0), probability: Number(d.probability ?? 0) };
}

/** Everything that shows deal-derived numbers. Invalidating unknown keys is harmless. */
export function invalidateDealQueries(queryClient: QueryClient) {
  for (const key of ["deals", "deal", "deal-options", "deal-stage-entered", "deal-audit-log", "calendar", "dashboard", "dashboard-stats", "analytics", "forecast", "reports", "all-deals-for-picker"]) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
}

/** Mutation key shared by every stage move (also its serialization scope). */
export const DEAL_MOVE_KEY = ["deal-move"] as const;

const REALTIME_DEBOUNCE_MS = 400;

/**
 * Subscribes to realtime deal and stage changes of a pipeline (channel name unique to this mount).
 * Bursts of events (imports, bulk edits) are debounced into one refetch.
 */
function useRealtimeDeals(pipelineId: string | undefined) {
  const queryClient = useQueryClient();
  const uid = useId();
  useEffect(() => {
    if (!pipelineId) return;
    let dealsTimer: ReturnType<typeof setTimeout> | undefined;
    let stagesTimer: ReturnType<typeof setTimeout> | undefined;
    const refreshDeals = () => {
      clearTimeout(dealsTimer);
      dealsTimer = setTimeout(() => {
        // A move in flight refreshes everything when it settles; refetching now would undo its optimistic update.
        if (queryClient.isMutating({ mutationKey: DEAL_MOVE_KEY }) > 0) return;
        queryClient.invalidateQueries({ queryKey: ["deals", pipelineId] });
        queryClient.invalidateQueries({ queryKey: ["deal"] });
      }, REALTIME_DEBOUNCE_MS);
    };
    // New or changed stages: without them the board can't place deals that moved into a new stage.
    const refreshStages = () => {
      clearTimeout(stagesTimer);
      stagesTimer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["pipeline_stages", pipelineId] });
      }, REALTIME_DEBOUNCE_MS);
    };
    const channel = supabase
      .channel(`pipeline:${pipelineId}:${uid}:${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "deals", filter: `pipeline_id=eq.${pipelineId}` }, refreshDeals)
      .on("postgres_changes", { event: "*", schema: "public", table: "pipeline_stages", filter: `pipeline_id=eq.${pipelineId}` }, refreshStages)
      .subscribe();
    return () => {
      clearTimeout(dealsTimer);
      clearTimeout(stagesTimer);
      supabase.removeChannel(channel);
    };
  }, [pipelineId, queryClient, uid]);
}

/** All deals in a pipeline (the board needs every deal to compute column totals). */
export function useDeals(pipelineId: string | undefined, options?: { enabled?: boolean; realtime?: boolean }) {
  const query = useQuery({
    queryKey: ["deals", pipelineId],
    queryFn: async ({ signal }): Promise<Deal[]> => {
      if (!pipelineId) return [];
      // Paged: a single request is capped at 1,000 rows. created_at + id keeps pages stable.
      const rows = await fetchAllRows(
        (from, to) =>
          supabase
            .from("deals")
            .select(DEAL_SELECT)
            .eq("pipeline_id", pipelineId)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to)
            .abortSignal(signal),
        { signal },
      );
      return rows.map(normalizeDeal);
    },
    enabled: !!pipelineId && (options?.enabled ?? true),
  });
  useRealtimeDeals(options?.realtime === false ? undefined : pipelineId);
  return query;
}

/** One deal by id, in any pipeline (used for `?open=<id>` and to keep detail views fresh). */
export function useDeal(id: string | null | undefined, options?: { initialData?: Deal | null }) {
  return useQuery({
    queryKey: ["deal", id],
    queryFn: async (): Promise<Deal | null> => {
      const { data, error } = await supabase.from("deals").select(DEAL_SELECT).eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? normalizeDeal(data) : null;
    },
    enabled: !!id,
    initialData: options?.initialData && options.initialData.id === id ? options.initialData : undefined,
    // Treat the passed-in row as stale so it's refreshed in the background.
    initialDataUpdatedAt: 0,
  });
}

export interface DealOption {
  id: string;
  title: string;
  pipeline_id: string;
  close_date: string | null;
}

/** Small searchable list of deals for pickers. */
export function useDealOptions(search: string, options?: { enabled?: boolean; limit?: number }) {
  return useQuery({
    queryKey: ["deal-options", search, options?.limit ?? 20],
    queryFn: async (): Promise<DealOption[]> => {
      let q = supabase.from("deals").select("id, title, pipeline_id, close_date").order("updated_at", { ascending: false }).limit(options?.limit ?? 20);
      const f = ilikeAny(["title"], search);
      if (f) q = q.or(f);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DealOption[];
    },
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export interface CalendarDeal {
  id: string;
  title: string;
  close_date: string;
  value: number;
  pipeline_id: string;
  stage_id: string;
}

/** Deals whose close date falls within [from, to] (yyyy-MM-dd, inclusive). */
export function useDealsClosingBetween(from: string, to: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["calendar", "deals", from, to],
    queryFn: async ({ signal }): Promise<CalendarDeal[]> => {
      const rows = await fetchAllRows(
        (start, end) =>
          supabase
            .from("deals")
            .select("id, title, close_date, value, pipeline_id, stage_id")
            .gte("close_date", from)
            .lte("close_date", to)
            .order("close_date", { ascending: true })
            .order("id", { ascending: true })
            .range(start, end)
            .abortSignal(signal),
        { signal },
      );
      return (rows as CalendarDeal[]).map((d) => ({ ...d, value: Number(d.value ?? 0) }));
    },
    enabled: options?.enabled ?? true,
  });
}

export interface CreateDealInput {
  title: string;
  pipeline_id: string;
  stage_id: string;
  /** Defaults to the creator on the server when omitted. */
  owner_id?: string | null;
  created_by?: string | null;
  company_id?: string | null;
  contact_id?: string | null;
  value?: number;
  probability?: number;
  close_date?: string | null;
  notes?: string | null;
}

export function useCreateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deal: CreateDealInput): Promise<Deal> => {
      const payload: TablesInsert<"deals"> = { ...deal };
      if (payload.owner_id === undefined) delete payload.owner_id;
      if (payload.created_by === undefined) delete payload.created_by;
      const { data, error } = await supabase.from("deals").insert(payload).select(DEAL_SELECT).single();
      if (error) throw error;
      return normalizeDeal(data);
    },
    onSuccess: () => invalidateDealQueries(queryClient),
  });
}

export type DealUpdate = { id: string } & Partial<Omit<Deal, "id" | "companies" | "contacts" | "profiles" | "created_at" | "updated_at">> & {
  [key: string]: unknown;
};

export function useUpdateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: DealUpdate): Promise<Deal> => {
      const { data, error } = await supabase.from("deals").update(updates).eq("id", id).select(DEAL_SELECT).single();
      if (error) throw error;
      return normalizeDeal(data);
    },
    onSuccess: (deal) => {
      queryClient.setQueryData(["deal", deal.id], deal);
      invalidateDealQueries(queryClient);
    },
  });
}

/** Values a move can put back instead of the stage-derived ones (Undo restores the deal's previous values). */
export type DealMoveRestore = Partial<Pick<Deal, "probability" | "lost_reason">>;

/**
 * Fields to write when a deal moves into `stage` (probability follows won/lost or a configured stage probability).
 * Reopening a won/lost deal (`from` is closed) into a stage without a configured probability uses the stage default
 * rather than keeping 100%/0%. `restore` wins over everything derived from the stage.
 */
export function stageMoveUpdates(
  stage: PipelineStage,
  lostReason?: string | null,
  options?: { from?: Pick<PipelineStage, "is_won" | "is_lost"> | null; restore?: DealMoveRestore },
): TablesUpdate<"deals"> {
  const updates: TablesUpdate<"deals"> = { stage_id: stage.id };
  if (stage.is_won) updates.probability = 100;
  else if (stage.is_lost) updates.probability = 0;
  else if (typeof stage.probability === "number") updates.probability = stage.probability;
  else if (options?.from?.is_won || options?.from?.is_lost) updates.probability = defaultProbabilityForStage(stage);
  if (stage.is_lost) updates.lost_reason = lostReason?.trim() ? lostReason.trim() : null;
  const restore = options?.restore;
  if (typeof restore?.probability === "number") updates.probability = restore.probability;
  if (restore && restore.lost_reason !== undefined) updates.lost_reason = restore.lost_reason;
  return updates;
}

export interface MoveDealInput {
  deal: Deal;
  stage: PipelineStage;
  lostReason?: string | null;
  /** The stage the deal is leaving (decides the probability when a won/lost deal is reopened). */
  fromStage?: PipelineStage | null;
  restore?: DealMoveRestore;
}

const moveUpdates = ({ stage, lostReason, fromStage, restore }: MoveDealInput) => stageMoveUpdates(stage, lostReason, { from: fromStage, restore });

/** Puts back the fields a failed move patched, unless the deal has changed stage again since. */
function revertMove(current: Deal, before: Deal, patch: Partial<Deal>): Deal {
  if (current.stage_id !== patch.stage_id) return current;
  const fields = Object.fromEntries(Object.keys(patch).map((k) => [k, before[k as keyof Deal]]));
  return { ...current, ...fields };
}

/**
 * Moves a deal to another stage with an optimistic cache update and rollback on error.
 * Moves run one at a time (shared scope) and a failure only reverts its own deal.
 * Callers should use `mutateAsync` and toast per call: callbacks passed to `mutate` are dropped
 * as soon as another move starts.
 */
export function useMoveDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: DEAL_MOVE_KEY,
    scope: { id: "deal-move" },
    mutationFn: async (input: MoveDealInput) => {
      const { data, error } = await supabase
        .from("deals")
        .update(moveUpdates(input))
        .eq("id", input.deal.id)
        .select(DEAL_SELECT)
        .single();
      if (error) throw error;
      return normalizeDeal(data);
    },
    onMutate: async (input) => {
      const { deal } = input;
      const listKey = ["deals", deal.pipeline_id];
      await queryClient.cancelQueries({ queryKey: listKey });
      const before = queryClient.getQueryData<Deal[]>(listKey)?.find((d) => d.id === deal.id) ?? deal;
      const previousDetail = queryClient.getQueryData<Deal | null>(["deal", deal.id]);
      const patch = moveUpdates(input) as Partial<Deal>;
      queryClient.setQueryData<Deal[]>(listKey, (old) => old?.map((d) => (d.id === deal.id ? { ...d, ...patch } : d)));
      if (previousDetail) queryClient.setQueryData(["deal", deal.id], { ...previousDetail, ...patch });
      return { listKey, before, previousDetail, patch };
    },
    onError: (_err, { deal }, ctx) => {
      if (!ctx) return;
      // Only this deal: other moves still in flight keep their optimistic state.
      queryClient.setQueryData<Deal[]>(ctx.listKey, (old) => old?.map((d) => (d.id === deal.id ? revertMove(d, ctx.before, ctx.patch) : d)));
      const previousDetail = ctx.previousDetail;
      if (previousDetail) {
        queryClient.setQueryData<Deal | null>(["deal", deal.id], (cur) => (cur ? revertMove(cur, previousDetail, ctx.patch) : cur));
      }
    },
    onSettled: () => {
      // Refetch once the last queued move settles; refetching earlier would undo the others' optimistic updates.
      if (queryClient.isMutating({ mutationKey: DEAL_MOVE_KEY }) <= 1) invalidateDealQueries(queryClient);
    },
  });
}

export function useDeleteDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error, count } = await supabase.from("deals").delete({ count: "exact" }).eq("id", id);
      if (error) throw error;
      assertAffected(count);
    },
    onSuccess: (_d, id) => {
      queryClient.removeQueries({ queryKey: ["deal", id] });
      invalidateDealQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["activities-feed"] });
      queryClient.invalidateQueries({ queryKey: ["global-search"] });
    },
  });
}
