import { useMemo, useState } from "react";
import { Download, Mail, Search, UserCog, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TOUR_CONTACTS, matchesQuery, memberById, relativeDays, type TourContact } from "./data";
import { typingSteps, useDemoScript } from "./hooks";
import { Avatar, LiveStatus, SceneHeader, Segmented } from "./ui";

type Filter = "all" | "open" | "quiet";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open deal" },
  { value: "quiet", label: "Quiet 14d+" },
];

export function ContactsScene({ demo, animate }: { demo: boolean; animate: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      TOUR_CONTACTS.filter(
        (c) =>
          matchesQuery(query, c.name, c.company, c.email) &&
          (filter === "all" || (filter === "open" ? c.openDeals > 0 : c.lastActivityDays >= 14)),
      ),
    [query, filter],
  );

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  useDemoScript(demo, [
    ...typingSteps("harlow", setQuery, 900, 90),
    [900, () => setOpenId("c1")],
    [2000, () => setOpenId(null)],
    [300, () => setQuery("")],
    [600, () => setFilter("quiet")],
    [900, () => setSelected(new Set(["c4", "c8"]))],
  ]);

  const open = TOUR_CONTACTS.find((c) => c.id === openId) ?? null;
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  return (
    <div className="relative flex h-full flex-col">
      <SceneHeader title="Contacts" subtitle={`${TOUR_CONTACTS.length} people · shared with the whole team`}>
        <label className="relative">
          <span className="sr-only">Search contacts</span>
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people"
            className="h-8 w-32 rounded-md border border-border bg-background pl-7 pr-2 text-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring sm:w-44"
          />
        </label>
      </SceneHeader>

      <div className="flex flex-wrap items-center gap-2 px-4 pt-3 sm:px-5">
        <Segmented<Filter> label="Filter contacts" value={filter} onChange={setFilter} options={FILTERS} />
        {(query || filter !== "all") && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {selected.size > 0 && (
        <div
          className={cn(
            "mx-4 mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-xs text-background sm:mx-5",
            animate && "animate-in fade-in-0 slide-in-from-top-1 duration-200",
          )}
        >
          <span className="font-medium tabular-nums">{selected.size} selected</span>
          <span className="flex-1" />
          {[
            { icon: UserCog, label: "Assign owner" },
            { icon: Download, label: "Export CSV" },
          ].map(({ icon: Icon, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => setStatus(`${label} runs on the selected people in your workspace.`)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-background/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/60"
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            aria-label="Clear selection"
            className="rounded-md p-1 hover:bg-background/15"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-3 p-4 sm:p-5">
        <div className="min-w-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card">
          <table className="w-full table-fixed text-left text-xs">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border text-[11px] text-muted-foreground">
                <th className="w-9 py-2 pl-3">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allChecked}
                    onChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))}
                    className="h-3.5 w-3.5 accent-foreground"
                  />
                </th>
                <th className="py-2 font-medium">Name</th>
                <th className="hidden py-2 font-medium sm:table-cell">Company</th>
                <th className="hidden w-24 py-2 font-medium md:table-cell">Owner</th>
                <th className="w-24 py-2 pr-3 text-right font-medium">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <ContactRow
                  key={c.id}
                  contact={c}
                  checked={selected.has(c.id)}
                  active={openId === c.id}
                  onToggle={() => toggle(c.id)}
                  onOpen={() => setOpenId(c.id)}
                />
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    No people match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {open && (
          <aside
            aria-label={`${open.name} details`}
            className={cn(
              "absolute inset-x-3 bottom-12 z-20 rounded-lg border border-border bg-card p-4 shadow-lg md:static md:w-56 md:shrink-0 md:shadow-none",
              animate && "animate-in fade-in-0 slide-in-from-right-2 duration-200",
            )}
          >
            <div className="flex items-start gap-2">
              <Avatar initials={open.initials} className="h-8 w-8 text-xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{open.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {open.title} · {open.company}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenId(null)}
                aria-label="Close details"
                className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <dl className="mt-3 space-y-1.5 text-xs">
              <div className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">{open.email}</span>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Open deals</dt>
                <dd className="tabular-nums">{open.openDeals}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Owner</dt>
                <dd>{memberById(open.ownerId).name}</dd>
              </div>
            </dl>
            <p className="mt-3 border-t border-border pt-2 text-[11px] text-muted-foreground">
              Latest: Walkthrough meeting · {relativeDays(-open.lastActivityDays)}
            </p>
          </aside>
        )}
      </div>
      <div className="border-t border-border px-4 py-2 sm:px-5">
        <LiveStatus message={status ?? "Search, filter, select rows for bulk actions, or click a person."} />
      </div>
    </div>
  );
}

function ContactRow({
  contact: c,
  checked,
  active,
  onToggle,
  onOpen,
}: {
  contact: TourContact;
  checked: boolean;
  active: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const owner = memberById(c.ownerId);
  const quiet = c.lastActivityDays >= 14;
  return (
    <tr
      onClick={onOpen}
      className={cn(
        "cursor-pointer border-b border-border last:border-0 transition-colors duration-150 hover:bg-secondary/50",
        (checked || active) && "bg-secondary/60",
      )}
    >
      <td className="py-2 pl-3" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          aria-label={`Select ${c.name}`}
          checked={checked}
          onChange={onToggle}
          className="h-3.5 w-3.5 accent-foreground"
        />
      </td>
      <td className="py-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="flex min-w-0 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar initials={c.initials} />
          <span className="min-w-0">
            <span className="block truncate font-medium">{c.name}</span>
            <span className="block truncate text-[11px] text-muted-foreground sm:hidden">{c.company}</span>
            <span className="hidden truncate text-[11px] text-muted-foreground sm:block">{c.email}</span>
          </span>
        </button>
      </td>
      <td className="hidden truncate py-2 sm:table-cell">{c.company}</td>
      <td className="hidden py-2 md:table-cell">
        <span className="flex items-center gap-1.5 truncate">
          <Avatar initials={owner.initials} className="h-5 w-5" />
          <span className="truncate">{owner.name.split(" ")[0]}</span>
        </span>
      </td>
      <td className={cn("py-2 pr-3 text-right tabular-nums", quiet ? "font-medium text-warning" : "text-muted-foreground")}>
        {relativeDays(-c.lastActivityDays)}
      </td>
    </tr>
  );
}
