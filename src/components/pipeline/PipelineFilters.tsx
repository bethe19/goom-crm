import { addDays, endOfMonth, endOfQuarter, format, startOfMonth, startOfQuarter } from "date-fns";
import { CalendarRange, Search, UserRound, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { hasActiveDealFilters, type DealFilters } from "./dealUtils";
import { memberName, type WorkspaceMember } from "./useWorkspaceMembers";

interface PipelineFiltersProps {
  filters: DealFilters;
  onChange: (patch: Partial<DealFilters>) => void;
  onClear: () => void;
  members: WorkspaceMember[];
  currentUserId?: string;
  currency?: string;
  className?: string;
}

const iso = (d: Date) => format(d, "yyyy-MM-dd");

function closeLabel(f: DealFilters) {
  const suffix = f.openOnly ? " · open" : "";
  if (!f.closeFrom && !f.closeTo) return f.openOnly ? "Open deals" : "Close date";
  const fmt = (s: string) => format(new Date(`${s}T00:00:00`), "MMM d");
  if (f.closeFrom && f.closeTo) return `${fmt(f.closeFrom)} – ${fmt(f.closeTo)}${suffix}`;
  return (f.closeFrom ? `From ${fmt(f.closeFrom)}` : `Until ${fmt(f.closeTo)}`) + suffix;
}

export function PipelineFilters({ filters, onChange, onClear, members, currentUserId, currency = "ETB", className }: PipelineFiltersProps) {
  const now = new Date();
  // "Past due" means open deals only: won and lost deals past their close date aren't late.
  const presets: { label: string; from: string; to: string; openOnly: boolean }[] = [
    { label: "This month", from: iso(startOfMonth(now)), to: iso(endOfMonth(now)), openOnly: false },
    { label: "Next 30 days", from: iso(now), to: iso(addDays(now, 30)), openOnly: false },
    { label: "This quarter", from: iso(startOfQuarter(now)), to: iso(endOfQuarter(now)), openOnly: false },
    { label: "Past due", from: "", to: iso(addDays(now, -1)), openOnly: true },
  ];
  const active = hasActiveDealFilters(filters);
  const dateActive = !!(filters.closeFrom || filters.closeTo || filters.openOnly);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} role="search" aria-label="Filter deals">
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          placeholder="Search deals, companies, contacts…"
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
          className="h-9 pl-9 text-sm"
          aria-label="Search deals"
        />
      </div>

      <Toggle
        variant="outline"
        size="sm"
        pressed={filters.owner === "mine"}
        onPressedChange={(p) => onChange({ owner: p ? "mine" : "all" })}
        className="h-9 gap-1.5 px-3 text-sm"
        aria-label="Only my deals"
      >
        <UserRound className="h-4 w-4" aria-hidden /> Mine
      </Toggle>

      <Select value={filters.owner} onValueChange={(v) => onChange({ owner: v })}>
        <SelectTrigger className="h-9 w-[150px] text-sm" aria-label="Owner">
          <SelectValue placeholder="Any owner" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any owner</SelectItem>
          <SelectItem value="mine">My deals</SelectItem>
          {members
            .filter((m) => m.user_id !== currentUserId)
            .map((m) => (
              <SelectItem key={m.user_id} value={m.user_id}>
                {memberName(m)}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("h-9 gap-1.5 rounded-md px-3 font-normal", dateActive && "border-foreground/40")}>
            <CalendarRange className="h-4 w-4" aria-hidden />
            {closeLabel(filters)}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 space-y-3">
          <p className="text-sm font-semibold">Expected close date</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="close-from" className="text-xs">From</Label>
              <Input id="close-from" type="date" value={filters.closeFrom} onChange={(e) => onChange({ closeFrom: e.target.value })} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="close-to" className="text-xs">To</Label>
              <Input id="close-to" type="date" value={filters.closeTo} onChange={(e) => onChange({ closeTo: e.target.value })} className="h-9 text-sm" />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <Button key={p.label} variant="secondary" size="sm" className="h-7 px-2.5 text-xs" onClick={() => onChange({ closeFrom: p.from, closeTo: p.to, openOnly: p.openOnly })}>
                {p.label}
              </Button>
            ))}
          </div>
          {filters.openOnly && <p className="text-xs text-muted-foreground">Showing open deals only.</p>}
          {dateActive && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onChange({ closeFrom: "", closeTo: "", openOnly: false })}>
              Clear dates
            </Button>
          )}
        </PopoverContent>
      </Popover>

      <div className="relative">
        <Label htmlFor="min-value" className="sr-only">Minimum value ({currency})</Label>
        <Input
          id="min-value"
          type="number"
          inputMode="decimal"
          min={0}
          placeholder={`Min value (${currency})`}
          value={filters.minValue}
          onChange={(e) => onChange({ minValue: e.target.value })}
          className="h-9 w-[150px] text-sm tabular-nums"
        />
      </div>

      {active && (
        <Button variant="ghost" size="sm" className="h-9 gap-1 px-3" onClick={onClear}>
          <X className="h-4 w-4" aria-hidden /> Clear filters
        </Button>
      )}
    </div>
  );
}
