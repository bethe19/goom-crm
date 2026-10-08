import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, CheckSquare, Loader2, Plus, Search, SearchX, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTask, useTaskList, useTodayTasks, type Task, type TaskView } from "@/hooks/useTasks";
import { useDebounce } from "@/hooks/useDebounce";
import { useToast } from "@/hooks/use-toast";
import { PageBanner } from "@/components/PageBanner";
import { RepScopeNotice } from "@/components/settings/AccessNotice";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { TaskItem } from "@/components/tasks/TaskItem";
import { QuickAddTask } from "@/components/tasks/QuickAddTask";
import { groupTasks } from "@/components/tasks/taskUtils";
import { cn } from "@/lib/utils";

const GROUP_STYLES: Record<string, string> = {
  overdue: "text-destructive",
  today: "text-foreground",
  upcoming: "text-muted-foreground",
  nodate: "text-muted-foreground",
};

export default function Tasks() {
  const { can } = useAuth();
  const seesAll = can("records.view_all");
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [view, setView] = useState<TaskView>("mine");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [priority, setPriority] = useState("");
  const filtersActive = !!(search.trim() || priority);
  const clearFilters = () => {
    setSearch("");
    setPriority("");
  };

  const listParams = { view, completedMineOnly: !seesAll, search: debouncedSearch, priority };
  const list = useTaskList(listParams);
  // Today's tasks load separately (the paginated list leaves them out) so a long overdue backlog can't hide them.
  const todayQuery = useTodayTasks(listParams, { enabled: view !== "completed" });
  const todayRows = useMemo(() => (view === "completed" ? [] : todayQuery.data ?? []), [todayQuery.data, view]);
  const rows = useMemo(() => {
    const listRows = list.data?.pages.flatMap((p) => p.rows) ?? [];
    if (todayRows.length === 0) return listRows;
    const ids = new Set(todayRows.map((t) => t.id));
    return [...todayRows, ...listRows.filter((t) => !ids.has(t.id))];
  }, [list.data, todayRows]);
  const total = (list.data?.pages[0]?.count ?? 0) + todayRows.length;
  // Today first, then Overdue / Upcoming / No date.
  const groups = useMemo(
    () => (view === "completed" ? [] : groupTasks(rows).sort((a, b) => Number(b.key === "today") - Number(a.key === "today"))),
    [rows, view],
  );
  const loading = list.isLoading || (view !== "completed" && todayQuery.isLoading);
  const loadError = list.error ?? (view !== "completed" ? todayQuery.error : null);
  const refetchAll = () => {
    list.refetch();
    if (view !== "completed") todayQuery.refetch();
  };

  // Dialogs & URL params (?new=1[&due=yyyy-MM-dd], ?open=<id>).
  const [createOpen, setCreateOpen] = useState(false);
  const [createDue, setCreateDue] = useState<string | undefined>();
  const [openId, setOpenId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const fromList = rows.find((t) => t.id === openId) ?? null;
  const openQuery = useTask(openId);
  const openTask: Task | null = openQuery.data ?? fromList;

  useEffect(() => {
    const id = searchParams.get("open");
    const isNew = searchParams.get("new");
    if (!id && !isNew) return;
    if (id) {
      setOpenId(id);
      setHighlightId(id);
    }
    if (isNew) {
      const due = searchParams.get("due");
      setCreateDue(due && /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : undefined);
      setCreateOpen(true);
    }
    const next = new URLSearchParams(searchParams);
    next.delete("open");
    next.delete("new");
    next.delete("due");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (openId && openQuery.isSuccess && openQuery.data === null) {
      toast({ title: "Task not found", description: "It may have been deleted.", variant: "warning" });
      setOpenId(null);
    }
  }, [openId, openQuery.isSuccess, openQuery.data, toast]);

  useEffect(() => {
    if (!highlightId) return;
    document.getElementById(`task-${highlightId}`)?.scrollIntoView({ block: "center" });
    const t = setTimeout(() => setHighlightId(null), 4000);
    return () => clearTimeout(t);
  }, [highlightId, rows.length]);

  const renderTask = (t: Task) => (
    <li key={t.id}>
      <TaskItem task={t} onClick={() => setOpenId(t.id)} highlighted={highlightId === t.id} showAssignee={view !== "mine"} />
    </li>
  );

  let content: React.ReactNode;
  if (loading) {
    content = <ListSkeleton rows={6} />;
  } else if (loadError) {
    content = <ErrorState title="Couldn't load tasks" error={loadError} onRetry={refetchAll} />;
  } else if (rows.length === 0 && filtersActive) {
    content = (
      <EmptyState
        icon={SearchX}
        title="No tasks match your filters"
        description="Try a different search or priority."
        action={
          <Button variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        }
      />
    );
  } else if (rows.length === 0) {
    content =
      view === "completed" ? (
        <EmptyState icon={CheckCircle2} title="Nothing completed yet" description="Tasks you finish show up here." />
      ) : (
        <EmptyState
          icon={CheckSquare}
          title={view === "mine" ? "You're all caught up" : "No open tasks"}
          description="Add a task above, or create one with a due date and assignee."
          action={
            <Button variant="outline" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden /> New task
            </Button>
          }
        />
      );
  } else {
    content = (
      <div className="space-y-6">
        {view === "completed" ? (
          <ul className="space-y-2">{rows.map(renderTask)}</ul>
        ) : (
          groups.map((g) => (
            <section key={g.key} aria-labelledby={`group-${g.key}`}>
              <h2 id={`group-${g.key}`} className={cn("mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide", GROUP_STYLES[g.key])}>
                {g.label}
                <span className="rounded-full bg-secondary px-1.5 font-medium tabular-nums text-muted-foreground">{g.tasks.length}</span>
              </h2>
              <ul className="space-y-2">{g.tasks.map(renderTask)}</ul>
            </section>
          ))
        )}
        <div className="flex flex-col items-center gap-2 pt-2 text-xs text-muted-foreground">
          <span className="tabular-nums">
            Showing {rows.length} of {total}
          </span>
          {list.hasNextPage && (
            <Button variant="outline" size="sm" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>
              {list.isFetchingNextPage ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
                </>
              ) : (
                "Load more"
              )}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageBanner
        title="Tasks"
        description={seesAll ? "Your to-dos and follow-ups, by due date." : "Your tasks: ones you created or that are assigned to you."}
      >
        <Button
          onClick={() => {
            setCreateDue(undefined);
            setCreateOpen(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden /> New task
        </Button>
      </PageBanner>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={view} onValueChange={(v) => setView(v as TaskView)}>
          <TabsList>
            <TabsTrigger value="mine">My tasks</TabsTrigger>
            {seesAll && <TabsTrigger value="all">All open</TabsTrigger>}
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-2" role="search" aria-label="Filter tasks">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks…" className="h-9 pl-9 text-sm" aria-label="Search tasks" />
          </div>
          <Select value={priority || "all"} onValueChange={(v) => setPriority(v === "all" ? "" : v)}>
            <SelectTrigger className="h-9 w-[140px] text-sm" aria-label="Priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any priority</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          {filtersActive && (
            <Button variant="ghost" size="sm" className="h-9 gap-1 px-3" onClick={clearFilters}>
              <X className="h-4 w-4" aria-hidden /> Clear filters
            </Button>
          )}
        </div>
      </div>

      {!seesAll && <RepScopeNotice scope="tasks" className="-mt-3" />}

      {view !== "completed" && <QuickAddTask />}

      {content}

      <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} defaultDueDate={createDue} />
      <TaskDetailDialog task={openTask} open={!!openId && !!openTask} onOpenChange={(o) => !o && setOpenId(null)} />
    </div>
  );
}
