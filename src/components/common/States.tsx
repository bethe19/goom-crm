import type { LucideIcon } from "lucide-react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { sanitizeErrorMessage } from "@/lib/sanitize";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  /** Primary call to action, e.g. <Button>Add contact</Button> */
  action?: React.ReactNode;
  /** Secondary call to action, e.g. "Import CSV" */
  secondaryAction?: React.ReactNode;
  className?: string;
  /** Compact variant for use inside cards, sheets and side panels. */
  compact?: boolean;
}

/**
 * Shown when a list or view has no data. Always explain why it's empty and offer the next step.
 * For "no results for this search/filter", pass a clear-filters button as the action.
 */
export function EmptyState({ icon: Icon, title, description, action, secondaryAction, className, compact }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 px-4" : "py-16 px-6 rounded-xl border border-dashed border-border bg-card/40",
        className,
      )}
    >
      <div className={cn("flex items-center justify-center rounded-full bg-secondary text-muted-foreground", compact ? "h-9 w-9 mb-3" : "h-12 w-12 mb-4")}>
        <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} aria-hidden />
      </div>
      <h3 className={cn("font-semibold text-foreground", compact ? "text-sm" : "text-base")}>{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground text-balance">{description}</p>}
      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

interface ErrorStateProps {
  error?: unknown;
  title?: string;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

/** Shown when a query fails. Pass the react-query `refetch` as onRetry. */
export function ErrorState({ error, title = "Couldn't load this", onRetry, className, compact }: ErrorStateProps) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : (error as { message?: string } | undefined)?.message;
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 px-4" : "py-16 px-6 rounded-xl border border-destructive/25 bg-destructive/[0.03]",
        className,
      )}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{sanitizeErrorMessage(message)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={onRetry}>
          <RotateCw className="h-3.5 w-3.5" /> Try again
        </Button>
      )}
    </div>
  );
}

/** Skeleton placeholder for table/list pages while the first page loads. */
export function ListSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-card", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border/60 px-4 py-3.5 last:border-0">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/5" />
          </div>
          <Skeleton className="hidden h-3.5 w-24 sm:block" />
        </div>
      ))}
    </div>
  );
}
