import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppRole } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface RequireRoleProps {
  role: AppRole;
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * Route guard that redirects users who don't have the required role.
 * Renders a spinner while the role is still loading from the DB.
 * Demo mode users are always redirected (they can never be admins).
 */
export function RequireRole({ role, children, redirectTo = "/dashboard" }: RequireRoleProps) {
  const { userRole, loading, isDemoMode } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isDemoMode || userRole !== role) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
