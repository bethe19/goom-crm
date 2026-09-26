import { z } from "zod";
import { addDays, format, isBefore, isSameDay, parseISO, startOfDay } from "date-fns";
import type { Task, TaskPriority } from "@/hooks/useTasks";
import { formatFriendlyDate } from "@/lib/formatters";

export type TaskGroupKey = "overdue" | "today" | "upcoming" | "nodate";

export const TASK_GROUP_LABELS: Record<TaskGroupKey, string> = {
  overdue: "Overdue",
  today: "Today",
  upcoming: "Upcoming",
  nodate: "No date",
};

export interface TaskGroup<T> {
  key: TaskGroupKey;
  label: string;
  tasks: T[];
}

/** Day-level bucket for a due date relative to `now` (tasks due earlier today are "today", not overdue). */
export function taskBucket(dueDate: string | null | undefined, now: Date = new Date()): TaskGroupKey {
  if (!dueDate) return "nodate";
  const due = parseISO(dueDate);
  if (Number.isNaN(due.getTime())) return "nodate";
  if (isSameDay(due, now)) return "today";
  if (isBefore(due, startOfDay(now))) return "overdue";
  return "upcoming";
}

/**
 * Groups open tasks into Overdue / Today / Upcoming / No date (empty groups omitted),
 * each sorted by due date ascending, keeping input order for ties.
 */
export function groupTasks<T extends Pick<Task, "due_date">>(tasks: T[], now: Date = new Date()): TaskGroup<T>[] {
  const buckets: Record<TaskGroupKey, T[]> = { overdue: [], today: [], upcoming: [], nodate: [] };
  for (const t of tasks) buckets[taskBucket(t.due_date, now)].push(t);
  const byDue = (a: T, b: T) => (a.due_date && b.due_date ? parseISO(a.due_date).getTime() - parseISO(b.due_date).getTime() : 0);
  return (Object.keys(buckets) as TaskGroupKey[])
    .filter((k) => buckets[k].length > 0)
    .map((k) => ({ key: k, label: TASK_GROUP_LABELS[k], tasks: k === "nodate" ? buckets[k] : [...buckets[k]].sort(byDue) }));
}

export function isTaskOverdue(task: Pick<Task, "due_date" | "completed">, now: Date = new Date()): boolean {
  return !task.completed && taskBucket(task.due_date, now) === "overdue";
}

/** True when a stored due date carries a meaningful time (not local midnight). */
export function hasDueTime(dueDate: string): boolean {
  const d = parseISO(dueDate);
  return d.getHours() !== 0 || d.getMinutes() !== 0;
}

/** Converts a date input ("yyyy-MM-dd") + optional time ("HH:mm") in local time to an ISO timestamp. */
export function dueDateToIso(date: string, time?: string | null): string | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return null;
  const [hh, mm] = (time || "00:00").split(":").map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0).toISOString();
}

/** Splits a stored ISO due date into local date / time input values. */
export function isoToDueInputs(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  return { date: format(d, "yyyy-MM-dd"), time: hasDueTime(iso) ? format(d, "HH:mm") : "" };
}

export interface QuickTask {
  title: string;
  due_date: string | null;
  priority: TaskPriority;
}

/**
 * Parses quick-add text with light, predictable shortcuts:
 * a trailing/leading "today" or "tomorrow" sets the due date; "!high" / "!low" (or "!!") sets priority.
 */
export function parseQuickTask(text: string, now: Date = new Date()): QuickTask {
  let title = ` ${text.trim()} `;
  let priority: TaskPriority = "medium";
  let due: Date | null = null;

  const prio = title.match(/\s!(high|low|medium|!)(?=\s)/i);
  if (prio) {
    const p = prio[1].toLowerCase();
    priority = p === "!" ? "high" : (p as TaskPriority);
    title = title.replace(prio[0], " ");
  }
  const when = title.match(/\s(today|tomorrow)(?=\s*$)/i) ?? title.match(/^\s(today|tomorrow)(?=\s)/i);
  if (when) {
    due = startOfDay(when[1].toLowerCase() === "tomorrow" ? addDays(now, 1) : now);
    title = title.replace(when[0], " ");
  }
  title = title.replace(/\s+/g, " ").trim();
  return { title, due_date: due ? due.toISOString() : null, priority };
}

export const PRIORITY_LABELS: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };

/** "Today", "Tomorrow, 3:00 PM", "Mar 4" … (time only when one was set). */
export function formatDue(due: string): string {
  const d = parseISO(due);
  return hasDueTime(due) ? `${formatFriendlyDate(d)}, ${format(d, "h:mm a")}` : formatFriendlyDate(d);
}

export const taskFormSchema = z.object({
  title: z.string().trim().min(1, "Give the task a title").max(200, "Keep it under 200 characters"),
  description: z.string().max(5000, "Keep it under 5,000 characters"),
  due_date: z.string(),
  due_time: z.string(),
  priority: z.enum(["high", "medium", "low"]),
  assigned_to: z.string().nullable(),
  deal_id: z.string().nullable(),
  contact_id: z.string().nullable(),
});
export type TaskFormValues = z.infer<typeof taskFormSchema>;
