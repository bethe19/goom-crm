import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateDeal, type Deal } from "@/hooks/useDeals";
import { defaultProbabilityForStage, usePipelines, usePipelineStages, type PipelineStage } from "@/hooks/usePipelineStages";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/components/settings/validation";
import { CompanyPicker, ContactPicker, MemberPicker } from "./pickers";

interface CreateDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pipeline to create the deal in (falls back to the workspace's first pipeline). */
  pipelineId?: string;
  /** Stages of that pipeline; fetched when omitted or empty. */
  stages?: PipelineStage[];
  defaultStageId?: string;
  defaultCompanyId?: string | null;
  defaultContactId?: string | null;
  onCreated?: (deal: Deal) => void;
}

const numberString = (msg: string, max?: number) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0 && (max === undefined || Number(v) <= max)), msg);

const schema = z.object({
  title: z.string().trim().min(1, "Give the deal a name").max(200, "Keep it under 200 characters"),
  stage_id: z.string().min(1, "Choose a stage"),
  value: numberString("Enter an amount of 0 or more"),
  probability: numberString("Enter a number from 0 to 100", 100),
  close_date: z.string().optional(),
  company_id: z.string().nullable(),
  contact_id: z.string().nullable(),
  owner_id: z.string().nullable(),
  notes: z.string().max(5000, "Keep notes under 5,000 characters").optional(),
});

type FormValues = z.infer<typeof schema>;

export function CreateDealDialog({
  open,
  onOpenChange,
  pipelineId,
  stages: stagesProp,
  defaultStageId,
  defaultCompanyId,
  defaultContactId,
  onCreated,
}: CreateDealDialogProps) {
  const { user, organization, can } = useAuth();
  const canReassign = can("deals.reassign");
  const { toast } = useToast();
  const createDeal = useCreateDeal();
  const { data: pipelines } = usePipelines({ enabled: open && !pipelineId });
  const effectivePipelineId = pipelineId || pipelines?.[0]?.id;
  const needStages = !stagesProp?.length || stagesProp[0]?.pipeline_id !== effectivePipelineId;
  const { data: fetchedStages, isLoading: stagesLoading } = usePipelineStages(open && needStages ? effectivePipelineId : undefined);
  const stages = useMemo(() => (needStages ? fetchedStages ?? [] : stagesProp ?? []), [needStages, fetchedStages, stagesProp]);

  const defaults = (stageId: string | undefined): FormValues => {
    const stage = stages.find((s) => s.id === stageId) ?? stages[0];
    return {
      title: "",
      stage_id: stage?.id ?? "",
      value: "",
      probability: String(defaultProbabilityForStage(stage)),
      close_date: "",
      company_id: defaultCompanyId ?? null,
      contact_id: defaultContactId ?? null,
      owner_id: user?.id ?? null,
      notes: "",
    };
  };

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults(defaultStageId) });
  const { register, handleSubmit, control, reset, setValue, formState } = form;
  const { errors, dirtyFields } = formState;

  // Reset whenever the dialog opens (or stages arrive while open).
  useEffect(() => {
    if (open) reset(defaults(defaultStageId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultStageId, stages.length]);

  const onSubmit = (values: FormValues) => {
    if (!effectivePipelineId) {
      toast({ title: "No pipeline yet", description: "Create a pipeline in Settings first.", variant: "destructive" });
      return;
    }
    createDeal.mutate(
      {
        title: values.title.trim(),
        pipeline_id: effectivePipelineId,
        stage_id: values.stage_id,
        owner_id: values.owner_id ?? null,
        created_by: user?.id,
        company_id: values.company_id,
        contact_id: values.contact_id,
        value: values.value === "" ? 0 : Number(values.value),
        probability: values.probability === "" ? 0 : Math.round(Number(values.probability)),
        close_date: values.close_date || null,
        notes: values.notes?.trim() || null,
      },
      {
        onSuccess: (deal) => {
          toast({ title: "Deal created", description: deal.title, variant: "success" });
          onOpenChange(false);
          onCreated?.(deal);
        },
        onError: (err) => {
          toast({ title: "Couldn't create deal", description: errorMessage(err), variant: "destructive" });
        },
      },
    );
  };

  const pending = createDeal.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New deal</DialogTitle>
          <DialogDescription>Track an opportunity through your pipeline.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="deal-title">
              Deal name <span className="text-destructive" aria-hidden>*</span>
            </Label>
            <Input id="deal-title" autoFocus placeholder="e.g. Annual plan — Northwind" aria-invalid={!!errors.title} aria-describedby={errors.title ? "deal-title-error" : undefined} {...register("title")} />
            {errors.title && <p id="deal-title-error" className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="deal-stage">
                Stage <span className="text-destructive" aria-hidden>*</span>
              </Label>
              <Controller
                control={control}
                name="stage_id"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      if (!dirtyFields.probability) {
                        setValue("probability", String(defaultProbabilityForStage(stages.find((s) => s.id === v))));
                      }
                    }}
                    disabled={stagesLoading && !stages.length}
                  >
                    <SelectTrigger id="deal-stage" aria-invalid={!!errors.stage_id}>
                      <SelectValue placeholder={stagesLoading ? "Loading…" : "Choose a stage"} />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                            {s.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.stage_id && <p className="text-xs text-destructive">{errors.stage_id.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deal-value">Value ({organization?.currency ?? "USD"})</Label>
              <Input id="deal-value" type="number" inputMode="decimal" min={0} step="any" placeholder="0" className="tabular-nums" aria-invalid={!!errors.value} {...register("value")} />
              {errors.value && <p className="text-xs text-destructive">{errors.value.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="deal-company">Company</Label>
              <Controller
                control={control}
                name="company_id"
                render={({ field }) => <CompanyPicker id="deal-company" value={field.value} onChange={(v) => field.onChange(v)} />}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deal-contact">Contact</Label>
              <Controller
                control={control}
                name="contact_id"
                render={({ field }) => (
                  <ContactPicker id="deal-contact" value={field.value} onChange={(v) => field.onChange(v)} companyId={form.watch("company_id")} />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="deal-owner">Owner</Label>
              <Controller
                control={control}
                name="owner_id"
                render={({ field }) => (
                  <MemberPicker
                    id="deal-owner"
                    value={field.value}
                    disabled={!canReassign}
                    selectedLabel={!canReassign && field.value === user?.id ? "You" : undefined}
                    onChange={(v) => field.onChange(v)}
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deal-probability">Probability (%)</Label>
              <Input id="deal-probability" type="number" inputMode="numeric" min={0} max={100} className="tabular-nums" aria-invalid={!!errors.probability} {...register("probability")} />
              {errors.probability && <p className="text-xs text-destructive">{errors.probability.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deal-close-date">Close date</Label>
              <Input id="deal-close-date" type="date" {...register("close_date")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="deal-notes">Notes</Label>
            <Textarea id="deal-notes" rows={3} placeholder="Context, next steps… (Markdown supported)" aria-invalid={!!errors.notes} {...register("notes")} />
            {errors.notes && <p className="text-xs text-destructive">{errors.notes.message}</p>}
          </div>

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
                "Create deal"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
