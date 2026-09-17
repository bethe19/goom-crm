import React, { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Brand } from "@/components/Brand";
import { useToast } from "@/hooks/use-toast";
import {
  CircleDollarSign,
  UsersRound,
  BarChart3,
  Search,
  Plus,
  ArrowRight,
  Zap,
  Mail,
  FileText,
  LayoutDashboard,
  X,
  TrendingUp,
  DollarSign,
  Target,
  Clock,
  Sparkles,
  CheckSquare,
  PhoneCall,
  UserPlus,
  Activity,
  Bell,
  Bot,
  Send,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export type TourTab = "dashboard" | "pipeline" | "contacts" | "insights";

interface Deal {
  id: string;
  company: string;
  contact: string;
  value: number;
  stage: "lead" | "qualified" | "proposal" | "closing";
  daysInStage: number;
  probability: number;
}

interface ContactItem {
  id: string;
  name: string;
  company: string;
  email: string;
  status: "Customer" | "Lead" | "Partner";
  value: string;
  lastActive: string;
  initials: string;
}

const INITIAL_DEALS: Deal[] = [
  { id: "d1", company: "Northstar Labs", contact: "Maya Chen", value: 42000, stage: "lead", daysInStage: 3, probability: 20 },
  { id: "d2", company: "Arc Systems", contact: "Noah Williams", value: 28500, stage: "lead", daysInStage: 7, probability: 20 },
  { id: "d3", company: "Harbor & Co.", contact: "Sofia Miller", value: 64000, stage: "qualified", daysInStage: 5, probability: 45 },
  { id: "d4", company: "Orchid Health", contact: "Theo Martin", value: 36800, stage: "proposal", daysInStage: 2, probability: 70 },
  { id: "d5", company: "Atlas Works", contact: "Amara Davis", value: 51200, stage: "closing", daysInStage: 1, probability: 90 },
  { id: "d6", company: "Cedar Finance", contact: "Jin Park", value: 87500, stage: "closing", daysInStage: 4, probability: 85 },
];

const CLOSING_SOON = [
  { company: "Atlas Works", contact: "Amara Davis", value: "$51,200", daysLeft: 2, prob: 90, dot: "bg-emerald-500" },
  { company: "Cedar Finance", contact: "Jin Park", value: "$87,500", daysLeft: 4, prob: 85, dot: "bg-emerald-500" },
  { company: "Orchid Health", contact: "Theo Martin", value: "$36,800", daysLeft: 6, prob: 70, dot: "bg-amber-500" },
];

const FUNNEL_STAGES_DATA = [
  { name: "New Lead", count: 2, value: 70500, pct: 100, color: "bg-blue-500", dot: "bg-blue-500" },
  { name: "Qualified", count: 1, value: 64000, pct: 65, color: "bg-sky-500", dot: "bg-sky-500" },
  { name: "Proposal", count: 1, value: 36800, pct: 40, color: "bg-amber-500", dot: "bg-amber-500" },
  { name: "Closing", count: 2, value: 138700, pct: 25, color: "bg-emerald-500", dot: "bg-emerald-500" },
];

const RECENT_ACTIVITY_DATA = [
  { icon: CircleDollarSign, color: "text-blue-500", bg: "bg-blue-500/10", action: "Deal advanced", detail: "Atlas Works \u2192 Closing", time: "4m ago" },
  { icon: UserPlus, color: "text-emerald-500", bg: "bg-emerald-500/10", action: "Contact added", detail: "Jin Park @ Cedar Finance", time: "18m ago" },
  { icon: PhoneCall, color: "text-amber-500", bg: "bg-amber-500/10", action: "Call logged", detail: "30 min with Sofia Miller", time: "1h ago" },
  { icon: CheckSquare, color: "text-violet-500", bg: "bg-violet-500/10", action: "Task completed", detail: "Send proposal to Orchid Health", time: "2h ago" },
];

const AI_INITIAL_MESSAGES = [
  { from: "ai", text: "\uD83D\uDC4B Hey Alex! 2 deals closing this week worth $138.7K. Atlas Works at 90% probability \u2014 want me to draft a follow-up?" },
  { from: "user", text: "Yes, draft one for Atlas Works please." },
  { from: "ai", text: "\uD83D\uDCE7 Done! Sent to Amara Davis. Also flagged Harbor & Co. as at-risk (no activity in 5 days)." },
];

const INITIAL_CONTACTS: ContactItem[] = [
  { id: "c1", name: "Maya Chen", company: "Northstar Labs", email: "maya@northstar.io", status: "Lead", value: "$42,000", lastActive: "2h ago", initials: "MC" },
  { id: "c2", name: "Sofia Miller", company: "Harbor & Co.", email: "sofia@harbor.co", status: "Customer", value: "$64,000", lastActive: "Yesterday", initials: "SM" },
  { id: "c3", name: "Noah Williams", company: "Arc Systems", email: "noah@arcsys.com", status: "Lead", value: "$28,500", lastActive: "3d ago", initials: "NW" },
  { id: "c4", name: "Amara Davis", company: "Atlas Works", email: "amara@atlas.works", status: "Customer", value: "$51,200", lastActive: "Just now", initials: "AD" },
  { id: "c5", name: "Theo Martin", company: "Orchid Health", email: "theo@orchidhealth.org", status: "Partner", value: "$36,800", lastActive: "5h ago", initials: "TM" },
  { id: "c6", name: "Jin Park", company: "Cedar Finance", email: "jin@cedarfin.com", status: "Customer", value: "$87,500", lastActive: "1h ago", initials: "JP" },
];

const QUARTER_DATA = {
  Q1: { target: "$320k", actual: "$342,000", winRate: "34.5%", velocity: "18 days", bars: [45, 52, 60, 48, 70, 65, 80, 88], growth: "+8.2%" },
  Q2: { target: "$350k", actual: "$380,500", winRate: "37.1%", velocity: "16 days", bars: [50, 62, 58, 75, 70, 85, 82, 94], growth: "+11.2%" },
  Q3: { target: "$380k", actual: "$412,800", winRate: "39.8%", velocity: "14 days", bars: [55, 68, 64, 82, 78, 90, 86, 98], growth: "+8.5%" },
  Q4: { target: "$420k", actual: "$456,200", winRate: "42.3%", velocity: "13 days", bars: [60, 72, 75, 88, 85, 96, 92, 100], growth: "+10.5%" },
};

export function ProductTour() {
  const [activeTab, setActiveTab] = useState<TourTab>("dashboard");
  const [deals, setDeals] = useState<Deal[]>(INITIAL_DEALS);
  const [contacts] = useState<ContactItem[]>(INITIAL_CONTACTS);
  const [dealSearch, setDealSearch] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [contactFilter, setContactFilter] = useState<string>("All");
  const [activeQuarter, setActiveQuarter] = useState<keyof typeof QUARTER_DATA>("Q3");
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const [showAddDealModal, setShowAddDealModal] = useState(false);
  const [newCompany, setNewCompany] = useState("");
  const [newContact, setNewContact] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newStage, setNewStage] = useState<Deal["stage"]>("lead");
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState(AI_INITIAL_MESSAGES);
  const [aiTyping, setAiTyping] = useState(false);
  const [animatedPipeline, setAnimatedPipeline] = useState(0);

  const { toast } = useToast();

  const totalPipelineValue = deals.reduce((s, d) => s + d.value, 0);

  useEffect(() => {
    if (activeTab !== "dashboard") return;
    const target = totalPipelineValue;
    let start = 0;
    const step = target / 40;
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setAnimatedPipeline(target); clearInterval(timer); }
      else setAnimatedPipeline(Math.round(start));
    }, 18);
    return () => clearInterval(timer);
  }, [activeTab]);

  const handleAiSend = () => {
    if (!aiInput.trim()) return;
    const msg = aiInput.trim();
    setAiMessages(prev => [...prev, { from: "user", text: msg }]);
    setAiInput("");
    setAiTyping(true);
    setTimeout(() => {
      setAiMessages(prev => [...prev, { from: "ai", text: "\u2705 Got it! I've analyzed your pipeline. Harbor & Co. also has a $64K deal stalled \u2014 I recommend a re-engagement this week." }]);
      setAiTyping(false);
    }, 1200);
  };

  // Filter deals
  const filteredDeals = useMemo(() => {
    if (!dealSearch.trim()) return deals;
    const q = dealSearch.toLowerCase();
    return deals.filter(
      (d) => d.company.toLowerCase().includes(q) || d.contact.toLowerCase().includes(q)
    );
  }, [deals, dealSearch]);

  // Advance deal stage
  const advanceDeal = (id: string) => {
    setDeals((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        const stageOrder: Deal["stage"][] = ["lead", "qualified", "proposal", "closing"];
        const currIndex = stageOrder.indexOf(d.stage);
        const nextStage = stageOrder[(currIndex + 1) % stageOrder.length];
        return { ...d, stage: nextStage };
      })
    );
    toast({
      title: "Deal Stage Updated",
      description: "Deal moved forward in your sales pipeline.",
    });
  };

  const handleAddDealSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany.trim()) return;

    const valNum = parseInt(newValue.replace(/[^0-9]/g, ""), 10) || 25000;
    const newDealItem: Deal = {
      id: `d_${Date.now()}`,
      company: newCompany.trim(),
      contact: newContact.trim() || "Lead Contact",
      value: valNum,
      stage: newStage,
    };

    setDeals((prev) => [newDealItem, ...prev]);
    setNewCompany("");
    setNewContact("");
    setNewValue("");
    setShowAddDealModal(false);
    toast({
      title: "Deal Added",
      description: `${newDealItem.company} added to ${newDealItem.stage} stage.`,
    });
  };

  // Filter contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      const matchesSearch =
        !contactSearch.trim() ||
        c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
        c.company.toLowerCase().includes(contactSearch.toLowerCase()) ||
        c.email.toLowerCase().includes(contactSearch.toLowerCase());
      const matchesStatus = contactFilter === "All" || c.status === contactFilter;
      return matchesSearch && matchesStatus;
    });
  }, [contacts, contactSearch, contactFilter]);

  const stages: { id: Deal["stage"]; name: string; dot: string }[] = [
    { id: "lead", name: "New Lead", dot: "bg-blue-500" },
    { id: "qualified", name: "Qualified", dot: "bg-sky-500" },
    { id: "proposal", name: "Proposal", dot: "bg-amber-500" },
    { id: "closing", name: "Closing", dot: "bg-emerald-500" },
  ];

  const tourTabs = [
    { id: "dashboard" as TourTab, label: "Dashboard", icon: LayoutDashboard, desc: "Executive overview with KPIs, charts & AI copilot" },
    { id: "pipeline" as TourTab, label: "Sales Pipeline", icon: CircleDollarSign, desc: "Kanban board with deal cards and stage advancement" },
    { id: "contacts" as TourTab, label: "Contacts & CRM", icon: UsersRound, desc: "Customer & lead directory with activity tracking" },
    { id: "insights" as TourTab, label: "Revenue Insights", icon: BarChart3, desc: "Quarterly analytics, win rates & conversion funnel" },
  ];

  const formatCurrency = (val: number) => `$${val.toLocaleString()}`;

  return (
    <div className="w-full">
      {/* Tab Switchers */}
      <div className="mb-5 flex flex-wrap justify-center gap-2 text-xs font-medium" role="tablist">
        {tourTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              title={tab.desc}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 transition-all cursor-pointer select-none ${
                isActive
                  ? "border-foreground bg-foreground text-background shadow-xs font-semibold"
                  : "border-border/80 bg-background text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>
      <p className="text-center text-xs text-muted-foreground mb-5">
        {tourTabs.find(t => t.id === activeTab)?.desc}
      </p>

      {/* Product Window Mockup */}
      <div className="relative mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_20px_60px_hsl(var(--foreground)/0.06)] transition-all">
          {/* Top Browser Bar */}
          <div className="flex h-11 items-center justify-between border-b border-border bg-secondary/50 px-4">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
            </div>
            <div className="rounded-md border border-border/70 bg-background px-7 py-1 text-[11px] font-mono text-muted-foreground shadow-xs">
              app.goom.io/{activeTab === "dashboard" ? "dashboard" : activeTab === "pipeline" ? "pipeline" : activeTab === "contacts" ? "contacts" : "reports"}
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">Live preview</span>
            </div>
          </div>

          <div className="flex h-[520px] sm:h-[580px] lg:h-[640px]">
            {/* Mockup Sidebar */}
            <aside className="hidden w-52 shrink-0 border-r border-border bg-secondary/25 p-4 md:flex md:flex-col">
              <div className="mb-6 flex items-center gap-2.5 px-2">
                <Brand size="sm" showText={false} />
                <span className="text-sm font-semibold tracking-tight text-foreground">Goom CRM</span>
              </div>

              <div className="space-y-1">
                {[
                  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, targetTab: "dashboard" as TourTab },
                  { id: "pipeline", label: "Pipeline", icon: CircleDollarSign, targetTab: "pipeline" as TourTab },
                  { id: "contacts", label: "Contacts", icon: UsersRound, targetTab: "contacts" as TourTab },
                  { id: "reports", label: "Reports", icon: BarChart3, targetTab: "insights" as TourTab },
                ].map(({ id, label, icon: NavIcon, targetTab }) => {
                  const isActive = activeTab === targetTab || (id === "dashboard" && activeTab === "dashboard");
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActiveTab(targetTab)}
                      className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all text-left cursor-pointer ${
                        isActive
                          ? "bg-foreground text-background shadow-xs font-semibold"
                          : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                      }`}
                    >
                      <NavIcon className="h-4 w-4 shrink-0" />
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 pt-4 border-t border-border/60 space-y-1">
                <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Quick actions</p>
                {[
                  { label: "New Deal", icon: Plus },
                  { label: "Add Contact", icon: UserPlus },
                  { label: "Log Activity", icon: PhoneCall },
                ].map(({ label, icon: Icon }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toast({ title: label, description: "Opens the creation dialog in the real app." })}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary/70 hover:text-foreground transition-all text-left cursor-pointer"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-auto border-t border-border pt-4 px-1">
                <div className="flex items-center gap-2 px-2">
                  <div className="h-7 w-7 rounded-full bg-foreground text-background flex items-center justify-center font-semibold text-[10px]">AV</div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">Alex Vance</p>
                    <p className="text-[10px] text-muted-foreground/70">Goom Global · Admin</p>
                  </div>
                </div>
              </div>
            </aside>

            {/* Main Viewport */}
            <div className="min-w-0 flex-1 bg-background overflow-y-auto">

              {/* ─── DASHBOARD TAB ─── */}
              {activeTab === "dashboard" && (
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-border/60">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold tracking-tight text-foreground">Dashboard</h3>
                        <span className="text-[10px] font-semibold border border-border bg-secondary text-foreground px-2 py-0.5 rounded-full">Q3 2026</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{deals.length} active deals · ${(totalPipelineValue / 1000).toFixed(0)}K pipeline · Pacing at 82%</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => toast({ title: "New Deal", description: "Create deal dialog opens instantly in the real app." })} className="flex items-center gap-1 h-7 px-2.5 rounded-lg bg-foreground text-background text-[11px] font-medium hover:bg-foreground/90 transition-colors">
                        <Plus className="h-3 w-3" /> New Deal
                      </button>
                      <button type="button" className="h-7 w-7 flex items-center justify-center rounded-lg border border-border hover:bg-secondary transition-colors">
                        <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>

                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { label: "Active Pipeline", value: `$${(animatedPipeline / 1000).toFixed(0)}K`, delta: "+22.4% vs last month", icon: DollarSign, accent: "text-blue-500" },
                      { label: "Deals in Motion", value: `${deals.length}`, delta: "Active & tracked", icon: Target, accent: "text-sky-500" },
                      { label: "Win Rate", value: "39.8%", delta: "+4.2% YoY pace", icon: TrendingUp, accent: "text-emerald-500" },
                      { label: "Avg Sales Cycle", value: "14 days", delta: "52% faster than avg", icon: Clock, accent: "text-amber-500" },
                    ].map(stat => (
                      <div key={stat.label} className="rounded-lg border border-border bg-card p-3 shadow-xs hover:border-foreground/20 transition-all">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</span>
                          <stat.icon className={`h-3.5 w-3.5 ${stat.accent}`} />
                        </div>
                        <p className="text-xl font-bold tracking-tight text-foreground">{stat.value}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{stat.delta}</p>
                      </div>
                    ))}
                  </div>

                  {/* 2-col content */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                    <div className="lg:col-span-7 space-y-3">
                      {/* Revenue Trend */}
                      <div className="rounded-lg border border-border bg-card p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-xs font-semibold text-foreground">Revenue Trend</p>
                            <p className="text-[11px] text-muted-foreground">Monthly closed revenue — FY 2026</p>
                          </div>
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5">
                            <TrendingUp className="h-3 w-3" /> +8.5%
                          </span>
                        </div>
                        <div className="flex items-end gap-1.5 h-24 border-b border-border/60 pb-1">
                          {[42, 55, 48, 68, 61, 78, 72, 88, 82, 95, 91, 100].map((h, i) => (
                            <div key={i} className={`flex-1 rounded-t transition-all duration-300 cursor-pointer ${i >= 9 ? "bg-foreground" : "bg-foreground/20 hover:bg-foreground/40"}`} style={{ height: `${h}%` }} />
                          ))}
                        </div>
                        <div className="flex justify-between mt-1">
                          {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map(m => (
                            <span key={m} className="text-[9px] text-muted-foreground/60 text-center flex-1">{m}</span>
                          ))}
                        </div>
                      </div>

                      {/* Pipeline Funnel */}
                      <div className="rounded-lg border border-border bg-card p-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-semibold text-foreground">Pipeline Funnel</p>
                          <span className="text-[11px] text-muted-foreground">{deals.length} total deals</span>
                        </div>
                        <div className="space-y-2.5">
                          {FUNNEL_STAGES_DATA.map(stage => (
                            <div key={stage.name}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className={`h-2 w-2 rounded-full ${stage.dot}`} />
                                  <span className="text-[11px] font-medium text-foreground">{stage.name}</span>
                                  <span className="text-[10px] text-muted-foreground">{stage.count} deals</span>
                                </div>
                                <span className="text-[11px] font-mono font-medium text-foreground">{formatCurrency(stage.value)}</span>
                              </div>
                              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                                <div className={`h-full rounded-full ${stage.color} transition-all duration-700`} style={{ width: `${stage.pct}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-5 space-y-3">
                      {/* Closing Soon */}
                      <div className="rounded-lg border border-border bg-card p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <AlertCircle className="h-3.5 w-3.5 text-amber-500" /> Closing This Week
                          </p>
                          <span className="text-[10px] text-muted-foreground">{CLOSING_SOON.length} deals</span>
                        </div>
                        <div className="space-y-2">
                          {CLOSING_SOON.map((deal, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer" onClick={() => toast({ title: deal.company, description: `${deal.value} · ${deal.prob}% probability · ${deal.daysLeft}d remaining` })}>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`h-2 w-2 rounded-full shrink-0 ${deal.dot}`} />
                                <div className="min-w-0">
                                  <p className="text-[11px] font-semibold text-foreground truncate">{deal.company}</p>
                                  <p className="text-[10px] text-muted-foreground">{deal.contact}</p>
                                </div>
                              </div>
                              <div className="text-right shrink-0 ml-2">
                                <p className="text-[11px] font-mono font-semibold text-foreground">{deal.value}</p>
                                <p className="text-[10px] text-muted-foreground">{deal.daysLeft}d · {deal.prob}%</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Recent Activity */}
                      <div className="rounded-lg border border-border bg-card p-3">
                        <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                          <Activity className="h-3.5 w-3.5 text-blue-500" /> Recent Activity
                        </p>
                        <div className="space-y-2">
                          {RECENT_ACTIVITY_DATA.map((item, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <div className={`h-6 w-6 rounded-md flex items-center justify-center ${item.bg} shrink-0`}>
                                <item.icon className={`h-3 w-3 ${item.color}`} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-medium text-foreground">{item.action}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{item.detail}</p>
                              </div>
                              <span className="text-[9px] text-muted-foreground/60 shrink-0">{item.time}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* AI Copilot */}
                      <div className="rounded-lg border border-border bg-card p-3 flex flex-col" style={{ minHeight: 172 }}>
                        <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                          <Bot className="h-3.5 w-3.5" />
                          <Sparkles className="h-3 w-3 text-amber-400" />
                          AI Copilot
                        </p>
                        <div className="flex-1 space-y-2 overflow-y-auto mb-2" style={{ maxHeight: 100 }}>
                          {aiMessages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}>
                              <div className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-[10px] leading-relaxed ${msg.from === "ai" ? "bg-secondary text-foreground" : "bg-foreground text-background"}`}>
                                {msg.text}
                              </div>
                            </div>
                          ))}
                          {aiTyping && (
                            <div className="flex justify-start">
                              <div className="bg-secondary rounded-lg px-3 py-2 flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 border-t border-border pt-2">
                          <input
                            type="text"
                            value={aiInput}
                            onChange={e => setAiInput(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleAiSend()}
                            placeholder="Ask Copilot anything..."
                            className="flex-1 text-[11px] bg-secondary rounded-md px-2.5 py-1.5 border border-border outline-none focus:border-foreground/30 placeholder:text-muted-foreground/60"
                          />
                          <button type="button" onClick={handleAiSend} className="h-7 w-7 flex items-center justify-center rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors">
                            <Send className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── PIPELINE TAB ─── */}
              {activeTab === "pipeline" && (
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Deals Management</p>
                      <h3 className="text-base font-bold tracking-tight text-foreground">Sales Pipeline</h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{deals.length} deals · {formatCurrency(deals.reduce((s,d)=>s+d.value,0))} total value</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative w-full sm:w-48">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          value={dealSearch}
                          onChange={(e) => setDealSearch(e.target.value)}
                          placeholder="Search deals..."
                          className="h-8 pl-8 text-xs rounded-lg border-border bg-secondary/20"
                        />
                        {dealSearch && (
                          <button
                            onClick={() => setDealSearch("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setShowAddDealModal(true)}
                        className="h-8 rounded-lg bg-foreground text-background text-xs font-medium hover:bg-foreground/90 gap-1.5 shadow-xs"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add deal
                      </Button>
                    </div>
                  </div>

                  {/* Stage value summary bar */}
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/20 px-3 py-2">
                    {stages.map(st => {
                      const stDeals = filteredDeals.filter(d => d.stage === st.id);
                      const stVal = stDeals.reduce((s, d) => s + d.value, 0);
                      const ttl = deals.reduce((s, d) => s + d.value, 0);
                      const pct = ttl > 0 ? (stVal / ttl) * 100 : 0;
                      return (
                        <div key={st.id} className="flex-1 text-center">
                          <div className="text-[10px] font-medium text-muted-foreground mb-1">{st.name}</div>
                          <div className="h-1.5 rounded-full bg-border overflow-hidden">
                            <div className={`h-full rounded-full ${st.dot}`} style={{ width: `${pct}%` }} />
                          </div>
                          <div className="text-[10px] font-mono text-foreground mt-1">{stDeals.length} · {formatCurrency(stVal)}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add Deal Modal */}
                  {showAddDealModal && (
                    <form
                      onSubmit={handleAddDealSubmit}
                      className="p-3.5 rounded-lg border border-border bg-secondary/40 space-y-3 animate-in fade-in duration-150"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">Quick Add Deal</span>
                        <button
                          type="button"
                          onClick={() => setShowAddDealModal(false)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                        <Input
                          placeholder="Company name *"
                          value={newCompany}
                          onChange={(e) => setNewCompany(e.target.value)}
                          required
                          className="h-8 text-xs rounded-md bg-background"
                        />
                        <Input
                          placeholder="Contact person"
                          value={newContact}
                          onChange={(e) => setNewContact(e.target.value)}
                          className="h-8 text-xs rounded-md bg-background"
                        />
                        <Input
                          placeholder="Deal value (e.g. $35,000)"
                          value={newValue}
                          onChange={(e) => setNewValue(e.target.value)}
                          className="h-8 text-xs rounded-md bg-background"
                        />
                        <select
                          value={newStage}
                          onChange={(e) => setNewStage(e.target.value as Deal["stage"])}
                          className="h-8 text-xs rounded-md border border-border bg-background px-2"
                        >
                          <option value="lead">New lead</option>
                          <option value="qualified">Qualified</option>
                          <option value="proposal">Proposal</option>
                          <option value="closing">Closing</option>
                        </select>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowAddDealModal(false)}
                          className="h-7 text-xs"
                        >
                          Cancel
                        </Button>
                        <Button type="submit" size="sm" className="h-7 text-xs bg-foreground text-background">
                          Create deal
                        </Button>
                      </div>
                    </form>
                  )}

                  {/* Columns */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {stages.map((st) => {
                      const colDeals = filteredDeals.filter((d) => d.stage === st.id);
                      const colTotal = colDeals.reduce((sum, d) => sum + d.value, 0);

                      return (
                        <div key={st.id} className="rounded-lg border border-border/70 bg-secondary/20 p-2.5 flex flex-col">
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/50">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                              <span className="text-xs font-semibold text-foreground truncate">{st.name}</span>
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded border border-border/50">
                              {colDeals.length} • {formatCurrency(colTotal)}
                            </span>
                          </div>

                          <div className="space-y-2 flex-1 min-h-[220px]">
                            {colDeals.map((deal) => (
                              <div
                                key={deal.id}
                                className="group rounded-lg border border-border bg-card p-3 text-left shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                                onClick={() => toast({ title: deal.company, description: `${deal.contact} · ${formatCurrency(deal.value)} · ${deal.probability}% probability` })}
                              >
                                <div className="flex items-start justify-between gap-1 mb-1">
                                  <p className="text-xs font-semibold text-foreground truncate">{deal.company}</p>
                                  <span className={`h-1.5 w-1.5 rounded-full ${st.dot} shrink-0 mt-1`} />
                                </div>
                                <p className="text-[11px] text-muted-foreground truncate">{deal.contact}</p>
                                <div className="mt-1.5 h-1 rounded-full bg-border overflow-hidden">
                                  <div className={`h-full rounded-full ${st.dot} opacity-70`} style={{ width: `${deal.probability}%` }} />
                                </div>
                                <div className="mt-2 flex items-center justify-between pt-1.5 border-t border-border/50">
                                  <span className="text-xs font-semibold font-mono text-foreground">
                                    {formatCurrency(deal.value)}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[9px] text-muted-foreground">{deal.daysInStage}d</span>
                                    <button
                                      type="button"
                                      onClick={e => { e.stopPropagation(); advanceDeal(deal.id); }}
                                      title="Advance to next stage"
                                      className="opacity-70 group-hover:opacity-100 hover:text-foreground text-[10px] font-medium text-muted-foreground flex items-center gap-0.5 bg-secondary/80 px-1.5 py-0.5 rounded transition-colors"
                                    >
                                      Move <ArrowRight className="h-2.5 w-2.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}

                            {colDeals.length === 0 && (
                              <div className="h-24 rounded-lg border border-dashed border-border/70 flex items-center justify-center text-[11px] text-muted-foreground/60">
                                No deals in stage
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ─── CONTACTS TAB ─── */}
              {activeTab === "contacts" && (
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">CRM Directory</p>
                      <h3 className="text-base font-bold tracking-tight text-foreground">Contacts & Accounts</h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{contacts.length} contacts · sorted by recent activity</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative w-full sm:w-48">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          value={contactSearch}
                          onChange={(e) => setContactSearch(e.target.value)}
                          placeholder="Search contacts..."
                          className="h-8 pl-8 text-xs rounded-lg border-border bg-secondary/20"
                        />
                      </div>
                      <div className="flex border border-border rounded-lg p-0.5 bg-secondary/30 text-xs">
                        {["All", "Customer", "Lead", "Partner"].map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setContactFilter(st)}
                            className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                              contactFilter === st ? "bg-background text-foreground shadow-2xs font-semibold" : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Contacts Table */}
                  <div className="rounded-lg border border-border overflow-hidden bg-card">
                    <div className="grid grid-cols-12 bg-secondary/40 px-3 py-2 text-[11px] font-semibold text-muted-foreground border-b border-border">
                      <div className="col-span-4">Contact</div>
                      <div className="col-span-3">Company</div>
                      <div className="col-span-2">Status</div>
                      <div className="col-span-2 text-right">Deal Value</div>
                      <div className="col-span-1 text-center">Act.</div>
                    </div>

                    <div className="divide-y divide-border/60">
                      {filteredContacts.map((c) => (
                        <div
                          key={c.id}
                          className="grid grid-cols-12 items-center px-3 py-2.5 text-xs hover:bg-secondary/20 transition-colors cursor-pointer"
                          onClick={() => toast({ title: c.name, description: `${c.email} · ${c.company} · Active ${c.lastActive}` })}
                        >
                          <div className="col-span-4 flex items-center gap-2.5 min-w-0 pr-2">
                            <div className="h-7 w-7 rounded-full bg-foreground text-background flex items-center justify-center font-semibold text-[10px] shrink-0">
                              {c.initials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground truncate">{c.name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{c.email}</p>
                            </div>
                          </div>

                          <div className="col-span-3 text-muted-foreground truncate pr-2">
                            {c.company}
                          </div>

                          <div className="col-span-2">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium border border-border bg-background">
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  c.status === "Customer"
                                    ? "bg-emerald-500"
                                    : c.status === "Lead"
                                    ? "bg-blue-500"
                                    : "bg-zinc-500"
                                }`}
                              />
                              {c.status}
                            </span>
                          </div>

                          <div className="col-span-2 text-right font-mono font-medium text-foreground">
                            {c.value}
                          </div>

                          <div className="col-span-1 flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => toast({ title: "Email Composer", description: `Drafting email to ${c.name}` })}
                              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                              title="Send email"
                            >
                              <Mail className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toast({ title: "Quick Note", description: `Added note for ${c.company}` })}
                              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                              title="Add note"
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/20 p-3 flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      <span className="font-semibold text-foreground">Click any contact</span> to open their full record — deal history, logged calls, emails, notes, and upcoming tasks, all in one panel.
                    </p>
                  </div>
                </div>
              )}

              {/* ─── INSIGHTS TAB ─── */}
              {activeTab === "insights" && (
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Analytics & Forecast</p>
                      <h3 className="text-base font-bold tracking-tight text-foreground">Revenue Insights</h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Quarterly breakdown · updated from live pipeline</p>
                    </div>
                    <div className="flex items-center border border-border rounded-lg p-0.5 bg-secondary/30 text-xs">
                      {(["Q1", "Q2", "Q3", "Q4"] as (keyof typeof QUARTER_DATA)[]).map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setActiveQuarter(q)}
                          className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                            activeQuarter === q ? "bg-background text-foreground shadow-2xs font-semibold" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Metric Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-lg border border-border bg-card hover:border-foreground/20 transition-all">
                      <p className="text-[11px] text-muted-foreground font-medium">Revenue Target</p>
                      <p className="text-xl font-bold mt-1 text-foreground">{QUARTER_DATA[activeQuarter].target}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Quota set for {activeQuarter}</p>
                    </div>
                    <div className="p-3.5 rounded-lg border border-border bg-card hover:border-foreground/20 transition-all">
                      <p className="text-[11px] text-muted-foreground font-medium">Actual Closed</p>
                      <p className="text-xl font-bold mt-1 text-foreground">{QUARTER_DATA[activeQuarter].actual}</p>
                      <div className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 mt-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Pacing 108% of plan
                      </div>
                    </div>
                    <div className="p-3.5 rounded-lg border border-border bg-card hover:border-foreground/20 transition-all">
                      <p className="text-[11px] text-muted-foreground font-medium">Win Rate</p>
                      <p className="text-xl font-bold mt-1 text-foreground">{QUARTER_DATA[activeQuarter].winRate}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">+4.2% vs prior quarter</p>
                    </div>
                    <div className="p-3.5 rounded-lg border border-border bg-card hover:border-foreground/20 transition-all">
                      <p className="text-[11px] text-muted-foreground font-medium">Sales Velocity</p>
                      <p className="text-xl font-bold mt-1 text-foreground">{QUARTER_DATA[activeQuarter].velocity}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Avg. days to close</p>
                    </div>
                  </div>

                  {/* Chart */}
                  <div className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <span className="text-xs font-semibold text-foreground">Weekly Revenue Trend — {activeQuarter}</span>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Hover bars for weekly breakdown</p>
                      </div>
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5">
                        <TrendingUp className="h-3 w-3" /> {QUARTER_DATA[activeQuarter].growth}
                      </span>
                    </div>

                    <div className="flex items-end gap-2.5 sm:gap-4 h-40 pt-6 border-b border-border/80">
                      {QUARTER_DATA[activeQuarter].bars.map((height, i) => {
                        const isHovered = hoveredBarIndex === i;
                        const valueLabel = `$${Math.round((height / 100) * 85000).toLocaleString()}`;

                        return (
                          <div
                            key={i}
                            className="relative flex-1 h-full flex flex-col justify-end group cursor-pointer"
                            onMouseEnter={() => setHoveredBarIndex(i)}
                            onMouseLeave={() => setHoveredBarIndex(null)}
                          >
                            {isHovered && (
                              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] font-mono py-0.5 px-1.5 rounded shadow-sm whitespace-nowrap z-10">
                                W{i + 1}: {valueLabel}
                              </div>
                            )}
                            <div
                              className={`w-full rounded-t transition-all duration-200 ${
                                isHovered ? "bg-foreground" : "bg-foreground/20 group-hover:bg-foreground/50"
                              }`}
                              style={{ height: `${height}%` }}
                            />
                            <span className="text-[9px] text-muted-foreground text-center mt-1 font-mono">
                              W{i + 1}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Stage Conversion */}
                  <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-xs font-semibold text-foreground mb-3">Stage Conversion Analysis</p>
                    <div className="space-y-2.5">
                      {[
                        { from: "Lead \u2192 Qualified", rate: "68%", color: "bg-blue-500" },
                        { from: "Qualified \u2192 Proposal", rate: "52%", color: "bg-sky-500" },
                        { from: "Proposal \u2192 Closing", rate: "71%", color: "bg-amber-500" },
                        { from: "Closing \u2192 Won", rate: "89%", color: "bg-emerald-500" },
                      ].map(conv => (
                        <div key={conv.from} className="flex items-center gap-3">
                          <span className="text-[11px] text-muted-foreground w-36 shrink-0">{conv.from}</span>
                          <div className="flex-1 h-2 rounded-full bg-border overflow-hidden">
                            <div className={`h-full rounded-full ${conv.color}`} style={{ width: conv.rate }} />
                          </div>
                          <span className="text-[11px] font-semibold font-mono text-foreground w-8 text-right">{conv.rate}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Floating Bottom Banner */}
        <div className="absolute bottom-5 left-1/2 flex w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 items-center justify-between gap-4 rounded-xl bg-foreground p-4 text-background shadow-2xl border border-foreground/10 sm:bottom-7">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/15 text-background">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-xs font-semibold sm:text-sm tracking-tight">This is your real Goom workspace — ready in 60 seconds.</p>
              <p className="hidden truncate text-xs text-background/70 sm:block">Start your 15-day free trial. No credit card, no setup friction.</p>
            </div>
          </div>
          <Button asChild size="sm" className="shrink-0 rounded-lg bg-background text-foreground font-medium hover:bg-background/90 shadow-sm">
            <Link to="/auth?mode=signup">Try for Free</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ProductTour;
