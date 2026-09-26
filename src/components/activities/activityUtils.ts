import { format, isSameDay, parseISO, subDays } from "date-fns";
import { CalendarDays, FileText, Mail, Phone, type LucideIcon } from "lucide-react";
import type { ActivityType } from "@/hooks/useActivities";

export interface ActivityMeta {
  label: string;
  plural: string;
  icon: LucideIcon;
  /** Icon chip classes (tinted, readable in both themes). */
  chip: string;
}

export const ACTIVITY_META: Record<ActivityType, ActivityMeta> = {
  call: { label: "Call", plural: "Calls", icon: Phone, chip: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  email: { label: "Email", plural: "Emails", icon: Mail, chip: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
  meeting: { label: "Meeting", plural: "Meetings", icon: CalendarDays, chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  note: { label: "Note", plural: "Notes", icon: FileText, chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
};

export function activityMeta(type: string): ActivityMeta {
  return ACTIVITY_META[type as ActivityType] ?? ACTIVITY_META.note;
}

export interface DayGroup<T> {
  /** yyyy-MM-dd in local time. */
  key: string;
  label: string;
  items: T[];
}

/** "Today", "Yesterday", "Monday, Sep 21" (current year) or "Sep 21, 2025". */
export function dayLabel(date: Date, now: Date = new Date()): string {
  if (isSameDay(date, now)) return "Today";
  if (isSameDay(date, subDays(now, 1))) return "Yesterday";
  return format(date, date.getFullYear() === now.getFullYear() ? "EEEE, MMM d" : "MMM d, yyyy");
}

/** Groups items by local calendar day, preserving input order (feeds are already sorted). */
export function groupByDay<T>(items: T[], getDate: (item: T) => string, now: Date = new Date()): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  const index = new Map<string, DayGroup<T>>();
  for (const item of items) {
    const d = parseISO(getDate(item));
    if (Number.isNaN(d.getTime())) continue;
    const key = format(d, "yyyy-MM-dd");
    let g = index.get(key);
    if (!g) {
      g = { key, label: dayLabel(d, now), items: [] };
      index.set(key, g);
      groups.push(g);
    }
    g.items.push(item);
  }
  return groups;
}
