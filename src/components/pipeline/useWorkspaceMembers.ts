import { useMemo } from "react";
import { useMembers } from "@/hooks/useTeam";

export interface WorkspaceMember {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  job_title: string | null;
  role: string;
  joined_at: string | null;
}

/** Display name for a member: full name, else email, else "Unknown". */
export function memberName(m: Pick<WorkspaceMember, "full_name" | "email"> | null | undefined): string {
  return m?.full_name?.trim() || m?.email || "Unknown";
}

/**
 * Members of the current workspace (`list_members()` via the shared `useMembers` query),
 * sorted by name, plus an id → member map for owner/assignee avatars and pickers.
 */
export function useWorkspaceMembers() {
  const query = useMembers();
  const members = useMemo(
    () => ((query.data ?? []) as WorkspaceMember[]).slice().sort((a, b) => memberName(a).localeCompare(memberName(b))),
    [query.data],
  );
  const byId = useMemo(() => {
    const map = new Map<string, WorkspaceMember>();
    for (const m of members) map.set(m.user_id, m);
    return map;
  }, [members]);
  return { ...query, members, byId };
}
