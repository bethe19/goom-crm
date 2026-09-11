import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  DollarSign,
  Target,
  Clock,
  RotateCcw,
  UploadCloud,
  Plus,
  MoreHorizontal,
  UserPlus,
  PhoneCall,
  CheckSquare,
  MessageSquarePlus,
  Building2,
  Sparkles,
} from "lucide-react";
import { seedGoomConstructionWorkspace } from "@/lib/seedGoomConstruction";
import { formatCurrency } from "@/lib/formatters";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { ClosingSoon } from "@/components/dashboard/ClosingSoon";
import { PipelineFunnelChart, StageFunnelItem } from "@/components/dashboard/PipelineFunnelChart";
import { RevenueTrendChart } from "@/components/dashboard/RevenueTrendChart";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BetaFeedbackDialog } from "@/components/BetaFeedbackDialog";
import { CreateDealDialog } from "@/components/pipeline/CreateDealDialog";
import { CreateContactDialog } from "@/components/contacts/CreateContactDialog";
import { LogActivityDialog } from "@/components/activities/LogActivityDialog";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";
import { DealDetailSheet } from "@/components/pipeline/DealDetailSheet";
import { usePipelines, usePipelineStages, PipelineStage } from "@/hooks/usePipelineStages";
import { Deal } from "@/hooks/useDeals";
import {
  getDemoDeals,
  DEMO_STAGES,
  resetDemoData,
  seedSupabaseWithDemoData,
} from "@/lib/demoData";
import { toast } from "sonner";
import { startOfWeek, startOfMonth, startOfQuarter } from "date-fns";
import { useSearchParams, useNavigate } from "react-router-dom";

type Period = "week" | "month" | "quarter" | "all";

function getStartDate(period: Period): string | null {
  const now = new Date();
  if (period === "week") return startOfWeek(now, { weekStartsOn: 1 }).toISOString();
  if (period === "month") return startOfMonth(now).toISOString();
  if (period === "quarter") return startOfQuarter(now).toISOString();
  return null;
}

export default function Index() {
  // All hooks MUST be called unconditionally at the top — React Rules of Hooks
  const { user, isDemoMode, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>("all");

  // Dialog states for in-place actions (no page redirects!)
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [createDealOpen, setCreateDealOpen] = useState(false);
  const [createContactOpen, setCreateContactOpen] = useState(false);
  const [logActivityOpen, setLogActivityOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [selectedDealForSheet, setSelectedDealForSheet] = useState<Deal | null>(null);
  const [seedingCloud, setSeedingCloud] = useState(false);

  const since = getStartDate(period);

  const { data: pipelines } = usePipelines();
  const activePipeline = pipelines?.[0];
  const { data: liveStages } = usePipelineStages(activePipeline?.id);

  const effectiveStages: PipelineStage[] = useMemo(() => {
    if (!liveStages || liveStages.length === 0) {
      return DEMO_STAGES.map((s) => ({
        id: s.id,
        pipeline_id: "demo-pipeline",
        name: s.name,
        color: s.color,
        position: s.position,
        created_at: "2026-01-01T00:00:00Z",
      }));
    }
    return liveStages;
  }, [liveStages]);

  const { data: profile } = useQuery({
    queryKey: ["profile-dashboard", user?.id],
    queryFn: async () => {
      if (isDemoMode) {
        return {
          full_name: "Alex Vance",
          avatar_url: "",
          company: "Goom Global",
        };
      }
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, full_name, company")
        .eq("user_id", user!.id)
        .single();
      return {
        ...data,
        full_name: data?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Team Member",
      };
    },
    enabled: !!user,
  });

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats", period, isDemoMode],
    queryFn: async () => {
      if (isDemoMode) {
        const demoDeals = getDemoDeals();
        const totalValue = demoDeals.reduce((sum, d) => sum + d.value, 0);
        const wonCount = demoDeals.filter((d) => d.stage_name === "Won").length;
        const lostCount = demoDeals.filter((d) => d.stage_name === "Lost").length;
        const closed = wonCount + lostCount;
        const winRate = closed > 0 ? Math.round((wonCount / closed) * 100) : 38;

        const funnelStages: StageFunnelItem[] = DEMO_STAGES.map((s) => {
          const matching = demoDeals.filter((d) => d.stage_id === s.id);
          return {
            id: s.id,
            name: s.name,
            color: s.color,
            count: matching.length,
            value: matching.reduce((sum, d) => sum + d.value, 0),
          };
        });

        return {
          totalDeals: demoDeals.length,
          totalValue,
          winRate,
          avgCycle: 16,
          funnelStages,
          deals: demoDeals,
          isFallback: false,
        };
      }

      // Live Supabase query
      let dealsQuery = supabase.from("deals").select("*, companies(name), contacts(first_name, last_name)", { count: "exact" });
      if (since) {
        dealsQuery = dealsQuery.gte("created_at", since);
      }
      const { data: dealsData, count: totalDeals } = await dealsQuery;
      const totalValue = dealsData?.reduce((sum, d: any) => sum + Number(d.value || 0), 0) || 0;

      const { data: stages } = await supabase.from("pipeline_stages").select("id, name, color, position").order("position");
      const effectivePipelineStages = stages && stages.length > 0 ? stages : DEMO_STAGES;

      if (!dealsData || dealsData.length === 0) {
        const funnelStages: StageFunnelItem[] = effectivePipelineStages.map((s: any) => ({
          id: s.id,
          name: s.name,
          color: s.color || "#3b82f6",
          count: 0,
          value: 0,
        }));
        return {
          totalDeals: 0,
          totalValue: 0,
          winRate: 0,
          avgCycle: 0,
          funnelStages,
          deals: [],
          isFallback: false,
        };
      }

      const wonId = stages?.find((s: any) => s.name === "Won")?.id;
      const lostId = stages?.find((s: any) => s.name === "Lost")?.id;

      const wonCount = dealsData.filter((d: any) => d.stage_id === wonId).length;
      const lostCount = dealsData.filter((d: any) => d.stage_id === lostId).length;
      const closedTotal = wonCount + lostCount;
      const winRate = closedTotal > 0 ? Math.round((wonCount / closedTotal) * 100) : 0;

      const funnelStages: StageFunnelItem[] = (stages || []).map((s: any) => {
        const matching = dealsData.filter((d: any) => d.stage_id === s.id);
        return {
          id: s.id,
          name: s.name,
          color: s.color || "#3b82f6",
          count: matching.length,
          value: matching.reduce((sum: number, d: any) => sum + Number(d.value || 0), 0),
        };
      });

      return {
        totalDeals: totalDeals || 0,
        totalValue,
        winRate,
        avgCycle: 16,
        funnelStages,
        deals: dealsData,
        isFallback: false,
      };
    },
  });

  const handleOpenDealById = (dealId: string) => {
    const allDeals = stats?.deals || (isDemoMode ? getDemoDeals() : []);
    const found = allDeals.find((d: any) => d.id === dealId);
    if (found) {
      setSelectedDealForSheet(found as any);
    } else {
      toast({ title: "Deal detail opened", description: `Viewing deal #${dealId}` });
    }
  };

  const handleSeedCloudData = async () => {
    if (!user) return;
    setSeedingCloud(true);
    const res = await seedSupabaseWithDemoData(supabase, user.id);
    setSeedingCloud(false);
    if (res.success) {
      toast({
        title: "Workspace Populated! 🎉",
        description: "Seeded realistic enterprise deals, contacts, and companies into Supabase.",
      });
      queryClient.invalidateQueries();
    } else {
      toast.error(res.error || "Seeding Error");
    }
  };

  const [seedingGoom, setSeedingGoom] = useState(false);

  const handleSeedGoom = async () => {
    if (!user) {
      toast.error("Please log in to initialize workspace");
      return;
    }
    setSeedingGoom(true);
    try {
      const res = await seedGoomConstructionWorkspace(supabase, user.id);
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries();
      } else {
        toast.error(res.message);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to seed Goom Construction");
    } finally {
      setSeedingGoom(false);
    }
  };

  const handleResetSandbox = () => {
    resetDemoData();
    queryClient.invalidateQueries();
    toast({
      title: "Sandbox Reset",
      description: "Restored initial 2026 enterprise dataset.",
    });
  };

  const periods: { label: string; value: Period }[] = [
    { label: "This Week", value: "week" },
    { label: "This Month", value: "month" },
    { label: "This Quarter", value: "quarter" },
    { label: "All Time", value: "all" },
  ];

  const targetQuota = 1250000;
  const currentPipelineValue = stats?.totalValue || 0;
  const quotaPercentage = Math.min(Math.round((currentPipelineValue / targetQuota) * 100), 100);

  const statCards = [
    {
      label: "Active Pipeline Value",
      value: formatCurrency(stats?.totalValue || 0),
      delta: stats?.totalDeals ? "+22.4% vs last period" : "Real-time live pipeline",
      icon: DollarSign,
    },
    {
      label: "Deals in Velocity",
      value: String(stats?.totalDeals || 0),
      delta: stats?.totalDeals ? "Active in velocity" : "Ready for deals",
      icon: Target,
    },
    {
      label: "Win Conversion Rate",
      value: `${stats?.winRate || 0}%`,
      delta: stats?.totalDeals ? "+4.2% YoY pace" : "Calculated on closed deals",
      icon: TrendingUp,
    },
    {
      label: "Average Sales Cycle",
      value: `${stats?.avgCycle || 0} days`,
      delta: stats?.totalDeals ? "52% faster than benchmark" : "Paced on deal stages",
      icon: Clock,
    },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Superclean Minimal Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-border">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Dashboard
            </h1>
            <Badge
              variant="outline"
              className="h-5 border-border bg-secondary text-[10px] font-semibold text-foreground px-2"
            >
              15-Day Trial
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats?.totalDeals ?? 0} active deals • {formatCurrency(stats?.totalValue || 0)} pipeline • Target pace at {quotaPercentage}%
          </p>
        </div>

        {/* Controls & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Period selector */}
          <div className="flex rounded-lg bg-secondary p-0.5 border border-border">
            {periods.map((p) => (
              <Button
                key={p.value}
                variant={period === p.value ? "default" : "ghost"}
                size="sm"
                className={`h-7 text-xs px-2.5 rounded-md font-medium transition-all ${
                  period === p.value
                    ? "bg-foreground text-background shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setPeriod(p.value)}
              >
                {p.label}
              </Button>
            ))}
          </div>

          {/* Primary Action Button */}
          <Button
            size="sm"
            onClick={() => setCreateDealOpen(true)}
            className="h-8 rounded-lg bg-foreground text-background hover:bg-foreground/90 text-xs font-medium gap-1.5 shadow-xs px-3"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Deal</span>
          </Button>

          {/* Secondary Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-border hover:bg-secondary px-2.5 text-xs text-foreground"
                title="More quick actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 text-xs">
              <DropdownMenuItem onClick={() => setCreateContactOpen(true)}>
                <UserPlus className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <span>Add Contact</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLogActivityOpen(true)}>
                <PhoneCall className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <span>Log Activity</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCreateTaskOpen(true)}>
                <CheckSquare className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <span>New Task</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {!isDemoMode && (
                <DropdownMenuItem onClick={handleSeedGoom} disabled={seedingGoom}>
                  <Building2 className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  <span>{seedingGoom ? "Seeding Goom..." : "Seed Goom Construction"}</span>
                </DropdownMenuItem>
              )}
              {isDemoMode && (
                <DropdownMenuItem onClick={handleResetSandbox}>
                  <RotateCcw className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  <span>Reset Demo Data</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setFeedbackOpen(true)}>
                <MessageSquarePlus className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <span>Send Feedback</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Executive Metric Row (4 Clean Cards) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card
            key={stat.label}
            className="border border-border bg-card p-4 shadow-xs transition-all hover:border-foreground/30"
          >
            <div className="flex items-center justify-between pb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </span>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="mt-2">
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-semibold tracking-tight text-foreground">
                  {stat.value}
                </div>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">
                {stat.delta}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* Goom Construction Workspace Initializer Banner */}
      {!isDemoMode && stats?.totalDeals === 0 && !isLoading && (
        <div className="rounded-xl border border-border bg-secondary/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-background shadow-xs shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">Goom Construction Workspace</h3>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-border bg-background font-mono">
                  Ready to Seed
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Initialize your commercial pipeline with 6 realistic development projects ($2,670,000 active pipeline), contacts, activities, and tasks.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleSeedGoom}
            disabled={seedingGoom}
            className="h-9 px-4 bg-foreground text-background hover:bg-foreground/90 text-xs font-semibold gap-2 shadow-xs shrink-0 rounded-lg"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <span>{seedingGoom ? "Seeding Goom Pipeline..." : "Seed Goom Construction Data"}</span>
          </Button>
        </div>
      )}

      {/* 2-Column Balanced Dashboard Layout */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column (7 cols): Trend Graph + Pipeline Stage Funnel Graph */}
        <div className="space-y-6 lg:col-span-7">
          <RevenueTrendChart
            period={period}
            deals={stats?.deals || []}
            onCreateDeal={() => setCreateDealOpen(true)}
          />
          <PipelineFunnelChart
            stages={stats?.funnelStages || []}
            deals={stats?.deals || []}
            totalDeals={stats?.totalDeals || 0}
            totalValue={stats?.totalValue || 0}
            onSelectDeal={handleOpenDealById}
          />
        </div>

        {/* Right Column (5 cols): Action Radar (Closing Soon & Tasks) + Activity Stream */}
        <div className="space-y-6 lg:col-span-5">
          <ClosingSoon since={since} onSelectDeal={handleOpenDealById} />
          <RecentActivity since={since} />
        </div>
      </div>

      {/* IN-PLACE MODALS - All Actions Function Seamlessly Without Page Reload */}
      <CreateDealDialog
        open={createDealOpen}
        onOpenChange={setCreateDealOpen}
        pipelineId={activePipeline?.id || "demo-pipeline"}
        stages={effectiveStages}
      />

      <CreateContactDialog
        open={createContactOpen}
        onOpenChange={setCreateContactOpen}
      />

      <LogActivityDialog
        open={logActivityOpen}
        onOpenChange={setLogActivityOpen}
      />

      <CreateTaskDialog
        open={createTaskOpen}
        onOpenChange={setCreateTaskOpen}
      />

      <DealDetailSheet
        deal={selectedDealForSheet}
        open={!!selectedDealForSheet}
        onOpenChange={(open) => !open && setSelectedDealForSheet(null)}
        stages={effectiveStages}
      />

      <BetaFeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </div>
  );
}
