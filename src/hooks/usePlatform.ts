/**
 * Platform owner console data (SaaS super-admin). Every call goes through the `platform_*`
 * SECURITY DEFINER RPCs, which raise "Not allowed." unless the caller is a platform admin and
 * return metadata and counts only — never workspace record contents.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PAGE_SIZE } from "@/lib/postgrest";
import type { PlanId } from "@/lib/plans";
import {
  fillDailySeries,
  normalizeOverview,
  toNumber,
  totalFromRows,
  type PlatformContactRequestRow,
  type PlatformFeedbackRow,
  type PlatformOverview,
  type PlatformPage,
  type PlatformTimeseriesPoint,
  type PlatformUserRow,
  type PlatformWorkspaceRow,
  type WorkspaceStatus,
} from "@/components/platform/platformUtils";

export type {
  PlatformContactRequestRow,
  PlatformFeedbackRow,
  PlatformOverview,
  PlatformPage,
  PlatformTimeseriesPoint,
  PlatformUserRow,
  PlatformWorkspaceRow,
  WorkspaceStatus,
} from "@/components/platform/platformUtils";

// The platform RPCs may not be in the generated Database types yet; call them through a small
// untyped wrapper so this compiles either way. Row shapes are enforced by the interfaces above.
type RpcError = { message: string; code?: string; details?: string; hint?: string };
type UntypedRpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: RpcError | null }>;

async function callRpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const rpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc;
  const { data, error } = await rpc(fn, args);
  if (error) throw error;
  return data as T;
}

type RawRow = Record<string, unknown>;

async function fetchPage<T>(fn: string, args: Record<string, unknown>, page: number, map: (r: RawRow) => T): Promise<PlatformPage<T>> {
  const data = await callRpc<RawRow[] | null>(fn, { ...args, p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE });
  const raw = Array.isArray(data) ? data : [];
  return { rows: raw.map(map), total: totalFromRows(raw) };
}

const str = (v: unknown): string => (v == null ? "" : String(v));
const strOrNull = (v: unknown): string | null => (v == null || v === "" ? null : String(v));

export const platformKeys = {
  all: ["platform"] as const,
  overview: () => ["platform", "overview"] as const,
  timeseries: (days: number) => ["platform", "timeseries", days] as const,
  workspaces: (search: string, page: number) => ["platform", "workspaces", { search, page }] as const,
  users: (search: string, page: number) => ["platform", "users", { search, page }] as const,
  feedback: (page: number) => ["platform", "feedback", { page }] as const,
  contactRequests: (page: number) => ["platform", "contact-requests", { page }] as const,
};

export function usePlatformOverview() {
  return useQuery({
    queryKey: platformKeys.overview(),
    queryFn: async (): Promise<PlatformOverview> => normalizeOverview(await callRpc<unknown>("platform_overview")),
  });
}

export function usePlatformTimeseries(days: number) {
  return useQuery({
    queryKey: platformKeys.timeseries(days),
    queryFn: async (): Promise<PlatformTimeseriesPoint[]> =>
      fillDailySeries(await callRpc<RawRow[] | null>("platform_timeseries", { p_days: days })),
    placeholderData: keepPreviousData,
  });
}

export function usePlatformWorkspaces({ search, page }: { search: string; page: number }) {
  const term = search.trim();
  return useQuery({
    queryKey: platformKeys.workspaces(term, page),
    queryFn: () =>
      fetchPage<PlatformWorkspaceRow>("platform_workspaces", { p_search: term || null }, page, (r) => ({
        id: str(r.id),
        name: str(r.name),
        plan: str(r.plan),
        status: str(r.status),
        created_at: str(r.created_at),
        owner_email: strOrNull(r.owner_email),
        member_count: toNumber(r.member_count),
        deal_count: toNumber(r.deal_count),
        contact_count: toNumber(r.contact_count),
        ai_requests_30d: toNumber(r.ai_requests_30d),
        last_activity_at: strOrNull(r.last_activity_at),
        total_count: toNumber(r.total_count),
      })),
    placeholderData: keepPreviousData,
  });
}

export function usePlatformUsers({ search, page }: { search: string; page: number }) {
  const term = search.trim();
  return useQuery({
    queryKey: platformKeys.users(term, page),
    queryFn: () =>
      fetchPage<PlatformUserRow>("platform_users", { p_search: term || null }, page, (r) => ({
        user_id: str(r.user_id),
        email: strOrNull(r.email),
        full_name: strOrNull(r.full_name),
        created_at: str(r.created_at),
        last_sign_in_at: strOrNull(r.last_sign_in_at),
        email_confirmed: r.email_confirmed === true,
        workspaces: strOrNull(r.workspaces),
        is_platform_admin: r.is_platform_admin === true,
        total_count: toNumber(r.total_count),
      })),
    placeholderData: keepPreviousData,
  });
}

export function usePlatformFeedback(page: number) {
  return useQuery({
    queryKey: platformKeys.feedback(page),
    queryFn: () =>
      fetchPage<PlatformFeedbackRow>("platform_feedback", {}, page, (r) => ({
        id: str(r.id),
        created_at: str(r.created_at),
        rating: r.rating == null ? null : toNumber(r.rating),
        category: strOrNull(r.category),
        comment: strOrNull(r.comment),
        status: strOrNull(r.status),
        user_email: strOrNull(r.user_email),
        workspace_name: strOrNull(r.workspace_name),
        total_count: toNumber(r.total_count),
      })),
    placeholderData: keepPreviousData,
  });
}

export function usePlatformContactRequests(page: number) {
  return useQuery({
    queryKey: platformKeys.contactRequests(page),
    queryFn: () =>
      fetchPage<PlatformContactRequestRow>("platform_contact_requests", {}, page, (r) => ({
        id: str(r.id),
        created_at: str(r.created_at),
        name: strOrNull(r.name),
        email: strOrNull(r.email),
        company: strOrNull(r.company),
        message: strOrNull(r.message),
        total_count: toNumber(r.total_count),
      })),
    placeholderData: keepPreviousData,
  });
}

export function useSetPlatformWorkspacePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, plan }: { orgId: string; plan: PlanId }) => {
      await callRpc<unknown>("platform_set_workspace_plan", { p_org_id: orgId, p_plan: plan });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: platformKeys.all }),
  });
}

export function useSetPlatformWorkspaceStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, status }: { orgId: string; status: WorkspaceStatus }) => {
      await callRpc<unknown>("platform_set_workspace_status", { p_org_id: orgId, p_status: status });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: platformKeys.all }),
  });
}
