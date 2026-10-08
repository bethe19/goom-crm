import { useQuery, useMutation, useQueryClient, useInfiniteQuery, type QueryClient } from "@tanstack/react-query";
import { addDays, format, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { assertAffected } from "@/components/settings/validation";
import { useAuth } from "@/contexts/AuthContext";
import { ilikeAny, PAGE_SIZE } from "@/lib/postgrest";
import { fetchAllRows } from "@/lib/fetchAll";
import type { TablesInsert } from "@/integrations/supabase/types";

export type TaskPriority = "low" | "medium" | "high";
export const TASK_PRIORITIES: TaskPriority[] = ["high", "medium", "low"];

export interface Task {
  id: string;
  /** Creator. */
  user_id: string | null;
  /** Assignee; null means "the creator". */
  assigned_to?: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  deal_id: string | null;
  contact_id: string | null;
  priority: string;
  created_at: string;
  updated_at: string;
  deals?: { id: string; title: string } | null;
  contacts?: { id: string; first_name: string; last_name: string } | null;
}

export const TASK_SELECT = "*, deals(id, title), contacts(id, first_name, last_name)";

/** Effective assignee of a task (assigned_to, falling back to the creator). */
export function taskAssignee(task: Pick<Task, "assigned_to" | "user_id">): string | null {
  return task.assigned_to ?? task.user_id ?? null;
}

/** PostgREST filter for "tasks that are mine": assigned to me, or created by me and unassigned. */
function mineFilter(userId: string) {
  // userId is a UUID from the auth session (not user input), so it is safe in the filter string.
  return `assigned_to.eq.${userId},and(assigned_to.is.null,user_id.eq.${userId})`;
}

export function invalidateTaskQueries(queryClient: QueryClient) {
  for (const key of ["tasks", "task", "calendar", "dashboard", "analytics", "notifications"]) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
}

export interface TaskFilters {
  completed?: boolean;
  deal_id?: string;
  contact_id?: string;
  /** Only tasks assigned to this user (or created by them and unassigned). */
  assigned_to?: string;
  limit?: number;
  enabled?: boolean;
}

/** Simple (non-paginated) task list, e.g. the tasks on a deal or contact. */
export function useTasks(filters?: TaskFilters) {
  const { user } = useAuth();
  const { enabled = true, ...keyFilters } = filters ?? {};
  return useQuery({
    queryKey: ["tasks", keyFilters],
    queryFn: async (): Promise<Task[]> => {
      let q = supabase
        .from("tasks")
        .select(TASK_SELECT)
        .order("completed", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (keyFilters.completed !== undefined) q = q.eq("completed", keyFilters.completed);
      if (keyFilters.deal_id) q = q.eq("deal_id", keyFilters.deal_id);
      if (keyFilters.contact_id) q = q.eq("contact_id", keyFilters.contact_id);
      if (keyFilters.assigned_to) q = q.or(mineFilter(keyFilters.assigned_to));
      q = q.limit(keyFilters.limit ?? 500);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Task[];
    },
    enabled: !!user && enabled,
  });
}

export type TaskView = "mine" | "all" | "completed";

export interface TaskListParams {
  view: TaskView;
  /** For the "completed" view: only my tasks (true for reps). */
  completedMineOnly?: boolean;
  search?: string;
  priority?: string;
}

export interface TaskPage {
  rows: Task[];
  count: number;
  from: number;
}

/** Local-day window [start, end) for "today", plus a day key so cached queries roll over at midnight. */
function todayWindow(now: Date = new Date()) {
  const start = startOfDay(now);
  return { day: format(start, "yyyy-MM-dd"), start: start.toISOString(), end: addDays(start, 1).toISOString() };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any;

/** Applies the open-task view, priority and search filters shared by the Tasks page queries. */
function applyOpenTaskFilters(q: AnyQuery, params: TaskListParams, userId: string | undefined): AnyQuery {
  q = q.eq("completed", false);
  if (params.view === "mine" && userId) q = q.or(mineFilter(userId));
  if (params.priority) q = q.eq("priority", params.priority);
  const f = ilikeAny(["title", "description"], params.search ?? "");
  // Each .or() is AND-ed with the others by PostgREST.
  if (f) q = q.or(f);
  return q;
}

/**
 * Paginated task list for the Tasks page. Open views leave out tasks due today: those come from
 * `useTodayTasks`, so a long overdue backlog can't push them past the first page.
 */
export function useTaskList(params: TaskListParams) {
  const { user } = useAuth();
  const userId = user?.id;
  const today = todayWindow();
  const day = params.view === "completed" ? null : today.day;
  return useInfiniteQuery({
    queryKey: ["tasks", "list", params, userId, day],
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<TaskPage> => {
      const from = pageParam as number;
      let q: AnyQuery = supabase.from("tasks").select(TASK_SELECT, { count: "exact" });
      if (params.view === "completed") {
        q = q.eq("completed", true).order("updated_at", { ascending: false });
        if (params.completedMineOnly && userId) q = q.or(mineFilter(userId));
        if (params.priority) q = q.eq("priority", params.priority);
        const f = ilikeAny(["title", "description"], params.search ?? "");
        if (f) q = q.or(f);
      } else {
        q = applyOpenTaskFilters(q, params, userId)
          // Timestamps are generated here (not user input); quoted because they contain "." and ":".
          .or(`due_date.is.null,due_date.lt."${today.start}",due_date.gte."${today.end}"`)
          .order("due_date", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false });
      }
      const { data, error, count } = await q.order("id", { ascending: true }).range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      return { rows: (data ?? []) as Task[], count: count ?? 0, from };
    },
    getNextPageParam: (last) => {
      const next = last.from + PAGE_SIZE;
      return next < last.count ? next : undefined;
    },
    enabled: !!userId,
  });
}

const TODAY_LIMIT = 200;

/** Open tasks due today (local time) for the Tasks page, matching `useTaskList`'s filters. */
export function useTodayTasks(params: TaskListParams, options?: { enabled?: boolean }) {
  const { user } = useAuth();
  const userId = user?.id;
  const today = todayWindow();
  return useQuery({
    queryKey: ["tasks", "today", params, userId, today.day],
    queryFn: async (): Promise<Task[]> => {
      const q: AnyQuery = applyOpenTaskFilters(supabase.from("tasks").select(TASK_SELECT), params, userId)
        .gte("due_date", today.start)
        .lt("due_date", today.end)
        .order("due_date", { ascending: true })
        .order("id", { ascending: true })
        .limit(TODAY_LIMIT);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Task[];
    },
    enabled: !!userId && (options?.enabled ?? true),
  });
}

export function useTask(id: string | null | undefined) {
  return useQuery({
    queryKey: ["task", id],
    queryFn: async (): Promise<Task | null> => {
      const { data, error } = await supabase.from("tasks").select(TASK_SELECT).eq("id", id).maybeSingle();
      if (error) throw error;
      return (data as Task) ?? null;
    },
    enabled: !!id,
  });
}

/** Tasks due within [fromIso, toIso] (for the calendar). */
export function useTasksDueBetween(fromIso: string, toIso: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["calendar", "tasks", fromIso, toIso],
    queryFn: async ({ signal }): Promise<Task[]> => {
      // Paged so a busy range isn't silently cut off at Supabase's 1,000-row response cap. The count
      // (first page only) lets paging stop without a final empty request.
      const rows = await fetchAllRows(
        (from, to) =>
          supabase
            .from("tasks")
            .select("id, title, due_date, completed, priority, user_id, assigned_to, deal_id, contact_id", from === 0 ? { count: "exact" } : undefined)
            .gte("due_date", fromIso)
            .lte("due_date", toIso)
            .order("due_date", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to)
            .abortSignal(signal),
        { signal },
      );
      return rows as Task[];
    },
    enabled: options?.enabled ?? true,
  });
}

export interface CreateTaskInput {
  /** Creator; defaults to the signed-in user on the server when omitted. */
  user_id?: string | null;
  assigned_to?: string | null;
  title: string;
  description?: string | null;
  due_date?: string | null;
  priority?: string;
  deal_id?: string | null;
  contact_id?: string | null;
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (task: CreateTaskInput): Promise<Task> => {
      const payload: TablesInsert<"tasks"> = { ...task };
      if (!payload.user_id) delete payload.user_id;
      if (payload.assigned_to === undefined) delete payload.assigned_to;
      const { data, error } = await supabase.from("tasks").insert(payload).select(TASK_SELECT).single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => invalidateTaskQueries(queryClient),
  });
}

export type TaskUpdate = { id: string } & Partial<Omit<Task, "id" | "deals" | "contacts" | "created_at" | "updated_at">> & {
  [key: string]: unknown;
};

/**
 * Saves task edits. Resolves to the updated task, or null when the caller can no longer see it
 * (e.g. a rep reassigned their task to a teammate).
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TaskUpdate): Promise<Task | null> => {
      // No RETURNING: a reassigned row can leave the caller's SELECT visibility, which would make
      // UPDATE … RETURNING fail and roll the change back. Count the affected row, then re-read.
      const { error, count } = await supabase.from("tasks").update(updates, { count: "exact" }).eq("id", id);
      if (error) throw error;
      assertAffected(count);
      const { data, error: readError } = await supabase.from("tasks").select(TASK_SELECT).eq("id", id).maybeSingle();
      if (readError) throw readError;
      return (data as Task | null) ?? null;
    },
    onSuccess: (task, { id }) => {
      if (task) queryClient.setQueryData(["task", id], task);
      else queryClient.removeQueries({ queryKey: ["task", id] });
      invalidateTaskQueries(queryClient);
    },
  });
}

function patchRow(row: unknown, id: string, patch: Partial<Task>): unknown {
  return row && typeof row === "object" && (row as { id?: unknown }).id === id ? { ...row, ...patch } : row;
}

/**
 * Applies `patch` to task `id` in any cached task shape: a list, infinite-query pages or a single
 * task. Anything else under the ["tasks"] key (e.g. the sidebar's overdue count) is returned as is.
 */
export function patchTaskCache(old: unknown, id: string, patch: Partial<Task>): unknown {
  if (!old || typeof old !== "object") return old;
  if (Array.isArray(old)) return old.map((row) => patchRow(row, id, patch));
  const pages = (old as { pages?: unknown }).pages;
  if (Array.isArray(pages)) {
    return {
      ...old,
      pages: pages.map((page) => {
        const rows = page && typeof page === "object" ? (page as { rows?: unknown }).rows : undefined;
        return Array.isArray(rows) ? { ...page, rows: rows.map((row) => patchRow(row, id, patch)) } : page;
      }),
    };
  }
  return patchRow(old, id, patch);
}

/** Complete / reopen a task with an optimistic update across every cached task list (rolled back on error). */
export function useToggleTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from("tasks").update({ completed }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      await queryClient.cancelQueries({ queryKey: ["task", id] });
      // Only object data can hold tasks; plain values (counts) are left alone and refreshed on settle.
      const snapshot = [
        ...queryClient.getQueriesData<unknown>({ queryKey: ["tasks"] }),
        ...queryClient.getQueriesData<unknown>({ queryKey: ["task", id] }),
      ].filter(([, data]) => data !== null && typeof data === "object");
      for (const [key, data] of snapshot) {
        const next = patchTaskCache(data, id, { completed });
        if (next !== data) queryClient.setQueryData(key, next);
      }
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => invalidateTaskQueries(queryClient),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error, count } = await supabase.from("tasks").delete({ count: "exact" }).eq("id", id);
      if (error) throw error;
      assertAffected(count);
    },
    onSuccess: (_d, id) => {
      queryClient.removeQueries({ queryKey: ["task", id] });
      invalidateTaskQueries(queryClient);
    },
  });
}
