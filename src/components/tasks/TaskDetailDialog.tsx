import { useState, useEffect } from "react";
import { Task, useUpdateTask, useDeleteTask } from "@/hooks/useTasks";
import { useContacts } from "@/hooks/useContacts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Pencil, X, Save, Trash2, Calendar, Clock, LinkIcon } from "lucide-react";
import { format, parseISO } from "date-fns";

interface TaskDetailDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const priorityColors: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  low: "bg-muted text-muted-foreground border-border",
};

export function TaskDetailDialog({ task, open, onOpenChange }: TaskDetailDialogProps) {
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { toast } = useToast();
  const { data: contacts } = useContacts();
  const { data: deals } = useQuery({
    queryKey: ["all-deals-for-picker"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deals").select("id, title").order("title");
      if (error) throw error;
      return data;
    },
  });

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editPriority, setEditPriority] = useState("medium");
  const [editDealId, setEditDealId] = useState("");
  const [editContactId, setEditContactId] = useState("");

  useEffect(() => {
    if (task && editing) {
      setEditTitle(task.title);
      setEditDescription(task.description || "");
      setEditDueDate(task.due_date ? task.due_date.slice(0, 16) : "");
      setEditPriority(task.priority);
      setEditDealId(task.deal_id || "none");
      setEditContactId(task.contact_id || "none");
    }
  }, [task, editing]);

  if (!task) return null;

  const handleSave = () => {
    updateTask.mutate(
      {
        id: task.id,
        title: editTitle,
        description: editDescription || null,
        due_date: editDueDate || null,
        priority: editPriority,
        deal_id: editDealId && editDealId !== "none" ? editDealId : null,
        contact_id: editContactId && editContactId !== "none" ? editContactId : null,
      },
      {
        onSuccess: () => {
          toast({ title: "Task updated" });
          setEditing(false);
          onOpenChange(false);
        },
      }
    );
  };

  const handleDelete = () => {
    deleteTask.mutate(task.id, {
      onSuccess: () => {
        toast({ title: "Task deleted" });
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setEditing(false); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md p-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b px-6 py-3">
          <DialogTitle className="text-lg font-semibold truncate">{task.title}</DialogTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setEditing(!editing)} title={editing ? "Cancel editing" : "Edit"}>
              {editing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="px-6 pb-6 pt-4 space-y-4">
          {editing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} maxLength={2000} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Due date</Label>
                  <Input type="datetime-local" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={editPriority} onValueChange={setEditPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Link to deal</Label>
                <Select value={editDealId} onValueChange={setEditDealId}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {deals?.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Link to contact</Label>
                <Select value={editContactId} onValueChange={setEditContactId}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {contacts?.map((c) => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={updateTask.isPending}>
                  <Save className="h-4 w-4 mr-1" /> Save
                </Button>
                <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant={task.completed ? "secondary" : "default"}>
                  {task.completed ? "Completed" : "To do"}
                </Badge>
                <Badge variant="outline" className={priorityColors[task.priority] || ""}>
                  {task.priority} priority
                </Badge>
              </div>

              {task.description && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>
              )}

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Due:</span>
                  <span>{task.due_date ? format(parseISO(task.due_date), "MMM d, yyyy 'at' h:mm a") : "—"}</span>
                </div>
                {task.deals && (
                  <div className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Deal:</span>
                    <span>{task.deals.title}</span>
                  </div>
                )}
                {task.contacts && (
                  <div className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Contact:</span>
                    <span>{task.contacts.first_name} {task.contacts.last_name}</span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Created {format(new Date(task.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Updated {format(new Date(task.updated_at), "MMM d, yyyy 'at' h:mm a")}</span>
                </div>
              </div>

              <Separator />

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-1" /> Delete task
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete task?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently delete "{task.title}" and cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
