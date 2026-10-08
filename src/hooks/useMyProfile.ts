import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Json, TablesUpdate } from "@/integrations/supabase/types";

/**
 * In-app notification switches read by the database triggers (missing key = on):
 * `deal_stage_changes` → "Deal won" / "Deal lost" for the deal's owner;
 * `task_reminders` → "Task assigned to you" when a teammate assigns a task.
 * (Key names are kept for compatibility with stored preferences.)
 */
export interface NotificationPreferences {
  deal_stage_changes: boolean;
  task_reminders: boolean;
}

export const NOTIFICATION_DEFAULTS: NotificationPreferences = {
  deal_stage_changes: true,
  task_reminders: true,
};

export interface MyProfile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  timezone: string | null;
  company: string | null;
  onboarding_completed_at: string | null;
  notification_preferences: NotificationPreferences;
}

export type ProfilePatch = Partial<
  Pick<MyProfile, "full_name" | "avatar_url" | "job_title" | "timezone" | "notification_preferences">
>;

export const myProfileKey = (userId: string | undefined) => ["my-profile", userId] as const;

export const AVATAR_BUCKET = "avatars";
const AVATAR_EXTENSIONS = ["jpg", "png", "gif", "webp"] as const;

/** The one storage object a user's photo lives at: `<uid>/avatar.<jpg|png|gif|webp>` (what storage RLS allows). */
export function avatarPath(userId: string, mimeType: string): string {
  const sub = mimeType.split("/")[1] ?? "";
  const ext = sub === "jpeg" ? "jpg" : sub;
  return `${userId}/avatar.${ext}`;
}

/**
 * Deletes the user's avatar objects — everything listed in their `<uid>/` folder plus the canonical
 * `avatar.<ext>` names (in case listing isn't allowed) — except `keep`. Removing a path that doesn't
 * exist is a no-op. Throws if storage rejects the delete.
 */
export async function removeAvatarFiles(userId: string, keep?: string): Promise<void> {
  const bucket = supabase.storage.from(AVATAR_BUCKET);
  const paths = new Set<string>(AVATAR_EXTENSIONS.map((ext) => `${userId}/avatar.${ext}`));
  const { data: listed, error: listError } = await bucket.list(userId, { limit: 100 });
  if (!listError) {
    // Folders come back with a null id; only files can be removed.
    for (const object of listed ?? []) if (object.id) paths.add(`${userId}/${object.name}`);
  }
  if (keep) paths.delete(keep);
  if (paths.size === 0) return;
  const { error } = await bucket.remove([...paths]);
  if (error) throw error;
}

function normalize(row: Record<string, unknown>): MyProfile {
  const prefs = (row.notification_preferences ?? {}) as Partial<NotificationPreferences>;
  return {
    user_id: String(row.user_id),
    full_name: (row.full_name as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    job_title: (row.job_title as string | null) ?? null,
    timezone: (row.timezone as string | null) ?? null,
    company: (row.company as string | null) ?? null,
    onboarding_completed_at: (row.onboarding_completed_at as string | null) ?? null,
    notification_preferences: { ...NOTIFICATION_DEFAULTS, ...prefs },
  };
}

/** The signed-in user's own profile row. */
export function useMyProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: myProfileKey(user?.id),
    enabled: !!user,
    queryFn: async (): Promise<MyProfile | null> => {
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data ? normalize(data as unknown as Record<string, unknown>) : null;
    },
  });
}

/** Updates the signed-in user's profile. Optimistic: the cache is patched immediately and rolled back on error. */
export function useUpdateMyProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = myProfileKey(user?.id);

  return useMutation({
    mutationFn: async (patch: ProfilePatch) => {
      if (!user) throw new Error("Not signed in");
      const { notification_preferences, ...rest } = patch;
      const row: TablesUpdate<"profiles"> = { ...rest };
      if (notification_preferences) row.notification_preferences = { ...notification_preferences } as Json;
      const { error } = await supabase.from("profiles").update(row).eq("user_id", user.id);
      if (error) throw error;
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MyProfile | null>(key);
      if (previous) queryClient.setQueryData<MyProfile>(key, { ...previous, ...patch });
      return { previous };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.previous !== undefined) queryClient.setQueryData(key, ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ["profile-sidebar"] });
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
    },
  });
}
