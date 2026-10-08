import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/contexts/AuthContext";
import { inviteLink } from "@/components/settings/validation";

export interface Member {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  job_title: string | null;
  role: AppRole;
  joined_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: AppRole;
  token: string;
  created_at: string;
  expires_at: string | null;
  accepted_at: string | null;
}

export interface CreatedInvitation {
  id: string;
  token: string;
  email: string;
  role: AppRole;
  link: string;
  /** True only when the send-invite edge function confirmed an email was delivered. */
  emailSent: boolean;
  /**
   * Why no email was sent (throttled, provider rejected it, invitation expired, …). Undefined when
   * the email was sent or when email delivery simply isn't configured for this deployment.
   */
  emailError?: string;
}

export interface InviteEmailResult {
  sent: boolean;
  /** User-facing reason when `sent` is false; omitted when email delivery isn't configured. */
  reason?: string;
}

export const teamMembersKey = ["team-members"] as const;
export const invitationsKey = ["invitations"] as const;

/** Members of the current workspace (any member may call). */
export function useMembers() {
  const { user, organization } = useAuth();
  return useQuery({
    queryKey: [...teamMembersKey, organization?.id],
    enabled: !!user && !!organization,
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase.rpc("list_members");
      if (error) throw error;
      return ((data ?? []) as unknown as Member[]).slice().sort((a, b) => a.joined_at.localeCompare(b.joined_at));
    },
  });
}

/** Pending (not yet accepted) invitations — visible to admins and managers via RLS. */
export function useInvitations(enabled = true) {
  const { user, organization } = useAuth();
  return useQuery({
    queryKey: [...invitationsKey, organization?.id],
    enabled: enabled && !!user && !!organization,
    queryFn: async (): Promise<Invitation[]> => {
      const { data, error } = await supabase
        .from("invitations")
        .select("id, email, role, token, created_at, expires_at, accepted_at")
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Invitation[];
    },
  });
}

const INVITE_EMAIL_FAILED = "The invitation email couldn't be sent.";
const NOT_CONFIGURED_RE = /not configured/i;

/** A short server-written message, or undefined (never shows long or non-string bodies). */
function shortMessage(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() && value.length <= 300 ? value.trim() : undefined;
}

/** Reads `{ error }` from a send-invite error response (403/409/410/429 …). */
async function inviteEmailErrorReason(error: unknown): Promise<string | undefined> {
  if (error instanceof FunctionsFetchError) return "The email service couldn't be reached.";
  if (error instanceof FunctionsHttpError || error instanceof FunctionsRelayError) {
    const res = error.context as Response | undefined;
    let body: { error?: unknown } | null = null;
    try {
      if (res && typeof res.clone === "function") body = (await res.clone().json()) as { error?: unknown } | null;
    } catch {
      body = null;
    }
    const message = shortMessage(body?.error);
    if (message) return message;
    // The function isn't deployed: same as email delivery not being set up.
    if (res?.status === 404) return undefined;
  }
  return INVITE_EMAIL_FAILED;
}

/**
 * Tries to email an invitation. Never throws. `reason` explains a failure (throttled, expired,
 * provider error, …) and is omitted when email delivery simply isn't configured.
 */
export async function sendInviteEmail(invitationId: string): Promise<InviteEmailResult> {
  try {
    const { data, error } = await supabase.functions.invoke("send-invite", { body: { invitation_id: invitationId } });
    if (error) return { sent: false, reason: await inviteEmailErrorReason(error) };
    const body = data as { sent?: boolean; reason?: unknown } | null;
    if (body?.sent === true) return { sent: true };
    const reason = shortMessage(body?.reason);
    return { sent: false, reason: reason && NOT_CONFIGURED_RE.test(reason) ? undefined : reason };
  } catch {
    return { sent: false, reason: INVITE_EMAIL_FAILED };
  }
}

export async function createInvitation(email: string, role: AppRole): Promise<CreatedInvitation> {
  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabase.rpc("create_invitation", { p_email: normalized, p_role: role });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { id: string; token: string } | null;
  if (!row?.token) throw new Error("The invitation could not be created.");
  const delivery = await sendInviteEmail(row.id);
  return {
    id: row.id,
    token: row.token,
    email: normalized,
    role,
    link: inviteLink(row.token),
    emailSent: delivery.sent,
    emailError: delivery.sent ? undefined : delivery.reason,
  };
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: AppRole }) => createInvitation(email, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationsKey });
      queryClient.invalidateQueries({ queryKey: ["workspace-usage"] });
    },
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invitations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationsKey });
      queryClient.invalidateQueries({ queryKey: ["workspace-usage"] });
    },
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();
  const { user, refreshUserRole } = useAuth();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.rpc("update_member_role", { p_user_id: userId, p_role: role });
      if (error) throw error;
      return { userId };
    },
    onSuccess: async ({ userId }) => {
      await queryClient.invalidateQueries({ queryKey: teamMembersKey });
      if (userId === user?.id) await refreshUserRole();
    },
  });
}

/**
 * Leaves the current workspace (RPC `leave_workspace`). The server refuses (P0001) for the only
 * member or the last admin. Afterwards the user's context is reloaded (get_my_context moves them to
 * another workspace or creates a new one) and every cached query is reset, since it all belonged
 * to the workspace they left.
 */
export function useLeaveWorkspace() {
  const queryClient = useQueryClient();
  const { refreshUserRole } = useAuth();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("leave_workspace");
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshUserRole();
      void queryClient.resetQueries();
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc("remove_member", { p_user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      // remove_member reassigns the member's deals and open tasks to the caller, which changes
      // owners across deals, tasks, dashboards and reports.
      queryClient.invalidateQueries();
    },
  });
}
