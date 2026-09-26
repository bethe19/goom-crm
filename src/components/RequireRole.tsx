import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { useAuth, type AppRole } from "@/contexts/AuthContext";
import type { Permission } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface RequireRoleProps {
  /** Required role. Admins always pass; "manager" also admits admins. */
  role: AppRole;
  children: React.ReactNode;
  /** Where the "back" link points. */
  redirectTo?: string;
}

const RANK: Record<AppRole, number> = { rep: 0, manager: 1, admin: 2 };

function GuardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

/** Friendly "you can't open this" view used by every route guard. */
export function NoAccess({
  description,
  redirectTo = "/dashboard",
  backLabel = "Back to dashboard",
}: {
  description: string;
  redirectTo?: string;
  backLabel?: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Lock className="h-5 w-5" aria-hidden="true" />
      </div>
      <h1 className="text-lg font-semibold">You don't have access to this page</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      <Button asChild variant="outline" className="mt-6">
        <Link to={redirectTo}>{backLabel}</Link>
      </Button>
    </div>
  );
}

/** Route guard: waits for the workspace role, then renders the page or a friendly no-access view. */
export function RequireRole({ role, children, redirectTo = "/dashboard" }: RequireRoleProps) {
  const { userRole, loading } = useAuth();

  if (loading) return <GuardSkeleton />;

  if (!userRole || RANK[userRole] < RANK[role]) {
    const roleName = role === "admin" ? "workspace admins" : role === "manager" ? "managers and admins" : "members";
    return (
      <NoAccess
        redirectTo={redirectTo}
        description={`This area is only available to ${roleName}. Ask an admin of your workspace if you need access.`}
      />
    );
  }

  return <>{children}</>;
}

/** Route guard on an RBAC permission (see src/lib/permissions.ts). */
export function RequirePermission({
  permission,
  children,
  redirectTo = "/dashboard",
}: {
  permission: Permission;
  children: React.ReactNode;
  redirectTo?: string;
}) {
  const { can, loading } = useAuth();
  if (loading) return <GuardSkeleton />;
  if (!can(permission)) {
    return (
      <NoAccess
        redirectTo={redirectTo}
        description="Your role in this workspace doesn't include this area. Ask a workspace admin if you need access."
      />
    );
  }
  return <>{children}</>;
}

/** Route guard for the SaaS operator console (platform_admins). */
export function RequirePlatformAdmin({ children }: { children: React.ReactNode }) {
  const { isPlatformAdmin, loading } = useAuth();
  if (loading) return <GuardSkeleton />;
  if (!isPlatformAdmin) {
    return <NoAccess description="The platform console is only available to the operators of this Goom installation." />;
  }
  return <>{children}</>;
}
