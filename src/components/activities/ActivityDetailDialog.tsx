import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Loader2, Trash2 } from "lucide-react";
import { ACTIVITY_TYPES, useDeleteActivity, useUpdateActivity, type Activity } from "@/hooks/useActivities";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useRecordPermissions } from "@/hooks/useRecordPermissions";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/components/settings/validation";
import { ContactPicker, DealPicker } from "@/components/pipeline/pickers";
import { memberName, useWorkspaceMembers } from "@/components/pipeline/useWorkspaceMembers";
import { ACTIVITY_META } from "./activityUtils";

interface ActivityDetailDialogProps {
  activity: Activity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const schema = z.object({
  type: z.enum(["call", "email", "meeting", "note"]),
  title: z.string().trim().min(1, "Add a short summary").max(200, "Keep it under 200 characters"),
  description: z.string().max(10000, "Keep it under 10,000 characters"),
  deal_id: z.string().nullable(),
  contact_id: z.string().nullable(),
});
type FormValues = z.infer<typeof schema>;

/** View and edit a single activity; delete is confirmed. */
export function ActivityDetailDialog({ activity, open, onOpenChange }: ActivityDetailDialogProps) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const updateActivity = useUpdateActivity();
  const deleteActivity = useDeleteActivity();
  const { canDelete } = useRecordPermissions();
  const { byId } = useWorkspaceMembers();

  const { register, handleSubmit, control, reset, formState } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const { errors, isDirty } = formState;

  useEffect(() => {
    if (activity && open) {
      reset({
        type: activity.type,
        title: activity.title,
        description: activity.description ?? "",
        deal_id: activity.deal_id,
        contact_id: activity.contact_id,
      });
    }
  }, [activity, open, reset]);

  if (!activity) return null;
  const author = activity.user_id ? byId.get(activity.user_id) : undefined;

  const onSubmit = (values: FormValues) => {
    updateActivity.mutate(
      { id: activity.id, ...values, title: values.title.trim(), description: values.description.trim() || null },
      {
        onSuccess: () => {
          toast({ title: "Activity updated", variant: "success" });
          onOpenChange(false);
        },
        onError: (err) => toast({ title: "Couldn't save activity", description: errorMessage(err), variant: "destructive" }),
      },
    );
  };

  const handleDelete = async () => {
    if (!(await confirm({ title: "Delete this activity?", description: `“${activity.title}” will be permanently deleted.`, confirmLabel: "Delete" }))) return;
    deleteActivity.mutate(activity.id, {
      onSuccess: () => {
        toast({ title: "Activity deleted", variant: "success" });
        onOpenChange(false);
      },
      onError: (err) => toast({ title: "Couldn't delete activity", description: errorMessage(err), variant: "destructive" }),
    });
  };

  const pending = updateActivity.isPending || deleteActivity.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit activity</DialogTitle>
          <DialogDescription>
            Logged {format(new Date(activity.created_at), "MMM d, yyyy 'at' h:mm a")}
            {author ? ` by ${memberName(author)}` : ""}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label id="edit-activity-type">Type</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <ToggleGroup type="single" value={field.value} onValueChange={(v) => v && field.onChange(v)} className="grid grid-cols-4 gap-1.5" aria-labelledby="edit-activity-type">
                  {ACTIVITY_TYPES.map((t) => {
                    const M = ACTIVITY_META[t];
                    return (
                      <ToggleGroupItem key={t} value={t} variant="outline" className="h-9 gap-1.5 px-2 text-xs sm:text-sm" aria-label={M.label}>
                        <M.icon className="h-4 w-4" aria-hidden />
                        <span className="hidden sm:inline">{M.label}</span>
                      </ToggleGroupItem>
                    );
                  })}
                </ToggleGroup>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-activity-title">
              Summary <span className="text-destructive" aria-hidden>*</span>
            </Label>
            <Input id="edit-activity-title" autoFocus aria-invalid={!!errors.title} {...register("title")} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Details</Label>
            <Controller control={control} name="description" render={({ field }) => <RichTextEditor value={field.value ?? ""} onChange={field.onChange} rows={5} />} />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-activity-deal">Deal</Label>
              <Controller
                control={control}
                name="deal_id"
                render={({ field }) => <DealPicker id="edit-activity-deal" value={field.value} onChange={(v) => field.onChange(v)} selectedLabel={field.value === activity.deal_id ? activity.deals?.title : undefined} />}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-activity-contact">Contact</Label>
              <Controller
                control={control}
                name="contact_id"
                render={({ field }) => (
                  <ContactPicker
                    id="edit-activity-contact"
                    value={field.value}
                    onChange={(v) => field.onChange(v)}
                    allowCreate={false}
                    selectedLabel={field.value === activity.contact_id && activity.contacts ? `${activity.contacts.first_name} ${activity.contacts.last_name}` : undefined}
                  />
                )}
              />
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
            {canDelete({ user_id: activity.user_id }) ? (
              <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={handleDelete} disabled={pending}>
                {deleteActivity.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !isDirty}>
                {updateActivity.isPending ? (
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
