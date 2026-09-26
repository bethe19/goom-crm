import { useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import { Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { cn } from "@/lib/utils";

export interface BulkAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  destructive?: boolean;
  pending?: boolean;
  /** Label shown while pending, e.g. "Deleting…". */
  pendingLabel?: string;
  disabled?: boolean;
}

interface BulkActionBarProps {
  count: number;
  onClear: () => void;
  /** Generic actions, rendered left to right. */
  actions?: BulkAction[];
  /** Legacy: renders a confirmed "Delete" action. Prefer `actions`. */
  onDelete?: () => void;
  /** Legacy: pending state for `onDelete`. */
  deleting?: boolean;
  /** Singular/plural noun used in the legacy delete confirmation, e.g. ["activity", "activities"]. */
  noun?: [string, string];
  children?: React.ReactNode;
}

function isEditable(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

/**
 * Floating toolbar shown while rows are selected. `Esc` clears the selection (unless a dialog,
 * menu or text field handles the key first).
 */
export function BulkActionBar({ count, onClear, actions = [], onDelete, deleting, noun = ["record", "records"], children }: BulkActionBarProps) {
  const confirm = useConfirm();

  useEffect(() => {
    if (count === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || isEditable(e.target)) return;
      if (document.querySelector("[role='dialog'][data-state='open'], [role='alertdialog'][data-state='open'], [role='menu'][data-state='open']")) return;
      onClear();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [count, onClear]);

  if (count === 0) return null;

  const allActions: BulkAction[] = [...actions];
  if (onDelete) {
    allActions.push({
      label: "Delete",
      icon: Trash2,
      destructive: true,
      pending: deleting,
      pendingLabel: "Deleting…",
      onClick: async () => {
        const word = count === 1 ? noun[0] : noun[1];
        const ok = await confirm({
          title: `Delete ${count} ${word}?`,
          description: "This can't be undone.",
          confirmLabel: `Delete ${count} ${word}`,
        });
        if (ok) onDelete();
      },
    });
  }
  const anyPending = allActions.some((a) => a.pending);

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className={cn(
        "fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-fit flex-wrap items-center justify-center gap-1.5 rounded-xl border bg-popover px-3 py-2 text-popover-foreground shadow-lg",
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 duration-200",
        "sm:bottom-6 sm:flex-nowrap",
      )}
    >
      <span className="px-1.5 text-sm font-medium tabular-nums" aria-live="polite">
        {count} selected
      </span>
      <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
      {allActions.map((a) => {
        const Icon = a.pending ? Loader2 : a.icon;
        return (
          <Button
            key={a.label}
            type="button"
            size="sm"
            variant="ghost"
            className={cn("h-8 gap-1.5", a.destructive && "text-destructive hover:bg-destructive/10 hover:text-destructive")}
            onClick={a.onClick}
            disabled={a.disabled || anyPending}
          >
            {Icon && <Icon className={cn("h-4 w-4", a.pending && "animate-spin")} aria-hidden />}
            {a.pending && a.pendingLabel ? a.pendingLabel : a.label}
          </Button>
        );
      })}
      {children}
      <Button type="button" size="sm" variant="ghost" className="h-8 gap-1.5 text-muted-foreground" onClick={onClear} aria-label="Clear selection (Esc)">
        <X className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Clear</span>
      </Button>
    </div>
  );
}
