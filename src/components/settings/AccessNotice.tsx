import { Link } from "react-router-dom";
import { Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const COPY = {
  deals: "Reps see deals they own or created.",
  tasks: "Reps see tasks they created or are assigned to.",
  activities: "Reps see their own activities and activity on deals they can see.",
} as const;

/**
 * Subtle one-liner telling sales reps their view is scoped to their own records (RLS does the
 * filtering). Renders nothing for roles that see everything.
 */
export function RepScopeNotice({ scope, className }: { scope: keyof typeof COPY; className?: string }) {
  const { can } = useAuth();
  if (can("records.view_all")) return null;
  return (
    <p className={cn("flex items-start gap-1.5 text-xs text-muted-foreground", className)}>
      <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        {COPY[scope]} Ask an admin for wider access.{" "}
        <Link to="/settings?tab=roles" className="underline underline-offset-2 hover:text-foreground">
          About roles
        </Link>
      </span>
    </p>
  );
}
