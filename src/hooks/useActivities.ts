import { useQuery, useMutation, useQueryClient, useInfiniteQuery, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { assertAffected } from "@/components/settings/validation";
import { useEffect, useId } from "react";
import { ilikeAny, PAGE_SIZE } from "@/lib/postgrest";
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

/** Realtime invalidation with a channel name unique to this mount (fixed names collide across components). */
function useRealtimeActivities(enabled: boolean) {
  const queryClient = useQueryClient();
  const uid = useId();
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel(`activities:${uid}:${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "activities" }, () => {
        queryClient.invalidateQueries({ queryKey: ["activities"] });
        queryClient.invalidateQueries({ queryKey: ["activities-feed"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient, uid]);
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
    queryFn: async (): Promise<Activity[]> => {
      const { data, error } = await supabase
        .from("activities")
        .select("id, type, title, created_at, deal_id, contact_id")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Activity[];
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
