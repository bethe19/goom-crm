import { useState, useRef } from "react";
import { usePipelines, usePipelineStages, PipelineStage } from "@/hooks/usePipelineStages";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, GripVertical, Pencil, Check, X } from "lucide-react";

export function PipelineSettings() {
  const { user } = useAuth();
  const { data: pipelines } = usePipelines();
  const pipeline = pipelines?.[0];
  const { data: stages } = usePipelineStages(pipeline?.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState("#3b82f6");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  const invalidateStages = () => {
    queryClient.invalidateQueries({ queryKey: ["pipeline_stages"] });
  };

  const handleAddStage = async () => {
    if (!pipeline || !newStageName.trim()) return;
    const maxPos = stages?.reduce((max, s) => Math.max(max, s.position), -1) ?? -1;
    const { error } = await supabase.from("pipeline_stages").insert({
      pipeline_id: pipeline.id,
      name: newStageName.trim(),
      color: newStageColor,
      position: maxPos + 1,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Stage added" });
      setNewStageName("");
      invalidateStages();
    }
  };

  const handleDeleteStage = async (id: string) => {
    const { error } = await supabase.from("pipeline_stages").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Stage removed" });
      invalidateStages();
    }
  };

  const handleStartEdit = (stage: PipelineStage) => {
    setEditingId(stage.id);
    setEditName(stage.name);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return;
    const { error } = await supabase
      .from("pipeline_stages")
      .update({ name: editName.trim() })
      .eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Stage renamed" });
      setEditingId(null);
      invalidateStages();
    }
  };

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOver.current = index;
  };

  const handleDragEnd = async () => {
    if (dragItem.current === null || dragOver.current === null || !stages) return;
    if (dragItem.current === dragOver.current) {
      dragItem.current = null;
      dragOver.current = null;
      return;
    }

    const reordered = [...stages];
    const [removed] = reordered.splice(dragItem.current, 1);
    reordered.splice(dragOver.current, 0, removed);

    dragItem.current = null;
    dragOver.current = null;

    // Optimistic update — show new order immediately
    const optimistic = reordered.map((stage, i) => ({ ...stage, position: i }));
    queryClient.setQueryData(["pipeline_stages", pipeline?.id], optimistic);

    // Persist to DB
    const updates = optimistic.map(({ id, position }) => ({ id, position }));
    const promises = updates.map(({ id, position }) =>
      supabase.from("pipeline_stages").update({ position }).eq("id", id)
    );
    const results = await Promise.all(promises);
    const hasError = results.find((r) => r.error);
    if (hasError) {
      toast({ title: "Error reordering", description: hasError.error?.message, variant: "destructive" });
      invalidateStages(); // revert on error
    } else {
      toast({ title: "Stages reordered" });
      invalidateStages();
    }
  };

  const handleCreatePipeline = async () => {
    if (!user) return;
    const { error } = await supabase.rpc("seed_default_pipeline", { p_user_id: user.id });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Pipeline created" });
      queryClient.invalidateQueries({ queryKey: ["pipelines", "pipeline_stages"] });
    }
  };

  if (!pipeline) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">No pipeline found. Create one to get started.</p>
        <Button onClick={handleCreatePipeline}>Create default pipeline</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-md">
      <div>
        <h3 className="text-sm font-semibold mb-1">Pipeline stages</h3>
        <p className="text-xs text-muted-foreground mb-3">Drag to reorder. Changes reflect on the pipeline page.</p>
        <div className="space-y-2">
          {stages?.map((stage, index) => (
            <div
              key={stage.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className="flex items-center gap-3 rounded-lg border p-3 bg-background cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />

              {editingId === stage.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit(stage.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleSaveEdit(stage.id)}>
                    <Check className="h-4 w-4 text-primary" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium">{stage.name}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleStartEdit(stage)}>
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleDeleteStage(stage.id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input value={newStageName} onChange={(e) => setNewStageName(e.target.value)} placeholder="New stage name" className="flex-1" />
        <input type="color" value={newStageColor} onChange={(e) => setNewStageColor(e.target.value)} className="h-10 w-10 rounded cursor-pointer" />
        <Button onClick={handleAddStage} size="icon"><Plus className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
