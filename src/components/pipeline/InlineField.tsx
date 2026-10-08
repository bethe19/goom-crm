import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSaveStatus, type SaveStatus } from "./useSaveStatus";

import { AlertCircle, Check, Loader2, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status" aria-live="polite">
      {status === "saving" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Saving…
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" aria-hidden /> Saved
        </>
      )}
      {status === "error" && (
        <span className="inline-flex items-center gap-1 text-destructive">
          <AlertCircle className="h-3 w-3" aria-hidden /> Not saved
        </span>
      )}
    </span>
  );
}

interface FieldShellProps {
  label: string;
  htmlFor?: string;
  status?: SaveStatus;
  children: ReactNode;
  className?: string;
}

/** Label + save indicator row used by every editable field in detail views. */
export function FieldShell({ label, htmlFor, status = "idle", children, className }: FieldShellProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
        <SaveIndicator status={status} />
      </div>
      {children}
    </div>
  );
}

interface InlineFieldProps {
  id: string;
  label: string;
  value: string;
  /** Rendered in read mode; defaults to the raw value. */
  display?: ReactNode;
  type?: "text" | "number" | "date";
  placeholder?: string;
  emptyText?: string;
  /** Return an error message to block saving. */
  validate?: (value: string) => string | null;
  onSave: (value: string) => Promise<unknown>;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  className?: string;
  displayClassName?: string;
}

/**
 * Click-to-edit text/number/date field. Enter or blur saves (only when changed), Esc cancels.
 * On error the input stays open with the user's text.
 *
 * While editing, the wrapper carries `data-inline-editing`: a surrounding sheet/dialog should ignore
 * Escape coming from inside it (Radix listens on the document in the capture phase, so the input
 * can't stop it), e.g. `onEscapeKeyDown` → `preventDefault()` when the target is inside `[data-inline-editing]`.
 */
export function InlineField({
  id,
  label,
  value,
  display,
  type = "text",
  placeholder,
  emptyText = "Add…",
  validate,
  onSave,
  inputProps,
  className,
  displayClassName,
}: InlineFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const { status, run } = useSaveStatus();
  const cancelled = useRef(false);
  // The value when editing started: blurring without typing must not write it back over a teammate's newer change.
  const baseline = useRef(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const normalize = (v: string) => (type === "text" ? v.trim() : v);

  const commit = async () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const next = normalize(draft);
    if (next === value || next === normalize(baseline.current)) {
      setEditing(false);
      setError(null);
      return;
    }
    const msg = validate?.(next) ?? null;
    if (msg) {
      setError(msg);
      return;
    }
    setError(null);
    const ok = await run(() => onSave(next));
    if (ok) setEditing(false);
  };

  return (
    <FieldShell label={label} htmlFor={id} status={status} className={className}>
      {editing ? (
        <div data-inline-editing="">
          <Input
            id={id}
            type={type}
            autoFocus
            value={draft}
            placeholder={placeholder}
            disabled={status === "saving"}
            aria-invalid={!!error}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                cancelled.current = true;
                setDraft(value);
                setError(null);
                setEditing(false);
              }
            }}
            className="h-9 text-sm"
            {...inputProps}
          />
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
      ) : (
        <button
          id={id}
          type="button"
          onClick={() => {
            cancelled.current = false;
            baseline.current = value;
            setDraft(value);
            setEditing(true);
          }}
          className={cn(
            "group flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-transparent px-2 py-1.5 -mx-2 text-left text-sm transition-colors hover:border-border hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            displayClassName,
          )}
          aria-label={`Edit ${label.toLowerCase()}`}
        >
          <span className={cn("min-w-0 truncate", !value && "text-muted-foreground")}>{value ? display ?? value : emptyText}</span>
          <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
        </button>
      )}
    </FieldShell>
  );
}
