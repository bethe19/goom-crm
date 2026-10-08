import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAllRows } from "@/lib/fetchAll";
import { assertAffected, backupFilename } from "@/components/settings/validation";

export interface WorkspaceCounts {
  deals: number;
  contacts: number;
  companies: number;
  openTasks: number;
}

/** Exact row counts for the current workspace (RLS scopes every table to it). */
export function useWorkspaceCounts() {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ["workspace-counts", organization?.id],
    enabled: !!organization,
    queryFn: async (): Promise<WorkspaceCounts> => {
      const head = { count: "exact" as const, head: true };
      const [deals, contacts, companies, openTasks] = await Promise.all([
        supabase.from("deals").select("id", head),
        supabase.from("contacts").select("id", head),
        supabase.from("companies").select("id", head),
        supabase.from("tasks").select("id", head).eq("completed", false),
      ]);
      const failed = [deals, contacts, companies, openTasks].find((r) => r.error);
      if (failed?.error) throw failed.error;
      return {
        deals: deals.count ?? 0,
        contacts: contacts.count ?? 0,
        companies: companies.count ?? 0,
        openTasks: openTasks.count ?? 0,
      };
    },
  });
}

export interface FeedbackItem {
  id: string;
  user_id: string | null;
  rating: number;
  category: string;
  comment: string;
  email: string | null;
  status: string;
  created_at: string;
}

export const FEEDBACK_STATUSES = ["new", "reviewed", "resolved"] as const;

/**
 * Feedback submitted in this workspace, newest first. RLS also lets everyone read their own feedback
 * from other workspaces, so the list is filtered to the current one explicitly.
 */
export function useWorkspaceFeedback(limit = 25) {
  const { organization } = useAuth();
  return useQuery({
    queryKey: ["workspace-feedback", organization?.id, limit],
    enabled: !!organization,
    queryFn: async (): Promise<FeedbackItem[]> => {
      const { data, error } = await supabase
        .from("feedback")
        .select("id, user_id, rating, category, comment, email, status, created_at")
        .eq("organization_id", organization!.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as FeedbackItem[];
    },
  });
}

export function useUpdateFeedbackStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      // RLS silently skips rows the caller may not update: require the row back to report success.
      const { data, error } = await supabase.from("feedback").update({ status }).eq("id", id).select("id");
      if (error) throw error;
      assertAffected(data?.length ?? 0);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workspace-feedback"] }),
  });
}

/** Tables included in a workspace backup, in restore-friendly order. */
const BACKUP_TABLES = [
  "pipelines",
  "pipeline_stages",
  "companies",
  "contacts",
  "deals",
  "deal_audit_log",
  "activities",
  "tasks",
  "email_templates",
] as const;

type BackupTable = (typeof BACKUP_TABLES)[number];

/**
 * Downloads every workspace table as one JSON file. Pages through each table so nothing is
 * truncated at the 1000-row API cap.
 */
export async function exportWorkspaceBackup(
  organization: { id: string; name: string; currency: string; monthly_quota: number },
  onProgress?: (table: string) => void,
): Promise<{ filename: string; rows: number }> {
  const tables = {} as Record<BackupTable, unknown[]>;
  let rows = 0;
  for (const table of BACKUP_TABLES) {
    onProgress?.(table);
    const data = await fetchAllRows<unknown>((from, to) =>
      supabase.from(table).select("*").order("id", { ascending: true }).range(from, to),
    );
    tables[table] = data;
    rows += data.length;
  }
  const { data: members, error: membersError } = await supabase.rpc("list_members");
  if (membersError) throw membersError;

  const payload = {
    format: "goom-workspace-backup",
    version: 1,
    exported_at: new Date().toISOString(),
    workspace: organization,
    members: members ?? [],
    tables,
  };
  const filename = backupFilename(organization.name);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { filename, rows };
}
