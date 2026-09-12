import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  Cell,
} from "recharts";
import { format, startOfMonth, addMonths } from "date-fns";
import {
  TrendingUp,
  DollarSign,
  Target,
  BarChart3,
  Sparkles,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { PageBanner } from "@/components/PageBanner";
import { useAuth } from "@/contexts/AuthContext";
import { getDemoDeals } from "@/lib/demoData";
import { useNavigate } from "react-router-dom";

type ForecastScenario = "weighted" | "committed" | "best_case";

export default function Forecast() {
  const { isDemoMode } = useAuth();
  const navigate = useNavigate();
  const [scenario, setScenario] = useState<ForecastScenario>("weighted");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["forecast-page", isDemoMode],
    queryFn: async () => {
      let dealsList: any[] = [];

      if (!isDemoMode) {
        const { data: deals, error } = await supabase
          .from("deals")
          .select("id, title, value, probability, close_date, stage_id, companies(name)")
          .not("close_date", "is", null);

        if (!error && deals && deals.length > 0) {
          dealsList = deals.map((d: any) => ({
            id: d.id,
            title: d.title,
            value: Number(d.value) || 0,
            probability: Number(d.probability) || 50,
            close_date: d.close_date,
            company_name: d.companies?.name || "Enterprise Account",
            stage_name: d.probability >= 80 ? "Negotiation" : d.probability >= 50 ? "Proposal" : "Qualified",
          }));
        }
      }

      if (isDemoMode && dealsList.length === 0) {
        // Fallback to comprehensive 2026 demo deals strictly in demo mode
        const demo = getDemoDeals();
        dealsList = demo.map((d) => ({
          id: d.id,
          title: d.title,
          value: d.value,
          probability: d.probability,
          close_date: d.close_date,
          company_name: d.company_name,
          stage_name: d.stage_name,
        }));
      }

      // Group by upcoming months
      const months: Record<string, { total: number; weighted: number; committed: number; deals: any[] }> = {};
      const now = new Date();

      for (let i = 0; i < 4; i++) {
        const m = format(addMonths(startOfMonth(now), i), "yyyy-MM");
        months[m] = { total: 0, weighted: 0, committed: 0, deals: [] };
      }

      dealsList.forEach((d) => {
        const mKey = d.close_date ? d.close_date.substring(0, 7) : format(now, "yyyy-MM");
        if (!months[mKey]) {
          months[mKey] = { total: 0, weighted: 0, committed: 0, deals: [] };
        }
        const val = d.value;
        const prob = d.probability;
        months[mKey].total += val;
        months[mKey].weighted += Math.round((val * prob) / 100);
        if (prob >= 75) {
          months[mKey].committed += val;
        }
        months[mKey].deals.push(d);
      });

      const chartData = Object.entries(months)
        .slice(0, 5)
        .map(([mKey, mData]) => {
          let dateLabel = mKey;
          try {
            dateLabel = format(new Date(mKey + "-01"), "MMM yyyy");
          } catch (e) {
            dateLabel = mKey;
          }
          return {
            key: mKey,
            month: dateLabel,
            weighted: mData.weighted,
            committed: mData.committed,
            bestCase: mData.total,
            deals: mData.deals,
          };
        });

      const totalPipeline = dealsList.reduce((sum, d) => sum + d.value, 0);
      const totalWeighted = dealsList.reduce((sum, d) => sum + Math.round((d.value * d.probability) / 100), 0);
      const totalCommitted = dealsList.filter((d) => d.probability >= 75).reduce((sum, d) => sum + d.value, 0);
      const targetQuota = 1250000;
      const attainmentPct = Math.min(Math.round((totalWeighted / targetQuota) * 100), 100);

      return {
        dealsList,
        chartData,
        totalPipeline,
        totalWeighted,
        totalCommitted,
        targetQuota,
        attainmentPct,
      };
    },
  });

  const activeMonthData = selectedMonth
    ? data?.chartData.find((m) => m.key === selectedMonth)
    : data?.chartData[0];

  const summaryCards = [
    {
      label: "Weighted Forecast",
      value: formatCurrency(data?.totalWeighted || 0),
      subtext: "Probability-adjusted projection",
      icon: TrendingUp,
      color: "#2563eb",
    },
    {
      label: "Committed Revenue",
      value: formatCurrency(data?.totalCommitted || 0),
      subtext: "High-confidence deals (≥75%)",
      icon: ShieldCheck,
      color: "#10b981",
    },
    {
      label: "Best-Case Upside",
      value: formatCurrency(data?.totalPipeline || 0),
      subtext: "100% pipeline conversion",
      icon: Sparkles,
      color: "#8b5cf6",
    },
    {
      label: "Quota Attainment Pace",
      value: `${data?.attainmentPct || 0}% of Target`,
      subtext: "Target: $1.25M quota",
      icon: Target,
      color: "#f59e0b",
    },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <PageBanner
        title="Revenue Forecast Intelligence"
        description="Predictable ARR projections powered by deal velocity, historical cycle rates, and stage probability."
      />

      {/* Comprehensible Narrative Callout */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Goom ARR Forecast Intelligence
              </h3>
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-semibold">
                High Accuracy
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-3xl">
              {data?.totalPipeline && data.totalPipeline > 0 ? (
                <>
                  Based on your team's sales cycle and stage probability, expected revenue closure is <strong>{formatCurrency(data?.totalWeighted || 0)}</strong>. Focus follow-ups on high-confidence deals to close the remaining gap to the $1.25M quota.
                </>
              ) : (
                <>
                  Your forecast is ready to project ARR. Add deals with projected close dates and probabilities to unlock real-time revenue pacing, weighted forecasts, and quota attainment models.
                </>
              )}
            </p>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => navigate("/pipeline")}
          className="h-8 rounded-lg bg-foreground text-background hover:bg-foreground/90 text-xs font-semibold shrink-0 gap-1.5"
        >
          <span>View Pipeline Deals</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((s) => (
          <Card key={s.label} className="border border-border bg-card p-4 shadow-xs hover:border-foreground/30 transition-colors">
            <div className="flex items-center justify-between pb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {s.label}
              </span>
              <s.icon className="h-4 w-4" style={{ color: s.color }} />
            </div>
            <div className="mt-2">
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold tracking-tight text-foreground">
                  {s.value}
                </div>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">
                {s.subtext}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* Main Forecast Chart & Scenario Controller */}
      <Card className="border border-border bg-card shadow-xs overflow-hidden">
        <CardHeader className="pb-2 pt-4 px-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Monthly Revenue Projections
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Click any bar to inspect underlying deals and probability weighting
              </p>
            </div>

            {/* Model switch */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground font-medium hidden sm:inline">
                Forecast Lens:
              </span>
              <div className="flex rounded-lg bg-secondary p-0.5 border border-border">
                {[
                  { id: "weighted", label: "Weighted (Probable)" },
                  { id: "committed", label: "Committed (≥75%)" },
                  { id: "best_case", label: "Best Case (Full)" },
                ].map((sc) => (
                  <button
                    key={sc.id}
                    onClick={() => setScenario(sc.id as ForecastScenario)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                      scenario === sc.id
                        ? "bg-foreground text-background shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {sc.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-2 px-5 pb-5 space-y-4">
          <div className="h-[260px] w-full">
            {isLoading ? (
              <Skeleton className="h-full w-full rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data?.chartData}
                  margin={{ top: 12, right: 8, left: -16, bottom: 0 }}
                  onClick={(e: any) => {
                    if (e?.activePayload?.[0]?.payload?.key) {
                      setSelectedMonth(e.activePayload[0].payload.key);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="2 2" stroke="hsl(var(--border))" opacity={0.6} vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(val: number, name: string) => [formatCurrency(val), name]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "0.75rem",
                      fontSize: "12px",
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />

                  {scenario === "weighted" && (
                    <Bar
                      dataKey="weighted"
                      name="Weighted ARR"
                      fill="#2563eb"
                      radius={[6, 6, 0, 0]}
                    />
                  )}
                  {scenario === "committed" && (
                    <Bar
                      dataKey="committed"
                      name="Committed ARR"
                      fill="#10b981"
                      radius={[6, 6, 0, 0]}
                    />
                  )}
                  {scenario === "best_case" && (
                    <Bar
                      dataKey="bestCase"
                      name="Best Case Pipeline"
                      fill="#8b5cf6"
                      radius={[6, 6, 0, 0]}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Month Deals Deep Dive */}
          {activeMonthData && (
            <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-foreground" />
                  <span className="text-xs font-bold text-foreground">
                    {activeMonthData.month} Pipeline Drivers ({activeMonthData.deals?.length || 0} Deals)
                  </span>
                </div>
                <span className="text-xs font-semibold text-foreground">
                  Weighted: {formatCurrency(activeMonthData.weighted)} • Total: {formatCurrency(activeMonthData.bestCase)}
                </span>
              </div>

              {activeMonthData.deals && activeMonthData.deals.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {activeMonthData.deals.map((deal: any) => (
                    <div
                      key={deal.id}
                      onClick={() => navigate(`/pipeline?open=${deal.id}`)}
                      className="p-3 rounded-lg border border-border bg-card hover:bg-secondary/70 transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-foreground hover:underline">
                            {deal.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {deal.company_name}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1.5 py-0 font-semibold ${
                            deal.probability >= 80
                              ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                              : deal.probability >= 50
                              ? "border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10"
                              : "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                          }`}
                        >
                          {deal.probability}% Prob
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between pt-2 mt-2 border-t border-border/70 text-xs">
                        <span className="text-[11px] text-muted-foreground">
                          Stage: <strong>{deal.stage_name}</strong>
                        </span>
                        <span className="font-bold text-foreground">
                          {formatCurrency(deal.value)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-2 text-center">
                  No deals scheduled for this month.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
