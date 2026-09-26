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

function useOptimisticNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = notificationsKey(user?.id);
  return { user, queryClient, key };
}

async function applyOptimistic(
  queryClient: QueryClient,
  key: ReturnType<typeof notificationsKey>,
  update: (list: Notification[]) => Notification[],
) {
  await queryClient.cancelQueries({ queryKey: key });
  const previous = queryClient.getQueryData<Notification[]>(key);
  if (previous) queryClient.setQueryData<Notification[]>(key, update(previous));
  return { previous };
}

export function useMarkNotificationRead() {
  const { queryClient, key } = useOptimisticNotifications();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
      if (error) throw error;
    },
    onMutate: (id) => applyOptimistic(queryClient, key, (list) => list.map((n) => (n.id === id ? { ...n, read: true } : n))),
    onError: (_e, _id, ctx) => ctx?.previous && queryClient.setQueryData(key, ctx.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function useMarkAllNotificationsRead() {
  const { user, queryClient, key } = useOptimisticNotifications();
  return useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
      if (error) throw error;
    },
    onMutate: () => applyOptimistic(queryClient, key, (list) => list.map((n) => ({ ...n, read: true }))),
    onError: (_e, _v, ctx) => ctx?.previous && queryClient.setQueryData(key, ctx.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function useDeleteNotification() {
  const { queryClient, key } = useOptimisticNotifications();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: (id) => applyOptimistic(queryClient, key, (list) => list.filter((n) => n.id !== id)),
    onError: (_e, _id, ctx) => ctx?.previous && queryClient.setQueryData(key, ctx.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

/** Deletes all of the user's notifications. */
export function useClearNotifications() {
  const { user, queryClient, key } = useOptimisticNotifications();
  return useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from("notifications").delete().eq("user_id", user.id);
      if (error) throw error;
    },
    onMutate: () => applyOptimistic(queryClient, key, () => []),
    onError: (_e, _v, ctx) => ctx?.previous && queryClient.setQueryData(key, ctx.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
