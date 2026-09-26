import { Link } from "react-router-dom";
import { CalendarDays, Briefcase, MoreHorizontal, Pencil, Trash2, UserRound } from "lucide-react";
import { taskAssignee, useDeleteTask, useToggleTask, type Task } from "@/hooks/useTasks";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/components/settings/validation";
import { cn } from "@/lib/utils";
import { MemberAvatar } from "@/components/pipeline/MemberAvatar";
import { useWorkspaceMembers } from "@/components/pipeline/useWorkspaceMembers";
import { formatDue, isTaskOverdue, PRIORITY_LABELS } from "./taskUtils";

interface TaskItemProps {
  task: Task;
  onClick?: () => void;
  showAssignee?: boolean;
  hideDeal?: boolean;
  hideContact?: boolean;
  highlighted?: boolean;
  className?: string;
}

const PRIORITY_STYLES: Record<string, string> = {
  high: "border-destructive/30 bg-destructive/10 text-destructive",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  low: "border-border bg-muted text-muted-foreground",
};

export function TaskItem({ task, onClick, showAssignee = true, hideDeal, hideContact, highlighted, className }: TaskItemProps) {
  const toggle = useToggleTask();
  const deleteTask = useDeleteTask();
  const confirm = useConfirm();
  const { toast } = useToast();
  const { byId } = useWorkspaceMembers();
  const assigneeId = taskAssignee(task);
  const assignee = assigneeId ? byId.get(assigneeId) : undefined;
  const overdue = isTaskOverdue(task);

  const setCompleted = (completed: boolean, withUndo = true) => {
    toggle.mutate(
      { id: task.id, completed },
      {
        onSuccess: () => {
          if (!withUndo) return;
          toast({
            title: completed ? "Task completed" : "Task reopened",
            description: task.title,
            action: { label: "Undo", onClick: () => setCompleted(!completed, false) },
          });
        },
        onError: (err) => toast({ title: "Couldn't update task", description: errorMessage(err), variant: "destructive" }),
      },
    );
  };

  const handleDelete = async () => {
    if (!(await confirm({ title: "Delete this task?", description: `“${task.title}” will be permanently deleted.`, confirmLabel: "Delete" }))) return;
    deleteTask.mutate(task.id, {
      onSuccess: () => toast({ title: "Task deleted", variant: "success" }),
      onError: (err) => toast({ title: "Couldn't delete task", description: errorMessage(err), variant: "destructive" }),
    });
  };

  const checkboxId = `task-done-${task.id}`;

  return (
    <div
      id={`task-${task.id}`}
      className={cn(
        "group relative flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors duration-150 hover:bg-muted/40",
        highlighted && "ring-2 ring-ring ring-offset-2 ring-offset-background",
        deleteTask.isPending && "opacity-50",
        className,
      )}
    >
      <Checkbox
        id={checkboxId}
        checked={task.completed}
        onCheckedChange={(checked) => setCompleted(!!checked)}
        className="relative z-10 mt-0.5 h-[18px] w-[18px] rounded-full"
        aria-label={task.completed ? `Mark “${task.title}” as not done` : `Mark “${task.title}” as done`}
      />
      <div className="min-w-0 flex-1">
        {onClick ? (
          <button
            type="button"
            onClick={onClick}
            className={cn(
              "text-left text-sm font-medium after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring",
              task.completed && "text-muted-foreground line-through",
            )}
          >
            {task.title}
          </button>
        ) : (
          <p className={cn("text-sm font-medium", task.completed && "text-muted-foreground line-through")}>{task.title}</p>
        )}
        {task.description && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{task.description}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className={cn("rounded-full border px-1.5 py-px text-[11px] font-medium", PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.low)}>
            {PRIORITY_LABELS[task.priority] ?? task.priority}
            <span className="sr-only"> priority</span>
          </span>
          {task.due_date && (
            <span className={cn("inline-flex items-center gap-1 tabular-nums", overdue && "font-medium text-destructive")}>
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">Due</span>
              {formatDue(task.due_date)}
              {overdue && <span className="sr-only"> (overdue)</span>}
            </span>
          )}
          {!hideDeal && task.deals && (
            <Link to={`/pipeline?open=${task.deals.id}`} className="relative z-10 inline-flex max-w-[180px] items-center gap-1 truncate hover:text-foreground hover:underline">
              <Briefcase className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{task.deals.title}</span>
            </Link>
          )}
          {!hideContact && task.contacts && (
            <Link to={`/contacts?open=${task.contacts.id}`} className="relative z-10 inline-flex max-w-[180px] items-center gap-1 truncate hover:text-foreground hover:underline">
              <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">
                {task.contacts.first_name} {task.contacts.last_name}
              </span>
            </Link>
          )}
        </div>
      </div>
      {showAssignee && <MemberAvatar member={assignee} label="Assignee" className="relative z-10 mt-0.5" />}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative z-10 -my-0.5 h-7 w-7 shrink-0 rounded-md text-muted-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 data-[state=open]:opacity-100"
            aria-label={`Actions for ${task.title}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onClick && (
            <DropdownMenuItem onSelect={onClick}>
              <Pencil className="mr-2 h-4 w-4" aria-hidden /> Edit
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setCompleted(!task.completed)}>{task.completed ? "Mark as not done" : "Mark as done"}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" aria-hidden /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
