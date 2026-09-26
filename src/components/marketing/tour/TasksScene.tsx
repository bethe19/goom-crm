import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { INITIAL_TASKS, dateFromToday, relativeDays, shortDate, type TourDeal, type TourTask } from "./data";
import { useDemoScript } from "./hooks";
import { LiveStatus, SceneHeader } from "./ui";

const PRIORITY: Record<TourTask["priority"], string> = {
  high: "border-destructive/30 text-destructive",
  medium: "border-warning/30 text-warning",
  low: "border-border text-muted-foreground",
};

function dayDiff(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

export function TasksScene({ deals, demo, animate }: { deals: TourDeal[]; demo: boolean; animate: boolean }) {
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [day, setDay] = useState<number | null>(null); // offset from today
  const [status, setStatus] = useState<string | null>(null);

  const toggle = (id: string) => {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
    const t = tasks.find((x) => x.id === id);
    if (t) setStatus(t.done ? `Reopened “${t.title}”.` : `Completed “${t.title}”.`);
  };

  useDemoScript(demo, [
    [1400, () => toggle("t1")],
    [1500, () => setDay(5)],
    [2200, () => setDay(null)],
  ]);

  const visible = day === null ? tasks : tasks.filter((t) => t.dueInDays === day);
  const groups = [
    { label: "Overdue", items: visible.filter((t) => t.dueInDays < 0) },
    { label: "Today", items: visible.filter((t) => t.dueInDays === 0) },
    { label: "Upcoming", items: visible.filter((t) => t.dueInDays > 0) },
  ].filter((g) => g.items.length > 0);
  const openCount = tasks.filter((t) => !t.done).length;
  const overdueCount = tasks.filter((t) => !t.done && t.dueInDays < 0).length;

  return (
    <div className="flex h-full flex-col">
      <SceneHeader
        title="Tasks & calendar"
        subtitle={
          <>
            <span className="tabular-nums">{openCount}</span> open · <span className="tabular-nums">{overdueCount}</span> overdue
          </>
        }
      />
      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 sm:p-5 md:grid-cols-[1fr_260px]">
        <div className="min-w-0 space-y-3">
          {day !== null && (
            <div className="flex items-center justify-between rounded-md bg-secondary/60 px-3 py-1.5 text-xs">
              <span>Due {shortDate(day)}</span>
              <button type="button" onClick={() => setDay(null)} className="font-medium underline-offset-4 hover:underline">
                Show all
              </button>
            </div>
          )}
          {groups.map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h4 className={cn("mb-1.5 text-[11px] font-semibold", g.label === "Overdue" ? "text-destructive" : "text-muted-foreground")}>
                {g.label} <span className="tabular-nums">({g.items.length})</span>
              </h4>
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {g.items.map((t) => (
                  <li key={t.id} className="flex items-center gap-2.5 px-3 py-2">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={t.done}
                      aria-label={`Mark “${t.title}” ${t.done ? "not done" : "done"}`}
                      onClick={() => toggle(t.id)}
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        t.done ? "border-foreground bg-foreground text-background" : "border-muted-foreground/50 hover:border-foreground",
                      )}
                    >
                      {t.done && <Check className={cn("h-3 w-3", animate && "animate-in zoom-in-50 duration-150")} aria-hidden="true" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-xs font-medium transition-colors", t.done && "text-muted-foreground line-through")}>
                        {t.title}
                      </p>
                      {t.dealTitle && <p className="truncate text-[11px] text-muted-foreground">{t.dealTitle}</p>}
                    </div>
                    <span className={cn("hidden rounded-full border px-1.5 py-0.5 text-[11px] capitalize sm:inline", PRIORITY[t.priority])}>
                      {t.priority}
                    </span>
                    <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{relativeDays(t.dueInDays)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {groups.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
              Nothing due that day.
            </p>
          )}
        </div>

        <MiniCalendar tasks={tasks} deals={deals} selected={day} onSelect={(d) => setDay((cur) => (cur === d ? null : d))} />
      </div>
      <div className="border-t border-border px-4 py-2 sm:px-5">
        <LiveStatus message={status ?? "Tick off a task, or pick a day on the calendar."} />
      </div>
    </div>
  );
}

function MiniCalendar({
  tasks,
  deals,
  selected,
  onSelect,
}: {
  tasks: TourTask[];
  deals: TourDeal[];
  selected: number | null;
  onSelect: (offset: number) => void;
}) {
  const today = useMemo(() => dateFromToday(0), []);
  // A rolling five-week window starting the Monday of last week, so nearby dates are always visible.
  const lastWeek = dateFromToday(-7);
  const start = new Date(lastWeek.getFullYear(), lastWeek.getMonth(), lastWeek.getDate() - ((lastWeek.getDay() + 6) % 7));
  const cells: Date[] = Array.from(
    { length: 35 },
    (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
  );
  const end = cells[cells.length - 1];
  const rangeLabel =
    start.getMonth() === end.getMonth()
      ? start.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : `${start.toLocaleDateString("en-US", { month: "short" })} – ${end.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;

  return (
    <div className="hidden rounded-lg border border-border bg-card p-3 md:block">
      <p className="mb-2 text-xs font-semibold">{rangeLabel}</p>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[11px]">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="py-1 text-muted-foreground" aria-hidden="true">
            {d}
          </span>
        ))}
        {cells.map((date, i) => {
          const offset = dayDiff(date, today);
          const hasTask = tasks.some((t) => !t.done && t.dueInDays === offset);
          const hasClose = deals.some((d) => d.stage !== "won" && d.closeInDays === offset);
          const isToday = offset === 0;
          const labels = [hasTask && "task due", hasClose && "deal closing"].filter(Boolean).join(", ");
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(offset)}
              aria-pressed={selected === offset}
              aria-label={`${date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}${labels ? ` — ${labels}` : ""}`}
              className={cn(
                "relative flex h-8 flex-col items-center justify-center rounded-md tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected === offset ? "bg-foreground text-background" : "hover:bg-secondary",
                isToday && selected !== offset && "font-semibold ring-1 ring-foreground/40",
                date.getMonth() !== today.getMonth() && selected !== offset && "text-muted-foreground",
              )}
            >
              {date.getDate()}
              <span className="absolute bottom-0.5 flex gap-0.5">
                {hasTask && <span className="h-1 w-1 rounded-full bg-chart-2" />}
                {hasClose && <span className="h-1 w-1 rounded-full bg-chart-3" />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 border-t border-border pt-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-chart-2" /> Task due
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-chart-3" /> Deal closing
        </span>
      </div>
    </div>
  );
}
