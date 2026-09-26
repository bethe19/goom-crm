import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PAGE_SIZE } from "@/lib/postgrest";
import { formatNumber } from "@/lib/formatters";
import { lastPage, pageRange } from "./platformUtils";

interface PaginationProps {
  page: number;
  rowCount: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Background refetch in progress (keeps the previous page visible). */
  fetching?: boolean;
  /** Plural noun for screen readers, e.g. "workspaces". */
  noun: string;
}

/** "Showing 1–50 of 312" footer with previous/next buttons. */
export function Pagination({ page, rowCount, total, onPageChange, fetching, noun }: PaginationProps) {
  const { from, to } = pageRange(page, PAGE_SIZE, rowCount);
  const hasPrev = page > 0;
  const hasNext = page < lastPage(total, PAGE_SIZE);
  return (
    <nav
      aria-label={`${noun} pagination`}
      className="flex flex-col gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="tabular-nums" aria-live="polite">
        Showing {formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)}
        {fetching && <span className="sr-only"> (updating)</span>}
      </span>
      {(hasPrev || hasNext) && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={!hasPrev || fetching}>
            <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={!hasNext || fetching}>
            Next <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      )}
    </nav>
  );
}

export function SearchField({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
}) {
  return (
    <div className="relative w-full sm:w-72" role="search">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 pl-9 text-sm"
      />
    </div>
  );
}

/** Card frame for a paginated table: rounded border, clean horizontal scroll on small screens. */
export function TableFrame({ children, busy }: { children: React.ReactNode; busy?: boolean }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card" aria-busy={busy || undefined}>
      {children}
    </div>
  );
}
