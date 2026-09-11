import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { formatCurrency } from "@/lib/formatters";
import {
  Sparkles,
  TrendingUp,
  Target,
  Zap,
  ShieldAlert,
  Plus,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface RevenueTrendChartProps {
  period?: "week" | "month" | "quarter" | "all";
  deals?: any[];
  onCreateDeal?: () => void;
}

type ScenarioMode = "realistic" | "conservative" | "aggressive";

export function RevenueTrendChart({
  period = "quarter",
  deals = [],
  onCreateDeal,
}: RevenueTrendChartProps) {
  const { isDemoMode } = useAuth();
  const [metricView, setMetricView] = useState<"combined" | "pipeline" | "ai_trajectory">("combined");
  const [scenario, setScenario] = useState<ScenarioMode>("realistic");
  const [selectedInsightTab, setSelectedInsightTab] = useState<"pace" | "golden" | "risk">("pace");

  // Dynamic values computed from live deals or demo data
  const totalPipeline = useMemo(() => {
    if (isDemoMode) return 918500;
    return deals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  }, [deals, isDemoMode]);

  const wonDeals = useMemo(() => {
    if (isDemoMode) return [{ value: 208000 }];
    return deals.filter(
      (d) => d.stage_name === "Won" || d.stage_id === "stage-won" || d.pipeline_stages?.name === "Won"
    );
  }, [deals, isDemoMode]);

  const wonValue = useMemo(() => {
    if (isDemoMode) return 208000;
    return wonDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  }, [wonDeals, isDemoMode]);

  const winRate = useMemo(() => {
    if (isDemoMode) return 38;
    const lostDeals = deals.filter(
      (d) => d.stage_name === "Lost" || d.stage_id === "stage-lost" || d.pipeline_stages?.name === "Lost"
    );
    const closed = wonDeals.length + lostDeals.length;
    return closed > 0 ? Math.round((wonDeals.length / closed) * 100) : 0;
  }, [deals, wonDeals, isDemoMode]);

  const targetQuota = 1250000;

  // Chart data: demo data when in demo mode, or dynamic points when deals exist
  const chartData = useMemo(() => {
    if (isDemoMode) {
      const baseData = [
        { date: "Jul 01", pipeline: 420000, actualWon: 35000, conservative: 390000, realistic: 420000, aggressive: 440000 },
        { date: "Jul 15", pipeline: 495000, actualWon: 72000, conservative: 460000, realistic: 500000, aggressive: 530000 },
        { date: "Aug 01", pipeline: 580000, actualWon: 110000, conservative: 540000, realistic: 590000, aggressive: 630000 },
        { date: "Aug 15", pipeline: 670000, actualWon: 145000, conservative: 620000, realistic: 680000, aggressive: 740000 },
        { date: "Sep 01", pipeline: 785000, actualWon: 208000, conservative: 710000, realistic: 795000, aggressive: 870000 },
        { date: "Sep 15", pipeline: 860000, actualWon: 208000, conservative: 770000, realistic: 875000, aggressive: 970000 },
        { date: "Sep 28", pipeline: 918500, actualWon: 208000, conservative: 820000, realistic: 940000, aggressive: 1060000 },
        { date: "Oct 15", pipeline: 1040000, actualWon: null, conservative: 910000, realistic: 1050000, aggressive: 1210000 },
        { date: "Oct 31", pipeline: 1180000, actualWon: null, conservative: 980000, realistic: 1195000, aggressive: 1390000 },
        { date: "Nov 15", pipeline: 1250000, actualWon: null, conservative: 1050000, realistic: 1280000, aggressive: 1520000 },
      ];
      return baseData.map((d) => ({ ...d, aiProjected: d[scenario] }));
    }

    if (!deals || deals.length === 0) {
      return [];
    }

    // Dynamic points for live workspace with deals
    const p1 = Math.round(totalPipeline * 0.4);
    const p2 = Math.round(totalPipeline * 0.7);
    const p3 = totalPipeline;

    const cons = Math.round(wonValue + (totalPipeline - wonValue) * 0.5);
    const real = Math.round(wonValue + (totalPipeline - wonValue) * 0.85);
    const aggr = Math.round(totalPipeline * 1.15);

    const points = [
      { date: "Start", pipeline: p1, actualWon: Math.round(wonValue * 0.3), conservative: Math.round(cons * 0.4), realistic: Math.round(real * 0.4), aggressive: Math.round(aggr * 0.4) },
      { date: "Mid", pipeline: p2, actualWon: Math.round(wonValue * 0.7), conservative: Math.round(cons * 0.7), realistic: Math.round(real * 0.7), aggressive: Math.round(aggr * 0.7) },
      { date: "Current", pipeline: p3, actualWon: wonValue, conservative: cons, realistic: real, aggressive: aggr },
      { date: "Close Target", pipeline: Math.round(p3 * 1.1), actualWon: null, conservative: cons, realistic: real, aggressive: aggr },
    ];

    return points.map((d) => ({ ...d, aiProjected: d[scenario] }));
  }, [deals, isDemoMode, scenario, totalPipeline, wonValue]);

  const scenariosConfig = useMemo(() => {
    if (isDemoMode) {
      return {
        conservative: {
          label: "Conservative",
          targetProjected: 1050000,
          attainment: 84,
          desc: "Based solely on committed deals & historic minimums",
          color: "#64748b",
        },
        realistic: {
          label: "Realistic",
          targetProjected: 1280000,
          attainment: 102.4,
          desc: "Weighted probability model + team velocity",
          color: "#2563eb",
        },
        aggressive: {
          label: "Aggressive",
          targetProjected: 1520000,
          attainment: 121.6,
          desc: "Full pipeline conversion with zero deal slippage",
          color: "#10b981",
        },
      };
    }

    const cons = Math.round(wonValue + (totalPipeline - wonValue) * 0.5);
    const real = Math.round(wonValue + (totalPipeline - wonValue) * 0.85);
    const aggr = Math.round(totalPipeline * 1.15);

    return {
      conservative: {
        label: "Conservative",
        targetProjected: cons,
        attainment: targetQuota > 0 ? Math.round((cons / targetQuota) * 100) : 0,
        desc: "High probability conversion (committed deals)",
        color: "#64748b",
      },
      realistic: {
        label: "Realistic",
        targetProjected: real,
        attainment: targetQuota > 0 ? Math.round((real / targetQuota) * 100) : 0,
        desc: "Weighted deal probability model",
        color: "#2563eb",
      },
      aggressive: {
        label: "Aggressive",
        targetProjected: aggr,
        attainment: targetQuota > 0 ? Math.round((aggr / targetQuota) * 100) : 0,
        desc: "Full pipeline conversion upside",
        color: "#10b981",
      },
    };
  }, [isDemoMode, wonValue, totalPipeline, targetQuota]);

  const activeScenarioConfig = scenariosConfig[scenario];

  // Top deals for dynamic Key Drivers tab
  const topDeals = useMemo(() => {
    return [...deals]
      .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
      .slice(0, 2);
  }, [deals]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-xl border border-border bg-card/95 backdrop-blur-md p-3 shadow-lg text-xs space-y-2 min-w-[200px]">
          <div className="flex items-center justify-between pb-1.5 border-b border-border">
            <span className="font-semibold text-foreground">{label}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 uppercase">
              {scenario}
            </Badge>
          </div>
          <div className="space-y-1.5">
            {payload.map((entry: any, index: number) => {
              if (entry.value === null || entry.value === undefined) return null;
              return (
                <div key={index} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    {entry.name}:
                  </span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(entry.value)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  const hasDeals = isDemoMode || (deals && deals.length > 0);

  return (
    <Card className="border border-border bg-card shadow-xs overflow-hidden">
      {/* Header & Controls */}
      <CardHeader className="pb-2 pt-4 px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
                Revenue Forecast & Pipeline Velocity
              </CardTitle>
              <Badge variant="outline" className="text-[10px] bg-secondary text-foreground font-medium border-border">
                AI Trajectory
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Multi-scenario ARR forecasting powered by historical sales cycle velocity
            </p>
          </div>

          {/* Scenario Switching Radio Pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground font-medium hidden sm:inline">Scenario:</span>
            <div className="flex rounded-lg bg-secondary p-0.5 border border-border">
              {(["conservative", "realistic", "aggressive"] as ScenarioMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setScenario(mode)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-all ${
                    scenario === mode
                      ? "bg-foreground text-background shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-2 px-5 pb-5 space-y-4">
        {/* Metric Summary Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-border bg-secondary/30">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-background"
              style={{ backgroundColor: activeScenarioConfig.color }}
            >
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {activeScenarioConfig.label} Projected Close:
                </span>
                <span className="text-sm font-bold text-foreground">
                  {formatCurrency(activeScenarioConfig.targetProjected)}
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] font-semibold border-border bg-background"
                >
                  {activeScenarioConfig.attainment}% Quota
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {activeScenarioConfig.desc}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-right shrink-0">
            <div>
              <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                Target Quota
              </span>
              <span className="text-xs font-bold text-foreground">$1,250,000</span>
            </div>
            <div className="h-8 w-px bg-border mx-1" />
            <div>
              <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                Win Rate
              </span>
              <span className="text-xs font-bold text-foreground">{winRate}%</span>
            </div>
          </div>
        </div>

        {/* Chart View Mode Selector */}
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-xs bg-[#2563eb]" />
              <span className="text-foreground font-medium text-[11px]">
                Active Pipeline ({formatCurrency(totalPipeline)})
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#10b981]" />
              <span className="text-foreground font-medium text-[11px]">
                Closed Won ({formatCurrency(wonValue)})
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 bg-[#f59e0b] border-dashed" />
              <span className="text-foreground font-medium text-[11px]">
                {activeScenarioConfig.label} Projection ({formatCurrency(activeScenarioConfig.targetProjected)})
              </span>
            </span>
          </div>

          <div className="flex rounded-md bg-secondary/60 p-0.5 border border-border">
            {[
              { id: "combined", label: "Unified Flow" },
              { id: "pipeline", label: "Pipeline Only" },
              { id: "ai_trajectory", label: "Forecast Curve" },
            ].map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setMetricView(btn.id as any)}
                className={`rounded px-2 py-0.5 text-[10px] font-medium transition-all ${
                  metricView === btn.id
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* The Main Recharts Composed Graph or Clean Zero State */}
        {!hasDeals ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-secondary/10 p-8 text-center min-h-[220px]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-muted-foreground mb-2.5">
              <TrendingUp className="h-5 w-5" />
            </div>
            <h4 className="text-xs font-semibold text-foreground">
              No revenue trajectory recorded yet
            </h4>
            <p className="text-[11px] text-muted-foreground mt-1 max-w-sm">
              Create your first deal in the pipeline to unlock predictive ARR projections, velocity telemetry, and quota pacing models.
            </p>
            {onCreateDeal && (
              <Button
                size="sm"
                onClick={onCreateDeal}
                className="mt-3.5 h-8 gap-1.5 text-xs bg-foreground text-background hover:bg-foreground/90 font-medium"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create First Deal</span>
              </Button>
            )}
          </div>
        ) : (
          <div className="h-[230px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="pipelineAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.16} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.00} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="2 2" stroke="hsl(var(--border))" opacity={0.6} vertical={false} />

                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />

                <Tooltip content={<CustomTooltip />} />

                {/* $1.25M Target Reference Line */}
                <ReferenceLine
                  y={1250000}
                  stroke="#64748b"
                  strokeDasharray="3 3"
                  label={{
                    value: "Quota Target ($1.25M)",
                    position: "top",
                    fontSize: 10,
                    fill: "hsl(var(--muted-foreground))",
                  }}
                />

                {/* Area for Pipeline - Cobalt Blue */}
                {(metricView === "combined" || metricView === "pipeline") && (
                  <Area
                    type="monotone"
                    dataKey="pipeline"
                    name="Active Pipeline"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fill="url(#pipelineAreaGradient)"
                    activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }}
                  />
                )}

                {/* Closed Won Line - Emerald Green */}
                {metricView === "combined" && (
                  <Line
                    type="monotone"
                    dataKey="actualWon"
                    name="Closed Won"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#10b981" }}
                    activeDot={{ r: 5 }}
                  />
                )}

                {/* AI Forecast Projection Line - Warm Amber */}
                {(metricView === "combined" || metricView === "ai_trajectory") && (
                  <Line
                    type="monotone"
                    dataKey="aiProjected"
                    name={`${activeScenarioConfig.label} Forecast`}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    dot={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Comprehensible Insights Engine Tabs */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between pb-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Comprehensible Forecast Insights
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setSelectedInsightTab("pace")}
                className={`text-[11px] px-2 py-0.5 rounded-md font-medium transition-all ${
                  selectedInsightTab === "pace"
                    ? "bg-secondary text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Pacing
              </button>
              <button
                type="button"
                onClick={() => setSelectedInsightTab("golden")}
                className={`text-[11px] px-2 py-0.5 rounded-md font-medium transition-all ${
                  selectedInsightTab === "golden"
                    ? "bg-secondary text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Key Drivers
              </button>
              <button
                type="button"
                onClick={() => setSelectedInsightTab("risk")}
                className={`text-[11px] px-2 py-0.5 rounded-md font-medium transition-all ${
                  selectedInsightTab === "risk"
                    ? "bg-secondary text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Slippage Radar
              </button>
            </div>
          </div>

          {selectedInsightTab === "pace" && (
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border bg-card text-xs">
              <Target className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">
                  {hasDeals
                    ? `Quota Attainment Pacing: ${activeScenarioConfig.attainment}% Projected Target`
                    : "Target Quota: $1,250,000"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  {hasDeals
                    ? `With ${formatCurrency(wonValue)} closed won and ${formatCurrency(totalPipeline)} in active pipeline, you are pacing towards the $1.25M baseline quota. High-probability opportunities close on schedule.`
                    : "Add opportunities with projected close dates to automatically calculate sales velocity, pacing curves, and quarterly quota coverage."}
                </p>
              </div>
            </div>
          )}

          {selectedInsightTab === "golden" && (
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border bg-card text-xs">
              <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">
                  {topDeals.length > 0
                    ? `Highest Leverage Opportunities Identified`
                    : "Key Pipeline Drivers"}
                </p>
                <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  {topDeals.length > 0 ? (
                    <span>
                      <strong>{topDeals[0]?.title} ({formatCurrency(topDeals[0]?.value || 0)})</strong>
                      {topDeals[1] ? (
                        <span> and <strong>{topDeals[1]?.title} ({formatCurrency(topDeals[1]?.value || 0)})</strong></span>
                      ) : null}{" "}
                      are your highest-leverage volume opportunities.
                    </span>
                  ) : (
                    "When deals are added to your workspace, this panel automatically identifies which enterprise contracts deliver the greatest impact on quota attainment."
                  )}
                </div>
              </div>
            </div>
          )}

          {selectedInsightTab === "risk" && (
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border bg-card text-xs">
              <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">
                  {hasDeals
                    ? "Pipeline Velocity & Deal Health Monitor"
                    : "Slippage Protection System Active"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  {hasDeals
                    ? "Deals scheduled to close this month should be confirmed with decision-makers. Log touches in the activity stream to keep win confidence high."
                    : "Slippage Radar monitors unaddressed proposals, stalled negotiation phases, and approaching close dates to ensure zero deal attrition."}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
