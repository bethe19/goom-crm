import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string | null;
  type: string;
  read: boolean;
  reference_id: string | null;
  reference_type: string | null;
  created_at: string;
}

const NOTIFICATION_LIMIT = 50;

export const notificationsKey = (userId: string | undefined) => ["notifications", userId] as const;
/** Nested under `notificationsKey`, so invalidating the list refreshes the count too. */
export const unreadNotificationsCountKey = (userId: string | undefined) => ["notifications", userId, "unread-count"] as const;

/** Where a notification's record lives in the app (`?open=<id>` opens its detail sheet). */
const ROUTES_BY_REFERENCE: Record<string, string> = {
  deal: "/pipeline",
  contact: "/contacts",
  company: "/companies",
  task: "/tasks",
  activity: "/activities",
};

export function notificationHref(n: Pick<Notification, "reference_type" | "reference_id">): string | null {
  if (!n.reference_type || !n.reference_id) return null;
  const route = ROUTES_BY_REFERENCE[n.reference_type.toLowerCase()];
  return route ? `${route}?open=${encodeURIComponent(n.reference_id)}` : null;
}

/**
 * The signed-in user's latest notifications, kept live via a realtime subscription.
 * Notifications are created server-side (triggers); the client only reads, marks read and deletes.
 */
export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const query = useQuery({
    queryKey: notificationsKey(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(NOTIFICATION_LIMIT);
      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!userId) return;
    // Channel names must be unique per subscription; a fixed name collides across users/tabs/remounts.
    const channel = supabase
      .channel(`notifications:${userId}:${Math.random().toString(36).slice(2, 10)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: notificationsKey(userId) });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return query;
}

/**
 * Total unread notifications for the signed-in user (a head count, so it isn't capped by the
 * latest-50 list). Kept live by `useNotifications`' realtime subscription, which invalidates it.
 */
export function useUnreadNotificationCount() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: unreadNotificationsCountKey(userId),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!)
        .eq("read", false);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

type NotificationKeys = {
  key: ReturnType<typeof notificationsKey>;
  countKey: ReturnType<typeof unreadNotificationsCountKey>;
};

type OptimisticContext = { previous?: Notification[]; previousCount?: number };

function useOptimisticNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const keys: NotificationKeys = { key: notificationsKey(user?.id), countKey: unreadNotificationsCountKey(user?.id) };
  return { user, queryClient, keys };
}

const unreadIn = (list: Notification[] | undefined) => list?.filter((n) => !n.read).length ?? 0;

/**
 * Applies `update` to the cached list and lowers the unread count by the unread rows it changed,
 * or sets the count to `nextCount` ("mark all read" / "clear" also cover rows past the list).
 */
async function applyOptimistic(
  queryClient: QueryClient,
  keys: NotificationKeys,
  update: (list: Notification[]) => Notification[],
  nextCount?: number,
): Promise<OptimisticContext> {
  // Prefix match: also cancels an in-flight unread count.
  await queryClient.cancelQueries({ queryKey: keys.key });
  const previous = queryClient.getQueryData<Notification[]>(keys.key);
  const previousCount = queryClient.getQueryData<number>(keys.countKey);
  const next = previous ? update(previous) : undefined;
  if (next) queryClient.setQueryData<Notification[]>(keys.key, next);
  if (typeof previousCount === "number") {
    const count = nextCount ?? Math.max(0, previousCount - (unreadIn(previous) - unreadIn(next)));
    queryClient.setQueryData<number>(keys.countKey, count);
  }
  return { previous, previousCount };
}

function rollback(queryClient: QueryClient, keys: NotificationKeys, ctx: OptimisticContext | undefined) {
  if (ctx?.previous) queryClient.setQueryData(keys.key, ctx.previous);
  if (typeof ctx?.previousCount === "number") queryClient.setQueryData(keys.countKey, ctx.previousCount);
}

export function useMarkNotificationRead() {
  const { queryClient, keys } = useOptimisticNotifications();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
      if (error) throw error;
    },
    onMutate: (id) => applyOptimistic(queryClient, keys, (list) => list.map((n) => (n.id === id ? { ...n, read: true } : n))),
    onError: (_e, _id, ctx) => rollback(queryClient, keys, ctx),
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.key }),
  });
}

export function useMarkAllNotificationsRead() {
  const { user, queryClient, keys } = useOptimisticNotifications();
  return useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
      if (error) throw error;
    },
    onMutate: () => applyOptimistic(queryClient, keys, (list) => list.map((n) => ({ ...n, read: true })), 0),
    onError: (_e, _v, ctx) => rollback(queryClient, keys, ctx),
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.key }),
  });
}

export function useDeleteNotification() {
  const { queryClient, keys } = useOptimisticNotifications();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: (id) => applyOptimistic(queryClient, keys, (list) => list.filter((n) => n.id !== id)),
    onError: (_e, _id, ctx) => rollback(queryClient, keys, ctx),
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.key }),
  });
}

/** Deletes all of the user's notifications. */
export function useClearNotifications() {
  const { user, queryClient, keys } = useOptimisticNotifications();
  return useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from("notifications").delete().eq("user_id", user.id);
      if (error) throw error;
    },
    onMutate: () => applyOptimistic(queryClient, keys, () => [], 0),
    onError: (_e, _v, ctx) => rollback(queryClient, keys, ctx),
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.key }),
  });
}
