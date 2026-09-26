import type { AppRole } from "@/contexts/AuthContext";

/**
 * Role-based access control inside a workspace. The database (RLS + RPC checks) is the
 * enforcement layer; this matrix drives what the UI shows so people aren't offered actions
 * that would be rejected. Keep it in sync with supabase/migrations/*_rbac_*.sql.
 *
 * Visibility: admins and managers see every record in the workspace. Reps see the deals they
 * own or created, the tasks they created or are assigned, and their own activities (plus
 * activities on deals they can see). Contacts and companies are shared with everyone.
 */
export type Permission =
  | "records.view_all" // see every deal/task/activity (not just own)
  | "records.delete_any" // delete records created/owned by others
  | "deals.reassign" // change a deal's owner to someone else
  | "pipelines.manage" // create/edit/reorder pipelines and stages
  | "team.view_reports" // team-wide reports, leaderboard, forecast by owner
  | "team.invite" // invite teammates (managers: reps only)
  | "team.invite_any_role" // invite managers/admins
  | "team.manage_roles" // change roles, remove members
  | "workspace.settings" // workspace name, currency, quota
  | "workspace.billing" // change plan
  | "workspace.admin" // workspace admin page (feedback triage, backup)
  | "data.import" // CSV import
  | "data.export_all"; // export every record in the workspace

const MATRIX: Record<AppRole, Permission[]> = {
  admin: [
    "records.view_all",
    "records.delete_any",
    "deals.reassign",
    "pipelines.manage",
    "team.view_reports",
    "team.invite",
    "team.invite_any_role",
    "team.manage_roles",
    "workspace.settings",
    "workspace.billing",
    "workspace.admin",
    "data.import",
    "data.export_all",
  ],
  manager: [
    "records.view_all",
    "records.delete_any",
    "deals.reassign",
    "pipelines.manage",
    "team.view_reports",
    "team.invite",
    "data.import",
    "data.export_all",
  ],
  rep: ["data.import"],
};

export const ROLE_LABELS: Record<AppRole, string> = { admin: "Admin", manager: "Manager", rep: "Sales rep" };

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  admin: "Full access: every record, team and roles, pipelines, workspace settings and plan.",
  manager: "Every record and team reports; manages pipelines and invites reps. No billing or role changes.",
  rep: "Works their own deals, tasks and activities. Contacts and companies are shared with the team.",
};

/** Human-readable rows for the Roles & permissions page. */
export const PERMISSION_LABELS: Record<Permission, string> = {
  "records.view_all": "See every deal, task and activity",
  "records.delete_any": "Delete records created by others",
  "deals.reassign": "Reassign deals to other owners",
  "pipelines.manage": "Manage pipelines and stages",
  "team.view_reports": "Team reports, leaderboard and forecast",
  "team.invite": "Invite teammates",
  "team.invite_any_role": "Invite managers and admins",
  "team.manage_roles": "Change roles and remove members",
  "workspace.settings": "Workspace name, currency and quota",
  "workspace.billing": "Change the plan",
  "workspace.admin": "Workspace admin page (feedback, backup)",
  "data.import": "Import CSV data",
  "data.export_all": "Export all workspace data",
};

export function roleCan(role: AppRole | null | undefined, permission: Permission): boolean {
  return !!role && MATRIX[role].includes(permission);
}

export function permissionsFor(role: AppRole): Permission[] {
  return MATRIX[role];
}

/** Record-level check mirroring the RLS delete/update rules for reps. */
export function canModifyRecord(
  role: AppRole | null | undefined,
  userId: string | null | undefined,
  record: { created_by?: string | null; owner_id?: string | null; user_id?: string | null; assigned_to?: string | null },
  action: "edit" | "delete",
): boolean {
  if (!role || !userId) return false;
  if (role === "admin" || role === "manager") return true;
  const mine =
    record.created_by === userId || record.owner_id === userId || record.user_id === userId || record.assigned_to === userId;
  // Contacts and companies (only created_by) are shared: any member may edit, only the creator deletes.
  const sharedRecord = record.owner_id === undefined && record.user_id === undefined && record.assigned_to === undefined;
  if (action === "edit" && sharedRecord) return true;
  return mine;
}
