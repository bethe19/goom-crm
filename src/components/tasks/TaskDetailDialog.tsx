import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CheckCircle2, Circle, Loader2, Trash2 } from "lucide-react";
import { useDeleteTask, useToggleTask, useUpdateTask, type Task } from "@/hooks/useTasks";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/components/settings/validation";
import { memberName, useWorkspaceMembers } from "@/components/pipeline/useWorkspaceMembers";
import { TaskFormFields } from "./TaskFormFields";
import { dueDateToIso, isoToDueInputs, taskFormSchema, type TaskFormValues } from "./taskUtils";

interface TaskDetailDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toForm(task: Task): TaskFormValues {
  const { date, time } = isoToDueInputs(task.due_date);
  return {
    title: task.title,
    description: task.description ?? "",
    due_date: date,
    due_time: time,
    priority: (["high", "medium", "low"].includes(task.priority) ? task.priority : "medium") as TaskFormValues["priority"],
    assigned_to: task.assigned_to ?? task.user_id ?? null,
    deal_id: task.deal_id,
    contact_id: task.contact_id,
  };
}

/** Edit a task: all fields, complete/reopen, delete (confirmed). */
export function TaskDetailDialog({ task, open, onOpenChange }: TaskDetailDialogProps) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const toggle = useToggleTask();
  const { byId } = useWorkspaceMembers();
  const form = useForm<TaskFormValues>({ resolver: zodResolver(taskFormSchema) });

  useEffect(() => {
    if (task && open) form.reset(toForm(task));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, open]);

  if (!task) return null;
  const creator = task.user_id ? byId.get(task.user_id) : undefined;

  const onSubmit = (v: TaskFormValues) => {
    updateTask.mutate(
      {
        id: task.id,
        title: v.title.trim(),
        description: v.description.trim() || null,
        due_date: dueDateToIso(v.due_date, v.due_time),
        priority: v.priority,
        assigned_to: v.assigned_to,
        deal_id: v.deal_id,
        contact_id: v.contact_id,
      },
      {
        onSuccess: () => {
          toast({ title: "Task updated", variant: "success" });
          onOpenChange(false);
        },
        onError: (err) => toast({ title: "Couldn't save task", description: errorMessage(err), variant: "destructive" }),
      },
    );
  };

  const handleToggle = () => {
    const completed = !task.completed;
    toggle.mutate(
      { id: task.id, completed },
      {
        onSuccess: () => {
          toast({
            title: completed ? "Task completed" : "Task reopened",
            description: task.title,
            action: { label: "Undo", onClick: () => toggle.mutate({ id: task.id, completed: !completed }) },
          });
          if (completed) onOpenChange(false);
        },
        onError: (err) => toast({ title: "Couldn't update task", description: errorMessage(err), variant: "destructive" }),
      },
    );
  };

  const handleDelete = async () => {
    if (!(await confirm({ title: "Delete this task?", description: `“${task.title}” will be permanently deleted.`, confirmLabel: "Delete" }))) return;
    deleteTask.mutate(task.id, {
      onSuccess: () => {
        toast({ title: "Task deleted", variant: "success" });
        onOpenChange(false);
      },
      onError: (err) => toast({ title: "Couldn't delete task", description: errorMessage(err), variant: "destructive" }),
    });
  };

  const pending = updateTask.isPending || deleteTask.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
          <DialogDescription>
            Created {format(new Date(task.created_at), "MMM d, yyyy")}
            {creator ? ` by ${memberName(creator)}` : ""} · Updated {format(new Date(task.updated_at), "MMM d, yyyy")}
          </DialogDescription>
        </DialogHeader>
        <Button type="button" variant="outline" size="sm" className="w-fit gap-1.5" onClick={handleToggle} disabled={toggle.isPending}>
          {task.completed ? <Circle className="h-4 w-4" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
          {task.completed ? "Mark as not done" : "Mark as done"}
        </Button>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <TaskFormFields
            form={form}
            idPrefix={`task-${task.id}`}
            dealLabel={task.deals?.title}
            contactLabel={task.contacts ? `${task.contacts.first_name} ${task.contacts.last_name}` : null}
          />
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={handleDelete} disabled={pending}>
              {deleteTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
              Delete
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !form.formState.isDirty}>
                {updateTask.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
