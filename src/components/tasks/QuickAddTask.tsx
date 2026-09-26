import { useRef, useState } from "react";
import { CornerDownLeft, Loader2, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateTask } from "@/hooks/useTasks";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/components/settings/validation";
import { cn } from "@/lib/utils";
import { parseQuickTask } from "./taskUtils";

interface QuickAddTaskProps {
  dealId?: string;
  contactId?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Inline "add a task" input: Enter creates a task assigned to me.
 * Shortcuts: end with "today"/"tomorrow" for a due date, "!high" / "!low" for priority.
 */
export function QuickAddTask({ dealId, contactId, placeholder = "Add a task… (try “Call Ada tomorrow !high”)", className }: QuickAddTaskProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const createTask = useCreateTask();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const raw = text.trim();
    if (!raw || createTask.isPending) return;
    const parsed = parseQuickTask(raw);
    const title = parsed.title || raw;
    createTask.mutate(
      {
        user_id: user?.id,
        assigned_to: user?.id ?? null,
        title,
        due_date: parsed.due_date,
        priority: parsed.priority,
        deal_id: dealId ?? null,
        contact_id: contactId ?? null,
      },
      {
        onSuccess: () => {
          setText("");
          toast({ title: "Task added", description: title, variant: "success" });
          inputRef.current?.focus();
        },
        onError: (err) => toast({ title: "Couldn't add task", description: errorMessage(err), variant: "destructive" }),
      },
    );
  };

  return (
    <div className={cn("relative", className)}>
      <label htmlFor={`quick-task-${dealId ?? contactId ?? "page"}`} className="sr-only">
        Add a task
      </label>
      {createTask.isPending ? (
        <Loader2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
      ) : (
        <Plus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      )}
      <Input
        ref={inputRef}
        id={`quick-task-${dealId ?? contactId ?? "page"}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        maxLength={200}
        disabled={createTask.isPending}
        className="h-10 pl-9 pr-10 text-sm"
        aria-describedby={`quick-task-hint-${dealId ?? contactId ?? "page"}`}
      />
      <CornerDownLeft className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" aria-hidden />
      <span id={`quick-task-hint-${dealId ?? contactId ?? "page"}`} className="sr-only">
        Press Enter to add. End with today or tomorrow to set a due date; add !high or !low to set priority.
      </span>
    </div>
  );
}
