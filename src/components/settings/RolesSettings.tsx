import { Link } from "react-router-dom";
import { ArrowRight, Check, Minus } from "lucide-react";
import { useAuth, type AppRole } from "@/contexts/AuthContext";
import { PERMISSION_LABELS, ROLE_DESCRIPTIONS, ROLE_LABELS, roleCan, type Permission } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SettingsSection } from "./shared";

const ROLES: AppRole[] = ["admin", "manager", "rep"];
const PERMISSIONS = Object.keys(PERMISSION_LABELS) as Permission[];

/** Read-only explanation of what each workspace role can do (mirrors src/lib/permissions.ts and RLS). */
export function RolesSettings() {
  const { userRole, can } = useAuth();

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Roles"
        description="Every member has one role in this workspace. The database enforces these rules, so people only see and change what their role allows."
      >
        <ul className="grid gap-3 md:grid-cols-3">
          {ROLES.map((role) => {
            const mine = role === userRole;
            return (
              <li
                key={role}
                className={cn(
                  "rounded-lg border p-4",
                  mine ? "border-foreground/40 bg-secondary/50 ring-1 ring-foreground/10" : "border-border",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{ROLE_LABELS[role]}</h3>
                  {mine && <Badge variant="default">Your role</Badge>}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          Sales reps see the deals they own or created, the tasks they created or are assigned, and their own activities.
          Contacts and companies are shared with the whole team.
        </p>
      </SettingsSection>

      <SettingsSection
        title="Permissions"
        description="What each role can do."
        footer={
          can("team.manage_roles") ? (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/settings?tab=team">
                Change someone's role <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Only admins can change roles. Ask a workspace admin if you need more access.</p>
          )
        }
      >
        <div className="-mx-5 overflow-x-auto sm:-mx-6">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <caption className="sr-only">Permissions by role. Your role is {userRole ? ROLE_LABELS[userRole] : "unknown"}.</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="px-5 py-2 text-left text-xs font-medium text-muted-foreground sm:px-6">
                  Permission
                </th>
                {ROLES.map((role) => (
                  <th
                    key={role}
                    scope="col"
                    className={cn(
                      "w-24 px-3 py-2 text-center text-xs font-medium",
                      role === userRole ? "bg-secondary/60 text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {ROLE_LABELS[role]}
                    {role === userRole && <span className="sr-only"> (your role)</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((permission) => (
                <tr key={permission} className="border-b border-border/60 last:border-0">
                  <th scope="row" className="px-5 py-2.5 text-left font-normal sm:px-6">
                    {PERMISSION_LABELS[permission]}
                  </th>
                  {ROLES.map((role) => {
                    const allowed = roleCan(role, permission);
                    return (
                      <td key={role} className={cn("px-3 py-2.5 text-center", role === userRole && "bg-secondary/60")}>
                        {allowed ? (
                          <Check className="mx-auto h-4 w-4 text-success" role="img" aria-label="Allowed" />
                        ) : (
                          <Minus className="mx-auto h-4 w-4 text-muted-foreground/60" role="img" aria-label="Not allowed" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Managers can invite sales reps only. Contacts and companies can be deleted by their creator, a manager or an admin.
        </p>
      </SettingsSection>
    </div>
  );
}
