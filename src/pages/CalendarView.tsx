import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addMonths, endOfDay, format, isSameMonth, isToday, startOfDay, startOfMonth, subMonths } from "date-fns";
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, List, Plus } from "lucide-react";
import { useTasksDueBetween } from "@/hooks/useTasks";
import { useDealsClosingBetween } from "@/hooks/useDeals";
import { useActivitiesBetween } from "@/hooks/useActivities";
import { useIsMobile } from "@/hooks/use-mobile";
import { PageBanner } from "@/components/PageBanner";
import { EmptyState, ErrorState } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { activityMeta } from "@/components/activities/activityUtils";
import {
  CALENDAR_KIND_META,
  bucketByDay,
  dayKey,
  monthGrid,
  parseCalendarDate,
  type CalendarItem,
  type CalendarKind,
} from "@/components/activities/calendarUtils";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_IN_CELL = 3;
const VIEW_KEY = "goom.calendar.view";

function readView(): "month" | "agenda" {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "agenda" ? "agenda" : "month";
  } catch {
    return "month";
  }
}

function ItemLink({ item, compact }: { item: CalendarItem; compact?: boolean }) {
  const meta = CALENDAR_KIND_META[item.kind];
  const time = item.timed ? format(item.date, "h:mm a") : null;
  return (
    <Link
      to={item.href}
      className={cn(
        "flex min-w-0 items-center gap-1.5 rounded-md transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        compact ? "px-1 py-0.5 text-xs" : "px-2 py-2 text-sm",
      )}
      title={`${meta.label}: ${item.title}`}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", meta.dot)} aria-hidden />
      <span className="sr-only">{meta.label}: </span>
      <span className={cn("truncate", item.completed && "text-muted-foreground line-through")}>{item.title}</span>
      {!compact && (
        <span className="ml-auto flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          {item.detail && <span>{item.detail}</span>}
          {time && <span className="tabular-nums">{time}</span>}
        </span>
      )}
    </Link>
  );
}

export default function CalendarView() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [view, setView] = useState<"month" | "agenda">(readView);
  const effectiveView = isMobile ? "agenda" : view;
  const [hidden, setHidden] = useState<Set<CalendarKind>>(new Set());

  const days = useMemo(() => monthGrid(month), [month]);
  const rangeStart = days[0];
  const rangeEnd = days[days.length - 1];
  const fromIso = startOfDay(rangeStart).toISOString();
  const toIso = endOfDay(rangeEnd).toISOString();

  const tasksQ = useTasksDueBetween(fromIso, toIso);
  const dealsQ = useDealsClosingBetween(dayKey(rangeStart), dayKey(rangeEnd));
  const activitiesQ = useActivitiesBetween(fromIso, toIso);
  const isLoading = tasksQ.isLoading || dealsQ.isLoading || activitiesQ.isLoading;
  const error = tasksQ.error || dealsQ.error || activitiesQ.error;

  const items = useMemo<CalendarItem[]>(() => {
    const out: CalendarItem[] = [];
    for (const t of tasksQ.data ?? []) {
      if (!t.due_date) continue;
      const { date, timed } = parseCalendarDate(t.due_date);
      out.push({ id: t.id, kind: "task", title: t.title, date, timed, href: `/tasks?open=${t.id}`, completed: t.completed, detail: t.completed ? "Done" : undefined });
    }
    for (const d of dealsQ.data ?? []) {
      const { date } = parseCalendarDate(d.close_date.slice(0, 10));
      out.push({ id: d.id, kind: "deal", title: d.title, date, timed: false, href: `/pipeline?open=${d.id}` });
    }
    for (const a of activitiesQ.data ?? []) {
      out.push({ id: a.id, kind: "activity", title: a.title, date: new Date(a.created_at), timed: true, href: `/activities?open=${a.id}`, detail: activityMeta(a.type).label });
    }
    return out.filter((i) => !hidden.has(i.kind));
  }, [tasksQ.data, dealsQ.data, activitiesQ.data, hidden]);

  const byDay = useMemo(() => bucketByDay(items), [items]);
  const monthDaysWithItems = useMemo(() => days.filter((d) => isSameMonth(d, month) && byDay.has(dayKey(d))), [days, month, byDay]);

  const createOn = (day: Date) => navigate(`/tasks?new=1&due=${dayKey(day)}`);
  const changeView = (v: "month" | "agenda") => {
    setView(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* not remembered */
    }
  };
  const toggleKind = (k: CalendarKind) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  let content: React.ReactNode;
  if (isLoading) {
    content = effectiveView === "month" ? <Skeleton className="h-[640px] w-full rounded-xl" /> : <Skeleton className="h-80 w-full rounded-xl" />;
  } else if (error) {
    content = (
      <ErrorState
        title="Couldn't load the calendar"
        error={error}
        onRetry={() => {
          tasksQ.refetch();
          dealsQ.refetch();
          activitiesQ.refetch();
        }}
      />
    );
  } else if (effectiveView === "agenda") {
    content =
      monthDaysWithItems.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={`Nothing scheduled in ${format(month, "MMMM")}`}
          description="Tasks with due dates, deal close dates and logged activities appear here."
          action={
            <Button variant="outline" onClick={() => createOn(isSameMonth(new Date(), month) ? new Date() : month)}>
              <Plus className="h-4 w-4" aria-hidden /> Add task
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {monthDaysWithItems.map((d) => {
            const key = dayKey(d);
            return (
              <section key={key} aria-labelledby={`agenda-${key}`} className="rounded-xl border bg-card">
                <header className="flex items-center justify-between border-b px-3 py-2">
                  <h2 id={`agenda-${key}`} className={cn("text-sm font-semibold", isToday(d) && "text-primary")}>
                    {isToday(d) ? "Today · " : ""}
                    {format(d, "EEEE, MMM d")}
                  </h2>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => createOn(d)} aria-label={`Add task on ${format(d, "MMMM d")}`}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </header>
                <ul className="p-1">
                  {(byDay.get(key) ?? []).map((item) => (
                    <li key={`${item.kind}-${item.id}`}>
                      <ItemLink item={item} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      );
  } else {
    content = (
      <div className="overflow-hidden rounded-xl border bg-card" role="region" aria-label={`${format(month, "MMMM yyyy")} calendar`}>
        <div className="grid grid-cols-7 border-b" aria-hidden>
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = dayKey(day);
            const dayItems = byDay.get(key) ?? [];
            const inMonth = isSameMonth(day, month);
            const extra = dayItems.length - MAX_IN_CELL;
            return (
              <div
                key={key}
                className={cn(
                  "group relative min-h-[112px] cursor-pointer border-b border-r p-1.5 transition-colors hover:bg-muted/30 [&:nth-child(7n)]:border-r-0",
                  !inMonth && "bg-muted/20",
                )}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("a,button")) return;
                  createOn(day);
                }}
              >
                <div className="mb-1 flex items-center justify-between">
                  <time
                    dateTime={key}
                    className={cn(
                      "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-medium tabular-nums",
                      isToday(day) ? "bg-primary text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground/60",
                    )}
                  >
                    {format(day, "d")}
                  </time>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-md opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                        onClick={() => createOn(day)}
                        aria-label={`Add task on ${format(day, "MMMM d")}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Add task</TooltipContent>
                  </Tooltip>
                </div>
                <ul className="space-y-0.5">
                  {dayItems.slice(0, MAX_IN_CELL).map((item) => (
                    <li key={`${item.kind}-${item.id}`}>
                      <ItemLink item={item} compact />
                    </li>
                  ))}
                </ul>
                {extra > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="mt-0.5 rounded px-1 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        +{extra} more
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-2" align="start">
                      <p className="px-2 pb-1 text-sm font-semibold">{format(day, "EEEE, MMM d")}</p>
                      <ul>
                        {dayItems.map((item) => (
                          <li key={`${item.kind}-${item.id}`}>
                            <ItemLink item={item} />
                          </li>
                        ))}
                      </ul>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageBanner title="Calendar" description="Tasks due, deals closing and activity logged, by day.">
        <div className="flex flex-wrap items-center gap-2">
          {!isMobile && (
            <ToggleGroup type="single" value={view} onValueChange={(v) => v && changeView(v as "month" | "agenda")} variant="outline" aria-label="Calendar view">
              <ToggleGroupItem value="month" aria-label="Month view" className="h-10 gap-1.5 px-3 text-sm">
                <CalendarRange className="h-4 w-4" aria-hidden /> Month
              </ToggleGroupItem>
              <ToggleGroupItem value="agenda" aria-label="Agenda view" className="h-10 gap-1.5 px-3 text-sm">
                <List className="h-4 w-4" aria-hidden /> Agenda
              </ToggleGroupItem>
            </ToggleGroup>
          )}
          <Button onClick={() => createOn(isSameMonth(new Date(), month) ? new Date() : month)}>
            <Plus className="h-4 w-4" aria-hidden /> New task
          </Button>
        </div>
      </PageBanner>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-9" onClick={() => setMonth(startOfMonth(new Date()))} disabled={isSameMonth(month, new Date())}>
            Today
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setMonth((m) => subMonths(m, 1))} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="ml-1 text-base font-semibold tabular-nums" aria-live="polite">
            {format(month, "MMMM yyyy")}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Show or hide item types">
          {(Object.keys(CALENDAR_KIND_META) as CalendarKind[]).map((k) => (
            <Toggle
              key={k}
              size="sm"
              variant="outline"
              pressed={!hidden.has(k)}
              onPressedChange={() => toggleKind(k)}
              className="h-8 gap-1.5 px-2.5 text-xs data-[state=off]:text-muted-foreground data-[state=off]:opacity-60"
              aria-label={`${hidden.has(k) ? "Show" : "Hide"} ${CALENDAR_KIND_META[k].legend.toLowerCase()}`}
            >
              <span className={cn("h-2 w-2 rounded-full", CALENDAR_KIND_META[k].dot)} aria-hidden />
              {CALENDAR_KIND_META[k].legend}
            </Toggle>
          ))}
        </div>
      </div>

      {content}
    </div>
  );
}
