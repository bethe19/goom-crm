import { Controller, type UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContactPicker, DealPicker, MemberPicker } from "@/components/pipeline/pickers";
import type { TaskFormValues } from "./taskUtils";

interface TaskFormFieldsProps {
  form: UseFormReturn<TaskFormValues>;
  idPrefix: string;
  autoFocus?: boolean;
  dealLabel?: string | null;
  contactLabel?: string | null;
}

/** Shared fields for creating and editing a task (react-hook-form + zod). */
export function TaskFormFields({ form, idPrefix, autoFocus, dealLabel, contactLabel }: TaskFormFieldsProps) {
  const { register, control, formState } = form;
  const { errors } = formState;
  const id = (s: string) => `${idPrefix}-${s}`;

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={id("title")}>
          Title <span className="text-destructive" aria-hidden>*</span>
        </Label>
        <Input id={id("title")} autoFocus={autoFocus} placeholder="e.g. Send pricing to Ada" aria-invalid={!!errors.title} {...register("title")} />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id("description")}>Description</Label>
        <Textarea id={id("description")} rows={3} placeholder="Optional" aria-invalid={!!errors.description} {...register("description")} />
        {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={id("due-date")}>Due date</Label>
          <Input id={id("due-date")} type="date" {...register("due_date")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("due-time")}>Time</Label>
          <Input id={id("due-time")} type="time" {...register("due_time")} disabled={!form.watch("due_date")} />
        </div>
        <div className="col-span-2 space-y-1.5 sm:col-span-1">
          <Label htmlFor={id("priority")}>Priority</Label>
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={id("priority")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={id("assignee")}>Assignee</Label>
        <Controller control={control} name="assigned_to" render={({ field }) => <MemberPicker id={id("assignee")} value={field.value} onChange={(v) => field.onChange(v)} />} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={id("deal")}>Deal</Label>
          <Controller
            control={control}
            name="deal_id"
            render={({ field }) => <DealPicker id={id("deal")} value={field.value} onChange={(v) => field.onChange(v)} selectedLabel={dealLabel} />}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("contact")}>Contact</Label>
          <Controller
            control={control}
            name="contact_id"
            render={({ field }) => <ContactPicker id={id("contact")} value={field.value} onChange={(v) => field.onChange(v)} allowCreate={false} selectedLabel={contactLabel} />}
          />
        </div>
      </div>
    </>
  );
}
