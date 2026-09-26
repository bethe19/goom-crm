import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateTask, type Task } from "@/hooks/useTasks";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/components/settings/validation";
import { TaskFormFields } from "./TaskFormFields";
import { dueDateToIso, taskFormSchema, type TaskFormValues } from "./taskUtils";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDealId?: string;
  defaultContactId?: string;
  /** Prefill the due date (yyyy-MM-dd), e.g. from the calendar. */
  defaultDueDate?: string;
  defaultAssigneeId?: string | null;
  onCreated?: (task: Task) => void;
}

export function CreateTaskDialog({ open, onOpenChange, defaultDealId, defaultContactId, defaultDueDate, defaultAssigneeId, onCreated }: CreateTaskDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const createTask = useCreateTask();

  const defaults = (): TaskFormValues => ({
    title: "",
    description: "",
    due_date: defaultDueDate ?? "",
    due_time: "",
    priority: "medium",
    assigned_to: defaultAssigneeId ?? user?.id ?? null,
    deal_id: defaultDealId ?? null,
    contact_id: defaultContactId ?? null,
  });
  const form = useForm<TaskFormValues>({ resolver: zodResolver(taskFormSchema), defaultValues: defaults() });

  useEffect(() => {
    if (open) form.reset(defaults());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultDealId, defaultContactId, defaultDueDate, defaultAssigneeId]);

  const onSubmit = (v: TaskFormValues) => {
    createTask.mutate(
      {
        user_id: user?.id,
        assigned_to: v.assigned_to,
        title: v.title.trim(),
        description: v.description.trim() || null,
        due_date: dueDateToIso(v.due_date, v.due_time),
        priority: v.priority,
        deal_id: v.deal_id,
        contact_id: v.contact_id,
      },
      {
        onSuccess: (task) => {
          toast({ title: "Task created", description: task.title, variant: "success" });
          onOpenChange(false);
          onCreated?.(task);
        },
        onError: (err) => toast({ title: "Couldn't create task", description: errorMessage(err), variant: "destructive" }),
      },
    );
  };

  const pending = createTask.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>Assign a to-do and link it to a deal or contact.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <TaskFormFields form={form} idPrefix="new-task" autoFocus />
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Creating…
                </>
              ) : (
                "Create task"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
