import { useMemo, useState, type KeyboardEvent } from "react";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  CornerDownLeft,
  KanbanSquare,
  LineChart,
  Plus,
  Search,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TOUR_CONTACTS, formatMoney, matchesQuery, type TourDeal } from "./data";
import { typingSteps, useDemoScript } from "./hooks";
import { LiveStatus } from "./ui";

export type TourNavTarget = "pipeline" | "tasks" | "forecast" | "reports" | "deal" | "contacts";

interface Item {
  id: string;
  group: "Deals" | "Contacts" | "Go to" | "Create";
  label: string;
  meta?: string;
  icon: LucideIcon;
  target?: TourNavTarget;
}

const GROUP_ORDER = ["Deals", "Contacts", "Go to", "Create"] as const;

const NAV_ITEMS: Item[] = [
  { id: "g-pipeline", group: "Go to", label: "Pipeline", icon: KanbanSquare, target: "pipeline" },
  { id: "g-tasks", group: "Go to", label: "Tasks & calendar", icon: CalendarDays, target: "tasks" },
  { id: "g-forecast", group: "Go to", label: "Forecast", icon: LineChart, target: "forecast" },
  { id: "g-reports", group: "Go to", label: "Reports", icon: BarChart3, target: "reports" },
  { id: "n-deal", group: "Create", label: "New deal", icon: Plus },
  { id: "n-contact", group: "Create", label: "New contact", icon: Plus },
  { id: "n-task", group: "Create", label: "New task", icon: Plus },
];

export function CommandScene({
  deals,
  featuredDealId,
  onNavigate,
  demo,
  animate,
}: {
  deals: TourDeal[];
  featuredDealId: string;
  onNavigate: (target: TourNavTarget) => void;
  demo: boolean;
  animate: boolean;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState<string | null>(null);

  const items = useMemo<Item[]>(() => {
    const dealItems: Item[] = deals.map((d) => ({
      id: d.id,
      group: "Deals",
      label: d.title,
      meta: `${d.company} · ${formatMoney(d.value)}`,
      icon: CircleDollarSign,
      target: d.id === featuredDealId ? "deal" : undefined,
    }));
    const contactItems: Item[] = TOUR_CONTACTS.map((c) => ({
      id: c.id,
      group: "Contacts",
      label: c.name,
      meta: c.company,
      icon: UserRound,
      target: "contacts",
    }));
    const q = query.trim();
    const found = q
      ? [...dealItems, ...contactItems, ...NAV_ITEMS].filter((i) => matchesQuery(q, i.label, i.meta ?? "")).slice(0, 8)
      : [...dealItems.slice(0, 3), ...NAV_ITEMS];
    // Keep keyboard order identical to the grouped visual order.
    return GROUP_ORDER.flatMap((g) => found.filter((i) => i.group === g));
  }, [deals, featuredDealId, query]);

  const choose = (item: Item | undefined, fromDemo = false) => {
    if (!item) return;
    if (item.target && !fromDemo) {
      onNavigate(item.target);
      return;
    }
    setStatus(
      item.group === "Create"
        ? `“${item.label}” opens the create form, from any page.`
        : `Opens ${item.label}${item.meta ? ` (${item.meta})` : ""}.`,
    );
  };

  useDemoScript(demo, [
    ...typingSteps("harlow", (v) => {
      setQuery(v);
      setActive(0);
    }, 900, 110),
    [900, () => setActive(1)],
    [800, () => setActive(0)],
    [700, () => choose(items[0], true)],
  ]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(items[active]);
    }
  };

  const groups = GROUP_ORDER
    .map((g) => ({ group: g, items: items.filter((i) => i.group === g) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="relative flex h-full flex-col bg-secondary/40">
      {/* Dimmed page behind the palette */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 space-y-3 p-5 opacity-40 blur-[1px]">
        <div className="h-5 w-40 rounded bg-muted" />
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-40 rounded-lg bg-muted" />
          ))}
        </div>
      </div>
      <div className="absolute inset-0 bg-foreground/10" aria-hidden="true" />

      <div className="relative flex flex-1 items-start justify-center p-3 pt-6 sm:p-6 sm:pt-10">
        <div
          className={cn(
            "w-full max-w-lg overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl",
            animate && "animate-in fade-in-0 zoom-in-95 duration-200",
          )}
        >
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              role="combobox"
              aria-expanded="true"
              aria-controls="tour-command-list"
              aria-activedescendant={items[active] ? `tour-cmd-${items[active].id}` : undefined}
              aria-label="Search records and pages"
              placeholder="Search deals, people, pages…"
              className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="rounded border border-border px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground">Esc</kbd>
          </div>
          <div id="tour-command-list" role="listbox" aria-label="Results" className="max-h-[300px] overflow-y-auto p-1.5">
            {groups.map(({ group, items: gi }) => (
              <div key={group} role="group" aria-label={group} className="pb-1">
                <p className="px-2 pb-1 pt-2 text-[11px] font-medium text-muted-foreground">{group}</p>
                {gi.map((item) => {
                  const index = items.indexOf(item);
                  const Icon = item.icon;
                  const isActive = index === active;
                  return (
                    <div
                      key={item.id}
                      id={`tour-cmd-${item.id}`}
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => choose(item)}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm",
                        isActive ? "bg-secondary text-foreground" : "text-foreground/90",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                      {item.meta && <span className="hidden truncate text-xs text-muted-foreground sm:inline">{item.meta}</span>}
                      {isActive && <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
                    </div>
                  );
                })}
              </div>
            ))}
            {items.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">No results for “{query}”.</p>}
          </div>
          <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border px-1 font-sans">↑</kbd>
              <kbd className="rounded border border-border px-1 font-sans">↓</kbd> navigate
            </span>
            <span className="flex items-center gap-1">
              <CornerDownLeft className="h-3 w-3" aria-hidden="true" /> open
            </span>
            <span className="ml-auto hidden sm:inline">Ctrl K / ⌘K from anywhere</span>
          </div>
        </div>
      </div>
      <div className="relative border-t border-border bg-background px-4 py-2 sm:px-5">
        <LiveStatus message={status ?? "Type to search, use the arrow keys, press Enter. “Go to” items switch this tour."} />
      </div>
    </div>
  );
}
