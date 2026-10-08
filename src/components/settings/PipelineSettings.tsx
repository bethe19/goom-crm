import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, GripVertical, Kanban, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePipelines, usePipelineStages, type Pipeline, type PipelineStage } from "@/hooks/usePipelineStages";
import { invalidateDealQueries } from "@/hooks/useDeals";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { FieldError, SettingsSection } from "./shared";
import { errorMessage, moveItem } from "./validation";
import { LimitNotice } from "./UpgradePrompt";
import { usePlan } from "@/hooks/usePlan";

const STAGE_COLORS = ["#64748b", "#3b82f6", "#8b5cf6", "#06b6d4", "#f97316", "#eab308", "#10b981", "#ef4444", "#ec4899"];

const DEFAULT_STAGES = [
  { name: "Lead", color: "#64748b", probability: 10, is_won: false, is_lost: false },
  { name: "Qualified", color: "#3b82f6", probability: 25, is_won: false, is_lost: false },
  { name: "Proposal", color: "#8b5cf6", probability: 50, is_won: false, is_lost: false },
  { name: "Negotiation", color: "#f97316", probability: 75, is_won: false, is_lost: false },
  { name: "Won", color: "#10b981", probability: 100, is_won: true, is_lost: false },
  { name: "Lost", color: "#ef4444", probability: 0, is_won: false, is_lost: true },
];

async function countDeals(column: "stage_id" | "pipeline_id", id: string): Promise<number> {
  const { count, error } = await supabase.from("deals").select("id", { count: "exact", head: true }).eq(column, id);
  if (error) throw error;
  return count ?? 0;
}

export function PipelineSettings() {
  const { can } = useAuth();
  const canManage = can("pipelines.manage");
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const pipelinesQuery = usePipelines();
  const pipelines = pipelinesQuery.data ?? [];
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const pipeline = pipelines.find((p) => p.id === selectedId) ?? pipelines[0];
  const stagesQuery = usePipelineStages(pipeline?.id);
  const stages = stagesQuery.data ?? [];

  const [stageDialog, setStageDialog] = useState<{ stage: PipelineStage | null } | null>(null);
  const [pipelineDialog, setPipelineDialog] = useState<{ pipeline: Pipeline | null } | null>(null);
  const [reordering, setReordering] = useState(false);
  const [deletingStage, setDeletingStage] = useState<string | null>(null);
  const dragFrom = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["pipelines"] });
    queryClient.invalidateQueries({ queryKey: ["pipeline_stages"] });
    queryClient.invalidateQueries({ queryKey: ["workspace-usage"] });
    // A stage's won/lost flag or probability changes deal outcomes (synced server-side) and every
    // deal-derived number: board, forecast, dashboard, analytics (all covered by the helper).
    invalidateDealQueries(queryClient);
  };

  const reorder = async (from: number, to: number) => {
    if (!pipeline || from === to) return;
    const key = ["pipeline_stages", pipeline.id];
    const previous = queryClient.getQueryData<PipelineStage[]>(key);
    const next = moveItem(stages, from, to).map((s, i) => ({ ...s, position: i }));
    queryClient.setQueryData(key, next);
    setReordering(true);
    const { error } = await supabase.rpc("reorder_pipeline_stages", {
      p_stages: next.map(({ id, position }) => ({ id, position })),
    });
    setReordering(false);
    if (error) {
      queryClient.setQueryData(key, previous);
      toast.error(errorMessage(error));
    } else {
      invalidate();
    }
  };

  const deleteStage = async (stage: PipelineStage) => {
    setDeletingStage(stage.id);
    try {
      const deals = await countDeals("stage_id", stage.id);
      if (deals > 0) {
        toast.info(`"${stage.name}" still has ${deals} deal${deals === 1 ? "" : "s"}`, {
          description: "Move them to another stage on the pipeline board, then delete this stage.",
        });
        return;
      }
      if (stages.length <= 2) {
        toast.info("A pipeline needs at least two stages.");
        return;
      }
      const ok = await confirm({
        title: `Delete the "${stage.name}" stage?`,
        description: "It has no deals, so nothing else changes.",
        confirmLabel: "Delete stage",
      });
      if (!ok) return;
      const { error } = await supabase.from("pipeline_stages").delete().eq("id", stage.id);
      if (error) throw error;
      toast.success("Stage deleted");
      invalidate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeletingStage(null);
    }
  };

  const deletePipeline = async (p: Pipeline) => {
    if (pipelines.length <= 1) {
      toast.info("You need at least one pipeline. Create another one first.");
      return;
    }
    try {
      const deals = await countDeals("pipeline_id", p.id);
      if (deals > 0) {
        toast.info(`"${p.name}" still has ${deals} deal${deals === 1 ? "" : "s"}`, {
          description: "Move or delete those deals before deleting the pipeline.",
        });
        return;
      }
      const ok = await confirm({
        title: `Delete the "${p.name}" pipeline?`,
        description: "Its stages are deleted too. This can't be undone.",
        confirmLabel: "Delete pipeline",
      });
      if (!ok) return;
      const { error } = await supabase.from("pipelines").delete().eq("id", p.id);
      if (error) throw error;
      setSelectedId(undefined);
      toast.success("Pipeline deleted");
      invalidate();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (pipelinesQuery.isLoading) return <ListSkeleton rows={5} />;
  if (pipelinesQuery.isError) {
    return <ErrorState error={pipelinesQuery.error} title="Couldn't load pipelines" onRetry={() => pipelinesQuery.refetch()} />;
  }
  if (!pipeline) {
    return (
      <>
        <EmptyState
          icon={Kanban}
          title="No pipeline yet"
          description="Create a pipeline to start tracking deals through stages."
          action={canManage ? <Button onClick={() => setPipelineDialog({ pipeline: null })}>Create pipeline</Button> : undefined}
        />
        {pipelineDialog && (
          <PipelineDialog
            pipeline={pipelineDialog.pipeline}
            onClose={() => setPipelineDialog(null)}
            onSaved={(id) => {
              setSelectedId(id);
              invalidate();
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Pipelines"
        description={canManage ? "Most teams need one. Add another for a separate sales motion, like renewals or partnerships." : "Only admins and managers can change pipelines."}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={pipeline.id} onValueChange={setSelectedId}>
            <SelectTrigger className="sm:w-72" aria-label="Pipeline">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pipelines.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canManage && (
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Pipeline actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onSelect={() => setPipelineDialog({ pipeline })}>
                    <Pencil className="mr-2 h-4 w-4" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => deletePipeline(pipeline)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete pipeline
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" className="gap-1.5" onClick={() => setPipelineDialog({ pipeline: null })}>
                <Plus className="h-4 w-4" /> New pipeline
              </Button>
            </div>
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Stages"
        description={
          canManage
            ? "Drag or use the arrows to reorder. Won and Lost stages close a deal; probability weights the forecast."
            : "The stages deals move through, in order."
        }
      >
        {stagesQuery.isLoading ? (
          <ListSkeleton rows={5} />
        ) : stagesQuery.isError ? (
          <ErrorState compact error={stagesQuery.error} title="Couldn't load stages" onRetry={() => stagesQuery.refetch()} />
        ) : stages.length === 0 ? (
          <EmptyState
            compact
            icon={Kanban}
            title="No stages yet"
            description="Add the steps a deal goes through, from first contact to closed."
            action={canManage ? <Button onClick={() => setStageDialog({ stage: null })}>Add stage</Button> : undefined}
          />
        ) : (
          <ol className="space-y-1.5" aria-busy={reordering}>
            {stages.map((stage, index) => (
              <li
                key={stage.id}
                draggable={canManage && !reordering}
                onDragStart={(e) => {
                  dragFrom.current = index;
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (dragFrom.current === null) return;
                  e.preventDefault();
                  setDragOver(index);
                }}
                onDragLeave={() => setDragOver((d) => (d === index ? null : d))}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = dragFrom.current;
                  dragFrom.current = null;
                  setDragOver(null);
                  if (from !== null) void reorder(from, index);
                }}
                onDragEnd={() => {
                  dragFrom.current = null;
                  setDragOver(null);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-lg border bg-background px-2 py-2 transition-colors duration-150",
                  dragOver === index ? "border-foreground/40 bg-secondary/60" : "border-border",
                )}
              >
                {canManage && (
                  <GripVertical className="hidden h-4 w-4 shrink-0 cursor-grab text-muted-foreground sm:block" aria-hidden />
                )}
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} aria-hidden />
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="truncate text-sm font-medium">{stage.name}</span>
                  {stage.is_won && <Badge variant="secondary">Won</Badge>}
                  {stage.is_lost && <Badge variant="secondary">Lost</Badge>}
                  {stage.probability !== null && stage.probability !== undefined && (
                    <span className="text-xs tabular-nums text-muted-foreground">{stage.probability}%</span>
                  )}
                </div>
                {canManage && (
                  <div className="flex shrink-0 items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Move ${stage.name} up`}
                      disabled={index === 0 || reordering}
                      onClick={() => reorder(index, index - 1)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Move ${stage.name} down`}
                      disabled={index === stages.length - 1 || reordering}
                      onClick={() => reorder(index, index + 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label={`Edit ${stage.name}`}
                          onClick={() => setStageDialog({ stage })}
                        >
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
                          aria-label={`Delete ${stage.name}`}
                          disabled={deletingStage === stage.id}
                          onClick={() => deleteStage(stage)}
                        >
                          {deletingStage === stage.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
        {canManage && stages.length > 0 && (
          <Button variant="outline" className="mt-4 gap-1.5" onClick={() => setStageDialog({ stage: null })}>
            <Plus className="h-4 w-4" /> Add stage
          </Button>
        )}
      </SettingsSection>

      {stageDialog && (
        <StageDialog
          pipelineId={pipeline.id}
          stage={stageDialog.stage}
          nextPosition={stages.reduce((max, s) => Math.max(max, s.position), -1) + 1}
          onClose={() => setStageDialog(null)}
          onSaved={invalidate}
        />
      )}
      {pipelineDialog && (
        <PipelineDialog
          pipeline={pipelineDialog.pipeline}
          onClose={() => setPipelineDialog(null)}
          onSaved={(id) => {
            setSelectedId(id);
            invalidate();
          }}
        />
      )}
    </div>
  );
}

// ---- Stage dialog ------------------------------------------------------------------------------

const stageSchema = z.object({
  name: z.string().trim().min(1, "Stage name is required").max(50, "Keep it under 50 characters"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a color"),
  probability: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d{1,3}$/.test(v) && Number(v) <= 100), "Enter a whole number from 0 to 100"),
  outcome: z.enum(["open", "won", "lost"]),
});
type StageValues = z.infer<typeof stageSchema>;

function StageDialog({
  pipelineId,
  stage,
  nextPosition,
  onClose,
  onSaved,
}: {
  pipelineId: string;
  stage: PipelineStage | null;
  nextPosition: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { register, handleSubmit, formState, watch, setValue } = useForm<StageValues>({
    resolver: zodResolver(stageSchema),
    defaultValues: {
      name: stage?.name ?? "",
      color: stage?.color ?? STAGE_COLORS[nextPosition % STAGE_COLORS.length],
      probability: stage?.probability != null ? String(stage.probability) : "",
      outcome: stage?.is_won ? "won" : stage?.is_lost ? "lost" : "open",
    },
  });
  const color = watch("color");
  const outcome = watch("outcome");

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      name: values.name.trim(),
      color: values.color,
      probability: values.probability === "" ? null : Number(values.probability),
      is_won: values.outcome === "won",
      is_lost: values.outcome === "lost",
    };
    const { error } = stage
      ? await supabase.from("pipeline_stages").update(payload).eq("id", stage.id)
      : await supabase.from("pipeline_stages").insert({ ...payload, pipeline_id: pipelineId, position: nextPosition });
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    toast.success(stage ? "Stage updated" : "Stage added");
    onSaved();
    onClose();
  });

  return (
    <Dialog open onOpenChange={(open) => !open && !formState.isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{stage ? "Edit stage" : "Add stage"}</DialogTitle>
            <DialogDescription>Stages appear as columns on the pipeline board.</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="stage-name">
              Name <span className="text-destructive" aria-hidden>*</span>
            </Label>
            <Input id="stage-name" autoFocus placeholder="e.g. Demo scheduled" aria-invalid={!!formState.errors.name} {...register("name")} />
            <FieldError message={formState.errors.name?.message} />
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Color</legend>
            <div className="flex flex-wrap items-center gap-2">
              {STAGE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  aria-pressed={color.toLowerCase() === c}
                  onClick={() => setValue("color", c, { shouldDirty: true })}
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    color.toLowerCase() === c ? "scale-110 border-foreground" : "border-transparent",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
              <label className="relative inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-xs text-muted-foreground">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setValue("color", e.target.value, { shouldDirty: true })}
                  className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
                  aria-label="Custom color"
                />
                Custom
              </label>
            </div>
            <FieldError message={formState.errors.color?.message} />
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="stage-probability">Win probability (%)</Label>
            <Input
              id="stage-probability"
              inputMode="numeric"
              placeholder="e.g. 50"
              className="w-28 tabular-nums"
              aria-invalid={!!formState.errors.probability}
              {...register("probability")}
            />
            <p className="text-xs text-muted-foreground">Optional. Used for the weighted forecast of deals in this stage.</p>
            <FieldError message={formState.errors.probability?.message} />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Stage type</legend>
            <RadioGroup value={outcome} onValueChange={(v) => setValue("outcome", v as StageValues["outcome"], { shouldDirty: true })} className="grid gap-2 sm:grid-cols-3">
              {[
                { value: "open", label: "Open" },
                { value: "won", label: "Closed won" },
                { value: "lost", label: "Closed lost" },
              ].map((o) => (
                <Label
                  key={o.value}
                  htmlFor={`stage-outcome-${o.value}`}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-normal has-[:checked]:border-foreground/50"
                >
                  <RadioGroupItem id={`stage-outcome-${o.value}`} value={o.value} />
                  {o.label}
                </Label>
              ))}
            </RadioGroup>
          </fieldset>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={formState.isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={formState.isSubmitting}>
              {formState.isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : stage ? (
                "Save stage"
              ) : (
                "Add stage"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Pipeline dialog ---------------------------------------------------------------------------

const pipelineSchema = z.object({
  name: z.string().trim().min(1, "Pipeline name is required").max(60, "Keep it under 60 characters"),
});

function PipelineDialog({
  pipeline,
  onClose,
  onSaved,
}: {
  pipeline: Pipeline | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { user } = useAuth();
  const { wouldExceed } = usePlan();
  // Plan limit on pipelines: say so up front instead of letting the insert fail.
  const atLimit = !pipeline && wouldExceed("pipelines");
  const { register, handleSubmit, formState } = useForm<z.infer<typeof pipelineSchema>>({
    resolver: zodResolver(pipelineSchema),
    defaultValues: { name: pipeline?.name ?? "" },
  });

  const onSubmit = handleSubmit(async ({ name }) => {
    try {
      if (pipeline) {
        const { error } = await supabase.from("pipelines").update({ name: name.trim() }).eq("id", pipeline.id);
        if (error) throw error;
        toast.success("Pipeline renamed");
        onSaved(pipeline.id);
      } else {
        const { data, error } = await supabase
          .from("pipelines")
          .insert({ name: name.trim(), created_by: user?.id ?? null })
          .select("id")
          .single();
        if (error) throw error;
        const id = (data as { id: string }).id;
        const { error: stagesError } = await supabase
          .from("pipeline_stages")
          .insert(DEFAULT_STAGES.map((s, position) => ({ ...s, pipeline_id: id, position })));
        if (stagesError) {
          // Don't leave a pipeline without stages behind (it has no deals yet, so deleting it is safe).
          await supabase.from("pipelines").delete().eq("id", id);
          throw stagesError;
        }
        toast.success("Pipeline created with default stages");
        onSaved(id);
      }
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && !formState.isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{pipeline ? "Rename pipeline" : "New pipeline"}</DialogTitle>
            {!pipeline && (
              <DialogDescription>It starts with standard stages (Lead → Won/Lost) that you can edit.</DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="pipeline-name">
              Name <span className="text-destructive" aria-hidden>*</span>
            </Label>
            <Input id="pipeline-name" autoFocus placeholder="e.g. Renewals" aria-invalid={!!formState.errors.name} {...register("name")} />
            <FieldError message={formState.errors.name?.message} />
          </div>
          {!pipeline && <LimitNotice limit="pipelines" action="add another pipeline" />}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={formState.isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={formState.isSubmitting || atLimit}>
              {formState.isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : pipeline ? (
                "Save"
              ) : (
                "Create pipeline"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
