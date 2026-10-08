import { useQuery, useMutation, useQueryClient, useInfiniteQuery, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { assertAffected } from "@/components/settings/validation";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useId } from "react";
import { ilikeAny, PAGE_SIZE } from "@/lib/postgrest";
import { chunk, fetchAllRows } from "@/lib/fetchAll";
import type { TablesInsert } from "@/integrations/supabase/types";

export type ActivityType = "call" | "email" | "meeting" | "note";
export const ACTIVITY_TYPES: ActivityType[] = ["call", "email", "meeting", "note"];

export interface Activity {
  id: string;
  deal_id: string | null;
  contact_id: string | null;
  user_id: string | null;
  type: ActivityType;
  title: string;
  description: string | null;
  created_at: string;
  deals?: { id: string; title: string } | null;
  contacts?: { id: string; first_name: string; last_name: string } | null;
  profiles?: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

export const ACTIVITY_SELECT = "*, deals(id, title), contacts(id, first_name, last_name)";

export function invalidateActivityQueries(queryClient: QueryClient) {
  for (const key of ["activities", "activity", "activities-feed", "calendar", "dashboard", "analytics"]) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
}

const REALTIME_DEBOUNCE_MS = 500;

/**
 * Realtime invalidation for this workspace's activities, debounced so bursts (bulk deletes, imports)
 * refetch once. The channel name is unique to this mount (fixed names collide across components).
 */
function useRealtimeActivities(enabled: boolean) {
  const queryClient = useQueryClient();
  const { organization } = useAuth();
  const orgId = organization?.id;
  const uid = useId();
  useEffect(() => {
    if (!enabled || !orgId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["activities"] });
        queryClient.invalidateQueries({ queryKey: ["activities-feed"] });
      }, REALTIME_DEBOUNCE_MS);
    };
    const channel = supabase
      .channel(`activities:${orgId}:${uid}:${Math.random().toString(36).slice(2, 8)}`)
      // The table has REPLICA IDENTITY FULL, so deletes carry organization_id and match this filter too.
      .on("postgres_changes", { event: "*", schema: "public", table: "activities", filter: `organization_id=eq.${orgId}` }, refresh)
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [enabled, orgId, queryClient, uid]);
}

export interface ActivityFilters {
  type?: ActivityType | "";
  limit?: number;
  since?: string;
  deal_id?: string;
  contact_id?: string;
  enabled?: boolean;
  realtime?: boolean;
}

/** A simple (non-paginated) activity list. Pass `limit` for anything that can grow. */
export function useActivities(filters?: ActivityFilters) {
  const { enabled = true, realtime = true, ...keyFilters } = filters ?? {};
  const query = useQuery({
    queryKey: ["activities", keyFilters],
    queryFn: async (): Promise<Activity[]> => {
      let q = supabase.from("activities").select(ACTIVITY_SELECT).order("created_at", { ascending: false });
      if (keyFilters.type) q = q.eq("type", keyFilters.type);
      if (keyFilters.since) q = q.gte("created_at", keyFilters.since);
      if (keyFilters.deal_id) q = q.eq("deal_id", keyFilters.deal_id);
      if (keyFilters.contact_id) q = q.eq("contact_id", keyFilters.contact_id);
      q = q.limit(keyFilters.limit ?? 500);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Activity[];
    },
    enabled,
  });
  useRealtimeActivities(enabled && realtime);
  return query;
}

export interface ActivityFeedFilters {
  type?: ActivityType | "";
  dealId?: string | null;
  contactId?: string | null;
  search?: string;
}

export interface ActivityPage {
  rows: Activity[];
  count: number;
  from: number;
}

/** Paginated activity feed (PAGE_SIZE per page, newest first). Use `fetchNextPage` for "Load more". */
export function useActivitiesFeed(filters: ActivityFeedFilters, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const query = useInfiniteQuery({
    queryKey: ["activities-feed", filters],
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<ActivityPage> => {
      const from = pageParam as number;
      let q = supabase
        .from("activities")
        .select(ACTIVITY_SELECT, { count: "exact" })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (filters.type) q = q.eq("type", filters.type);
      if (filters.dealId) q = q.eq("deal_id", filters.dealId);
      if (filters.contactId) q = q.eq("contact_id", filters.contactId);
      const f = ilikeAny(["title", "description"], filters.search ?? "");
      if (f) q = q.or(f);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as Activity[], count: count ?? 0, from };
    },
    getNextPageParam: (last) => {
      const next = last.from + PAGE_SIZE;
      return next < last.count ? next : undefined;
    },
    enabled,
  });
  useRealtimeActivities(enabled);
  return query;
}

export function useActivity(id: string | null | undefined) {
  return useQuery({
    queryKey: ["activity", id],
    queryFn: async (): Promise<Activity | null> => {
      const { data, error } = await supabase.from("activities").select(ACTIVITY_SELECT).eq("id", id).maybeSingle();
      if (error) throw error;
      return (data as Activity) ?? null;
    },
    enabled: !!id,
  });
}

/** Activities created within [fromIso, toIso] (for the calendar). */
export function useActivitiesBetween(fromIso: string, toIso: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["calendar", "activities", fromIso, toIso],
    queryFn: async ({ signal }): Promise<Activity[]> => {
      // Paged so a busy range isn't silently cut off at Supabase's 1,000-row response cap. The count
      // (first page only) lets paging stop without a final empty request.
      const rows = await fetchAllRows(
        (from, to) =>
          supabase
            .from("activities")
            .select("id, type, title, created_at, deal_id, contact_id", from === 0 ? { count: "exact" } : undefined)
            .gte("created_at", fromIso)
            .lte("created_at", toIso)
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to)
            .abortSignal(signal),
        { signal },
      );
      return rows as Activity[];
    },
    enabled: options?.enabled ?? true,
  });
}

export interface CreateActivityInput {
  deal_id?: string | null;
  contact_id?: string | null;
  /** Defaults to the signed-in user on the server when omitted. */
  user_id?: string | null;
  type: ActivityType;
  title: string;
  description?: string | null;
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (activity: CreateActivityInput): Promise<Activity> => {
      const payload: TablesInsert<"activities"> = { ...activity };
      if (!payload.user_id) delete payload.user_id;
      const { data, error } = await supabase.from("activities").insert(payload).select(ACTIVITY_SELECT).single();
      if (error) throw error;
      return data as Activity;
    },
    onSuccess: () => invalidateActivityQueries(queryClient),
  });
}

export function useUpdateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      title?: string;
      description?: string | null;
      type?: ActivityType;
      deal_id?: string | null;
      contact_id?: string | null;
    }): Promise<Activity> => {
      const { data, error } = await supabase.from("activities").update(updates).eq("id", id).select(ACTIVITY_SELECT).single();
      if (error) throw error;
      return data as Activity;
    },
    onSuccess: (activity) => {
      queryClient.setQueryData(["activity", activity.id], activity);
      invalidateActivityQueries(queryClient);
    },
  });
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error, count } = await supabase.from("activities").delete({ count: "exact" }).eq("id", id);
      if (error) throw error;
      assertAffected(count);
    },
    onSuccess: (_d, id) => {
      queryClient.removeQueries({ queryKey: ["activity", id] });
      invalidateActivityQueries(queryClient);
    },
  });
}

export interface BulkDeleteResult {
  /** Ids the server actually deleted (rows the caller may not delete are skipped by RLS). */
  deleted: string[];
  /** The first error from a failed chunk, when some (but not all) chunks failed. */
  error: unknown;
}

/**
 * Deletes many activities with one `.in()` request per 100 ids and refreshes the lists once.
 * Keeps going after a failed chunk; rejects only when nothing could be deleted.
 */
export function useBulkDeleteActivities() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]): Promise<BulkDeleteResult> => {
      const deleted: string[] = [];
      let firstError: unknown = null;
      for (const part of chunk(ids, 100)) {
        const { data, error } = await supabase.from("activities").delete({ count: "exact" }).in("id", part).select("id");
        if (error) {
          firstError ??= error;
          continue;
        }
        deleted.push(...(data ?? []).map((r) => r.id));
      }
      if (firstError && deleted.length === 0) throw firstError;
      return { deleted, error: firstError };
    },
    onSettled: (result) => {
      result?.deleted.forEach((id) => queryClient.removeQueries({ queryKey: ["activity", id] }));
      invalidateActivityQueries(queryClient);
    },
  });
}
