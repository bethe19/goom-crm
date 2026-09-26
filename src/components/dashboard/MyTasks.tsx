import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfDay, format, isBefore, startOfDay } from "date-fns";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/common/States";
import { sanitizeErrorMessage } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import { SectionCard } from "./ChartParts";

interface DueTask {
  id: string;
  title: string;
  due_date: string;
  priority: string | null;
  deals: { id: string; title: string } | null;
  contacts: { id: string; first_name: string; last_name: string | null } | null;
}

const LIMIT = 6;

/** The signed-in user's open tasks that are due today or overdue, with one-click complete. */
export function MyTasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const uid = user?.id;
  const day = format(new Date(), "yyyy-MM-dd");
  const queryKey = ["analytics", "my-due-tasks", uid, day];

  const query = useQuery({
    queryKey,
    enabled: !!uid,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("tasks")
        .select("id, title, due_date, priority, deals(id, title), contacts(id, first_name, last_name)", { count: "exact" })
        .eq("completed", false)
        .lte("due_date", endOfDay(new Date()).toISOString())
        // uid is the session's user id (a UUID), never user input.
        .or(`assigned_to.eq.${uid},and(assigned_to.is.null,user_id.eq.${uid})`)
        .order("due_date", { ascending: true })
        .limit(LIMIT);
      if (error) throw error;
      return { tasks: (data ?? []) as DueTask[], total: count ?? 0 };
    },
  });

  const setCompleted = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from("tasks").update({ completed }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<{ tasks: DueTask[]; total: number }>(queryKey);
      if (previous && completed) {
        queryClient.setQueryData(queryKey, {
          tasks: previous.tasks.filter((t) => t.id !== id),
          total: Math.max(0, previous.total - 1),
        });
      }
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
      toast({ title: "Couldn't update the task", description: sanitizeErrorMessage((err as Error)?.message), variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["analytics", "my-due-tasks"] });
    },
  });

  const complete = (task: DueTask) => {
    setCompleted.mutate(
      { id: task.id, completed: true },
      {
        onSuccess: () =>
          toast({
            title: "Task completed",
            description: task.title,
            variant: "success",
            action: { label: "Undo", onClick: () => setCompleted.mutate({ id: task.id, completed: false }) },
          }),
      },
    );
  };

  const today = startOfDay(new Date());
  const data = query.data;

  return (
    <SectionCard
      title="My tasks"
      description={
        data && data.total > 0 ? `${data.total} due today or overdue` : "Due today or overdue"
      }
      action={
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground">
          <Link to="/tasks">
            All tasks <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </Button>
      }
      bodyClassName="px-2 sm:px-3"
    >
      {query.isLoading ? (
        <div className="space-y-2 px-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState compact error={query.error} onRetry={() => query.refetch()} title="Couldn't load tasks" />
      ) : !data || data.tasks.length === 0 ? (
        <EmptyState
          compact
          icon={CheckCircle2}
          title="You're all caught up"
          description="No tasks due today or overdue."
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/tasks?new=1">New task</Link>
            </Button>
          }
        />
      ) : (
        <ul>
          {data.tasks.map((t) => {
            const due = new Date(t.due_date);
            const overdue = isBefore(due, today);
            const related = t.deals?.title ?? (t.contacts ? `${t.contacts.first_name} ${t.contacts.last_name ?? ""}`.trim() : null);
            return (
              <li key={t.id} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-secondary/60">
                <Checkbox
                  id={`dash-task-${t.id}`}
                  className="mt-0.5"
                  onCheckedChange={(v) => v === true && complete(t)}
                  aria-label={`Mark "${t.title}" as done`}
                />
                <label htmlFor={`dash-task-${t.id}`} className="min-w-0 flex-1 cursor-pointer">
                  <span className="block truncate text-sm text-foreground">{t.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    <span className={cn(overdue && "font-medium text-red-700 dark:text-red-400")}>
                      {overdue ? `Overdue · ${format(due, "MMM d")}` : "Today"}
                    </span>
                    {related ? ` · ${related}` : ""}
                  </span>
                </label>
              </li>
            );
          })}
          {data.total > data.tasks.length && (
            <li className="px-2 pt-1">
              <Link to="/tasks" className="text-xs font-medium text-muted-foreground hover:text-foreground">
                View {data.total - data.tasks.length} more
              </Link>
            </li>
          )}
        </ul>
      )}
    </SectionCard>
  );
}
