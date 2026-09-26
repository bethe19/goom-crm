import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronLeft, ChevronRight, Copy, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Initials avatar used for people (round) and companies (square). */
export function RecordAvatar({ name, square, className }: { name: string; square?: boolean; className?: string }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-8 w-8 shrink-0 select-none items-center justify-center bg-secondary text-xs font-semibold text-foreground/80",
        square ? "rounded-lg" : "rounded-full",
        className,
      )}
    >
      {initials}
    </span>
  );
}

/** Small icon button that copies `value` to the clipboard. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy to the clipboard");
    }
  };
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground opacity-70 hover:opacity-100 focus-visible:opacity-100"
          onClick={copy}
          aria-label={`Copy ${label.toLowerCase()}`}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Copy {label.toLowerCase()}</TooltipContent>
    </Tooltip>
  );
}

/** Column header button that toggles sort. `active` is whether this column is the current sort. */
export function SortHeader({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  className?: string;
}) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("h-10 px-3 text-left align-middle text-xs font-medium text-muted-foreground", className)}
    >
      <button
        type="button"
        onClick={onClick}
        className="-mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {label}
        <Icon className={cn("h-3.5 w-3.5", !active && "opacity-40")} aria-hidden />
      </button>
    </th>
  );
}

/** Plain column header matching SortHeader styles. */
export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th scope="col" className={cn("h-10 px-3 text-left align-middle text-xs font-medium text-muted-foreground", className)}>
      {children}
    </th>
  );
}

/** "Showing 1–50 of 312" + previous/next. */
export function PaginationFooter({
  page,
  pageSize,
  total,
  onPageChange,
  fetching,
  noun = "records",
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  fetching?: boolean;
  noun?: string;
}) {
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2.5 text-xs text-muted-foreground">
      <p className="tabular-nums" aria-live="polite">
        Showing {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()} {noun}
        {fetching && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" aria-label="Loading" />}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => onPageChange(page - 1)} disabled={page <= 0}>
          <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
        </Button>
        <span className="px-2 tabular-nums">
          Page {page + 1} of {lastPage + 1}
        </span>
        <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => onPageChange(page + 1)} disabled={page >= lastPage}>
          Next <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
