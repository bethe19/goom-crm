import { eachDayOfInterval, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from "date-fns";

export type CalendarKind = "task" | "deal" | "activity";

export interface CalendarItem {
  id: string;
  kind: CalendarKind;
  title: string;
  /** Local date-time of the item. Date-only values (deal close dates) are local midnight. */
  date: Date;
  /** Whether `date` carries a meaningful time of day. */
  timed: boolean;
  href: string;
  completed?: boolean;
  /** e.g. activity type or task priority. */
  detail?: string;
}

export const CALENDAR_KIND_META: Record<CalendarKind, { label: string; legend: string; dot: string; chip: string }> = {
  task: { label: "Task", legend: "Tasks due", dot: "bg-amber-500", chip: "bg-amber-500/10 text-amber-800 dark:text-amber-200" },
  deal: { label: "Deal closing", legend: "Deals closing", dot: "bg-emerald-500", chip: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200" },
  activity: { label: "Activity", legend: "Activities", dot: "bg-sky-500", chip: "bg-sky-500/10 text-sky-800 dark:text-sky-200" },
};

const KIND_ORDER: Record<CalendarKind, number> = { deal: 0, task: 1, activity: 2 };

/** Full weeks (Mon–Sun by default) covering `month`. */
export function monthGrid(month: Date, weekStartsOn: 0 | 1 = 1): Date[] {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn }),
  });
}

export function dayKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Parses "yyyy-MM-dd" as a local date and full timestamps as instants. */
export function parseCalendarDate(value: string): { date: Date; timed: boolean } {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return { date: parseISO(value), timed: false };
  const date = parseISO(value);
  return { date, timed: date.getHours() !== 0 || date.getMinutes() !== 0 };
}

/** Buckets items by local day; within a day: deals, then tasks, then activities, each by time. */
export function bucketByDay(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const map = new Map<string, CalendarItem[]>();
  for (const item of items) {
    if (Number.isNaN(item.date.getTime())) continue;
    const key = dayKey(item.date);
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  for (const list of map.values()) {
    list.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.date.getTime() - b.date.getTime() || a.title.localeCompare(b.title));
  }
  return map;
}
