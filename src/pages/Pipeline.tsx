import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePipelines, usePipelineStages, PipelineStage } from "@/hooks/usePipelineStages";
import { useDeals, Deal } from "@/hooks/useDeals";
import { KanbanBoard } from "@/components/pipeline/KanbanBoard";
import { CreateDealDialog } from "@/components/pipeline/CreateDealDialog";
import { DealDetailSheet } from "@/components/pipeline/DealDetailSheet";
import { PipelineFilters } from "@/components/pipeline/PipelineFilters";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PageBanner } from "@/components/PageBanner";
import { Plus, Kanban, Sparkles, UploadCloud } from "lucide-react";
import { getDemoDeals, DEMO_STAGES, seedSupabaseWithDemoData } from "@/lib/demoData";
import { useQueryClient } from "@tanstack/react-query";

export default function Pipeline() {
  const { user, isDemoMode } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: pipelines, isLoading: pipelinesLoading } = usePipelines();
  const pipeline = pipelines?.[0];
  const { data: liveStages, isLoading: stagesLoading } = usePipelineStages(pipeline?.id);
  const { data: liveDeals, isLoading: dealsLoading } = useDeals(pipeline?.id);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createStageId, setCreateStageId] = useState<string | undefined>();
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [seeding, setSeeding] = useState(false);

  // Fallback stages & deals strictly when in demo mode
  const useFallback = isDemoMode;

  const effectiveStages: PipelineStage[] = useMemo(() => {
    if (liveStages && liveStages.length > 0) {
      return liveStages;
    }
    return DEMO_STAGES.map((s) => ({
      id: s.id,
      pipeline_id: activePipeline?.id || "default-pipeline",
      name: s.name,
      color: s.color,
      position: s.position,
      created_at: "2026-01-01T00:00:00Z",
    }));
  }, [liveStages, activePipeline]);

  const effectiveDeals: Deal[] = useMemo(() => {
    if (isDemoMode) {
      const demo = getDemoDeals();
      return demo.map((d) => ({
        id: d.id,
        title: d.title,
        company_id: null,
        contact_id: null,
        pipeline_id: "demo-pipeline",
        stage_id: d.stage_id,
        owner_id: "demo-user",
        value: d.value,
        probability: d.probability,
        close_date: d.close_date,
        notes: d.notes || null,
        created_by: "demo-user",
        created_at: d.created_at,
        updated_at: d.created_at,
        companies: { id: "c-1", name: d.company_name },
        contacts: {
          id: "ct-1",
          first_name: d.contact_name.split(" ")[0],
          last_name: d.contact_name.split(" ")[1] || "",
        },
        priority: d.priority,
        ai_score: d.ai_score,
      } as any));
    }
    return liveDeals || [];
  }, [isDemoMode, liveDeals]);

  const [dealsState, setDealsState] = useState<Deal[]>(effectiveDeals);

  useEffect(() => {
    setDealsState(effectiveDeals);
  }, [effectiveDeals]);

  const handleDealMove = (dealId: string, stageId: string) => {
    setDealsState((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stage_id: stageId } : d))
    );
  };

  // Open deal from search param
  useEffect(() => {
    const openId = searchParams.get("open");
    if (openId && dealsState) {
      const found = dealsState.find((d) => d.id === openId);
      if (found) {
        setSelectedDeal(found);
        searchParams.delete("open");
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, dealsState, setSearchParams]);

  const filteredDeals = useMemo(() => {
    if (!dealsState) return [];
    if (!search) return dealsState;
    const s = search.toLowerCase();
    return dealsState.filter(
      (d) =>
        d.title.toLowerCase().includes(s) ||
        d.companies?.name?.toLowerCase().includes(s) ||
        d.contacts?.first_name?.toLowerCase().includes(s) ||
        d.contacts?.last_name?.toLowerCase().includes(s)
    );
  }, [dealsState, search]);

  const handleSeedCloudPipeline = async () => {
    if (!user) return;
    setSeeding(true);
    const res = await seedSupabaseWithDemoData(supabase, user.id);
    setSeeding(false);
    if (res.success) {
      toast({ title: "Pipeline Seeded! 🎉", description: "Sample enterprise deals added to your cloud pipeline." });
      queryClient.invalidateQueries();
    } else {
      toast({ title: "Error", description: res.error, variant: "destructive" });
    }
  };

  const isLoading = !useFallback && (pipelinesLoading || stagesLoading || dealsLoading);

  return (
    <div className="space-y-6">
      <PageBanner
        title="Sales Pipeline"
        description="Real-time deal flow, velocity telemetry, and drag-and-drop progression."
      >
        <div className="flex flex-wrap items-center gap-2">
          {isDemoMode && (
            <Badge variant="outline" className="text-[10px] font-semibold border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
              <Sparkles className="h-3 w-3 mr-1" />
              Beta Sandbox Active
            </Badge>
          )}

          <Button
            className="h-9 text-xs font-medium"
            onClick={() => {
              setCreateStageId(effectiveStages[0]?.id);
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" /> Create Deal
          </Button>
        </div>
      </PageBanner>

      <PipelineFilters search={search} onSearchChange={setSearch} />

      {isLoading ? (
        <div className="flex gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[500px] w-[280px] flex-shrink-0 rounded-xl" />
          ))}
        </div>
      ) : effectiveStages && effectiveStages.length > 0 ? (
        <KanbanBoard
          stages={effectiveStages}
          deals={filteredDeals}
          onDealClick={setSelectedDeal}
          onDealMove={handleDealMove}
          onAddDeal={(stageId) => {
            setCreateStageId(stageId);
            setCreateOpen(true);
          }}
        />
      ) : null}

      <CreateDealDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        pipelineId={pipeline?.id || "demo-pipeline"}
        stages={effectiveStages}
        defaultStageId={createStageId}
      />

      <DealDetailSheet
        deal={selectedDeal}
        open={!!selectedDeal}
        onOpenChange={(o) => !o && setSelectedDeal(null)}
        stages={effectiveStages || []}
      />
    </div>
  );
}
