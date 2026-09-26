import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FileText, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ACTIVITY_TYPES, useCreateActivity, type Activity, type ActivityType } from "@/hooks/useActivities";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/components/settings/validation";
import { ContactPicker, DealPicker } from "@/components/pipeline/pickers";
import { TemplatePickerDialog } from "./TemplatePickerDialog";
import { ACTIVITY_META } from "./activityUtils";

interface LogActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDealId?: string;
  defaultContactId?: string;
  defaultType?: ActivityType;
  onLogged?: (activity: Activity) => void;
}

const schema = z.object({
  type: z.enum(["call", "email", "meeting", "note"]),
  title: z.string().trim().min(1, "Add a short summary").max(200, "Keep it under 200 characters"),
  description: z.string().max(10000, "Keep it under 10,000 characters").optional(),
  deal_id: z.string().nullable(),
  contact_id: z.string().nullable(),
});
type FormValues = z.infer<typeof schema>;

const TITLE_PLACEHOLDER: Record<ActivityType, string> = {
  call: "e.g. Discovery call with Ada",
  email: "e.g. Sent proposal",
  meeting: "e.g. Onsite demo",
  note: "e.g. Budget confirmed for Q4",
};

export function LogActivityDialog({ open, onOpenChange, defaultDealId, defaultContactId, defaultType = "note", onLogged }: LogActivityDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const createActivity = useCreateActivity();
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  const defaults = (): FormValues => ({
    type: defaultType,
    title: "",
    description: "",
    deal_id: defaultDealId ?? null,
    contact_id: defaultContactId ?? null,
  });
  const { register, handleSubmit, control, reset, setValue, watch, formState } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults() });
  const { errors } = formState;
  const type = watch("type");

  useEffect(() => {
    if (open) reset(defaults());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultDealId, defaultContactId, defaultType]);

  const onSubmit = (values: FormValues) => {
    createActivity.mutate(
      {
        user_id: user?.id,
        type: values.type,
        title: values.title.trim(),
        description: values.description?.trim() || null,
        deal_id: values.deal_id,
        contact_id: values.contact_id,
      },
      {
        onSuccess: (activity) => {
          toast({ title: `${ACTIVITY_META[values.type].label} logged`, variant: "success" });
          onOpenChange(false);
          onLogged?.(activity);
        },
        onError: (err) => toast({ title: "Couldn't log activity", description: errorMessage(err), variant: "destructive" }),
      },
    );
  };

  const pending = createActivity.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Log activity</DialogTitle>
            <DialogDescription>Record a call, email, meeting or note.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label id="activity-type-label">Type</Label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <ToggleGroup
                    type="single"
                    value={field.value}
                    onValueChange={(v) => v && field.onChange(v)}
                    className="grid grid-cols-4 gap-1.5"
                    aria-labelledby="activity-type-label"
                  >
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
              <div className="flex items-center justify-between">
                <Label htmlFor="activity-title">
                  Summary <span className="text-destructive" aria-hidden>*</span>
                </Label>
                <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => setTemplatePickerOpen(true)}>
                  <FileText className="h-3.5 w-3.5" aria-hidden /> Use template
                </Button>
              </div>
              <Input id="activity-title" autoFocus placeholder={TITLE_PLACEHOLDER[type]} aria-invalid={!!errors.title} {...register("title")} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="activity-description">Details</Label>
              <Textarea id="activity-description" rows={4} placeholder="Optional. Markdown supported." aria-invalid={!!errors.description} {...register("description")} />
              {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="activity-deal">Deal</Label>
                <Controller control={control} name="deal_id" render={({ field }) => <DealPicker id="activity-deal" value={field.value} onChange={(v) => field.onChange(v)} />} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="activity-contact">Contact</Label>
                <Controller
                  control={control}
                  name="contact_id"
                  render={({ field }) => <ContactPicker id="activity-contact" value={field.value} onChange={(v) => field.onChange(v)} allowCreate={false} />}
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Logging…
                  </>
                ) : (
                  "Log activity"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <TemplatePickerDialog
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        onSelect={(template) => {
          setValue("title", template.subject, { shouldValidate: true, shouldDirty: true });
          setValue("description", template.body, { shouldDirty: true });
          setValue("type", "email");
        }}
      />
    </>
  );
}
