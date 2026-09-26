import { useCallback, useMemo } from "react";
import { useAuth, type AppRole } from "@/contexts/AuthContext";
import { canModifyRecord } from "@/lib/permissions";

export type RecordOwnership = {
  created_by?: string | null;
  owner_id?: string | null;
  user_id?: string | null;
  assigned_to?: string | null;
};

/**
 * Splits a selection into ids the user may delete and a count of ids they may not (e.g. a rep
 * selecting contacts created by teammates). Ids whose record isn't in `lookup` count as denied
 * for roles without `records.delete_any`, so we never offer a delete RLS would silently ignore.
 */
export function partitionDeletable(
  ids: string[],
  lookup: ReadonlyMap<string, RecordOwnership>,
  role: AppRole | null | undefined,
  userId: string | null | undefined,
): { allowed: string[]; denied: number } {
  const allowed: string[] = [];
  let denied = 0;
  for (const id of ids) {
    const record = lookup.get(id);
    const ok = role === "admin" || role === "manager" ? true : !!record && canModifyRecord(role, userId, record, "delete");
    if (ok) allowed.push(id);
    else denied += 1;
  }
  return { allowed, denied };
}

/** Record-level edit/delete checks for the current user (mirrors RLS; see src/lib/permissions.ts). */
export function useRecordPermissions() {
  const { userRole, user } = useAuth();
  const userId = user?.id;
  const canDelete = useCallback((record: RecordOwnership) => canModifyRecord(userRole, userId, record, "delete"), [userRole, userId]);
  const canEdit = useCallback((record: RecordOwnership) => canModifyRecord(userRole, userId, record, "edit"), [userRole, userId]);
  const partition = useCallback(
    (ids: string[], lookup: ReadonlyMap<string, RecordOwnership>) => partitionDeletable(ids, lookup, userRole, userId),
    [userRole, userId],
  );
  return useMemo(() => ({ canDelete, canEdit, partition }), [canDelete, canEdit, partition]);
}
