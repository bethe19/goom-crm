import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Mail, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useCreateEmailTemplate,
  useDeleteEmailTemplate,
  useEmailTemplates,
  useUpdateEmailTemplate,
  type EmailTemplate,
} from "@/hooks/useEmailTemplates";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FieldError, SettingsSection } from "./shared";
import { errorMessage } from "./validation";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Keep it under 80 characters"),
  subject: z.string().trim().min(1, "Subject is required").max(200, "Keep it under 200 characters"),
  body: z.string().trim().min(1, "Body is required").max(10_000, "Keep it under 10,000 characters"),
});
type Values = z.infer<typeof schema>;

export function EmailTemplateSettings() {
  const templates = useEmailTemplates();
  const remove = useDeleteEmailTemplate();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<{ template: EmailTemplate | null } | null>(null);

  const deleteTemplate = async (t: EmailTemplate) => {
    const ok = await confirm({ title: `Delete "${t.name}"?`, description: "This can't be undone.", confirmLabel: "Delete template" });
    if (!ok) return;
    try {
      await remove.mutateAsync(t.id);
      toast.success("Template deleted");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const newButton = (
    <Button onClick={() => setEditing({ template: null })} className="gap-1.5">
      <Plus className="h-4 w-4" /> New template
    </Button>
  );

  return (
    <SettingsSection
      title="Email templates"
      description="Reusable emails you can insert when logging an email activity. Only you can see your templates."
    >
      {templates.isLoading ? (
        <ListSkeleton rows={3} />
      ) : templates.isError ? (
        <ErrorState compact error={templates.error} title="Couldn't load templates" onRetry={() => templates.refetch()} />
      ) : !templates.data?.length ? (
        <EmptyState
          compact
          icon={Mail}
          title="No templates yet"
          description="Save the follow-ups and intros you send most often."
          action={newButton}
        />
      ) : (
        <div className="space-y-4">
          <ul className="divide-y divide-border rounded-lg border border-border">
            {templates.data.map((t) => (
              <li key={t.id} className="flex items-center gap-3 p-3">
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setEditing({ template: t })}
                >
                  <p className="truncate text-sm font-medium">{t.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.subject}</p>
                </button>
                <div className="flex shrink-0 items-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${t.name}`} onClick={() => setEditing({ template: t })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        aria-label={`Delete ${t.name}`}
                        disabled={remove.isPending && remove.variables === t.id}
                        onClick={() => deleteTemplate(t)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                </div>
              </li>
            ))}
          </ul>
          {newButton}
        </div>
      )}

      {editing && <TemplateDialog template={editing.template} onClose={() => setEditing(null)} />}
    </SettingsSection>
  );
}

function TemplateDialog({ template, onClose }: { template: EmailTemplate | null; onClose: () => void }) {
  const { user } = useAuth();
  const create = useCreateEmailTemplate();
  const update = useUpdateEmailTemplate();
  const confirm = useConfirm();
  const { register, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: template?.name ?? "", subject: template?.subject ?? "", body: template?.body ?? "" },
  });
  // Read during render so react-hook-form tracks it.
  const { isDirty, isSubmitting } = formState;

  // Escape, an outside click or the close button: don't silently throw away edits.
  const requestClose = async () => {
    if (isSubmitting) return;
    if (isDirty) {
      const ok = await confirm({
        title: "Discard changes?",
        description: "Your edits to this template haven't been saved.",
        confirmLabel: "Discard",
        cancelLabel: "Keep editing",
      });
      if (!ok) return;
    }
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (template) {
        await update.mutateAsync({ id: template.id, name: values.name, subject: values.subject, body: values.body });
        toast.success("Template saved");
      } else {
        if (!user) throw new Error("Not signed in");
        await create.mutateAsync({ user_id: user.id, name: values.name, subject: values.subject, body: values.body });
        toast.success("Template created");
      }
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) void requestClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{template ? "Edit template" : "New template"}</DialogTitle>
            <DialogDescription>Keep it short — you can personalize it before sending.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">
              Name <span className="text-destructive" aria-hidden>*</span>
            </Label>
            <Input id="tpl-name" autoFocus placeholder="e.g. Follow-up after demo" aria-invalid={!!formState.errors.name} {...register("name")} />
            <FieldError message={formState.errors.name?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-subject">
              Subject <span className="text-destructive" aria-hidden>*</span>
            </Label>
            <Input id="tpl-subject" aria-invalid={!!formState.errors.subject} {...register("subject")} />
            <FieldError message={formState.errors.subject?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-body">
              Body <span className="text-destructive" aria-hidden>*</span>
            </Label>
            <Textarea id="tpl-body" rows={8} aria-invalid={!!formState.errors.body} {...register("body")} />
            <FieldError message={formState.errors.body?.message} />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={formState.isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={formState.isSubmitting}>
              {formState.isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : template ? (
                "Save template"
              ) : (
                "Create template"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
