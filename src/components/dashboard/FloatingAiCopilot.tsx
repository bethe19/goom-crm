import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/formatters";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanies } from "@/hooks/useCompanies";
import { useContacts } from "@/hooks/useContacts";
import { useActivities } from "@/hooks/useActivities";
import { useTasks } from "@/hooks/useTasks";
import { usePipelines, usePipelineStages } from "@/hooks/usePipelineStages";
import {
  askGroqCopilot,
  CRMContextData,
  CopilotResponse,
  getGroqApiKey,
} from "@/lib/groq";
import {
  getDemoDeals,
  INITIAL_DEMO_COMPANIES,
  INITIAL_DEMO_CONTACTS,
  DEMO_STAGES,
} from "@/lib/demoData";
import {
  Sparkles,
  Zap,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Send,
  Bot,
  Copy,
  RefreshCw,
  X,
  Check,
  Building2,
} from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "copilot";
  content: string;
  time: string;
  actionPayload?: {
    type: "email" | "task" | "deal";
    label: string;
    textToCopy?: string;
  };
}

interface FloatingAiCopilotProps {
  deals?: any[];
  totalValue?: number;
}

/**
 * Lightweight helper to format Markdown-like AI output into clean readable UI
 */
function FormattedAiText({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-1.5 text-xs leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Heading 3
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={idx} className="font-bold text-foreground text-xs mt-2 pt-1 border-b border-border/50 pb-0.5">
              {trimmed.replace(/^###\s+/, "")}
            </h4>
          );
        }

        // Heading 2 or 1
        if (trimmed.startsWith("## ") || trimmed.startsWith("# ")) {
          return (
            <h3 key={idx} className="font-bold text-foreground text-sm mt-2.5">
              {trimmed.replace(/^#+\s+/, "")}
            </h3>
          );
        }

        // Bullet point
        if (trimmed.startsWith("• ") || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const content = trimmed.replace(/^([•\-\*]\s+)/, "");
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1 my-0.5">
              <span className="text-primary font-bold select-none">•</span>
              <div>{renderInlineFormatting(content)}</div>
            </div>
          );
        }

        // Numbered list (e.g. "1. ")
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1 my-0.5">
              <span className="text-muted-foreground font-mono font-medium text-[11px] select-none">{numMatch[1]}.</span>
              <div>{renderInlineFormatting(numMatch[2])}</div>
            </div>
          );
        }

        // Empty line
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        // Standard line
        return <p key={idx}>{renderInlineFormatting(trimmed)}</p>;
      })}
    </div>
  );
}

function renderInlineFormatting(text: string) {
  // Simple parser for bold **text** and code `text`
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] text-primary">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export function FloatingAiCopilot({ deals: propDeals, totalValue: propTotalValue }: FloatingAiCopilotProps) {
  const { toast } = useToast();
  const { user, isDemoMode, userRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"signals" | "chat">("chat");
  const [inputQuery, setInputQuery] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Queries for real CRM context
  const { data: companies = [] } = useCompanies();
  const { data: contacts = [] } = useContacts();
  const { data: activities = [] } = useActivities();
  const { data: tasks = [] } = useTasks();
  const { data: pipelines } = usePipelines();
  const activePipelineId = pipelines?.[0]?.id;
  const { data: stages = [] } = usePipelineStages(activePipelineId);

  // Deals query (fallback if not passed via props)
  const { data: queryDeals } = useQuery({
    queryKey: ["copilot-deals", user?.id],
    queryFn: async () => {
      if (isDemoMode) return getDemoDeals();
      const { data } = await supabase
        .from("deals")
        .select("*, companies(name), contacts(first_name, last_name)")
        .order("value", { ascending: false });
      return data || [];
    },
    enabled: !propDeals || propDeals.length === 0,
  });

  const effectiveDeals = useMemo(() => {
    if (propDeals && propDeals.length > 0) return propDeals;
    if (queryDeals && queryDeals.length > 0) return queryDeals;
    if (isDemoMode) return getDemoDeals();
    return [];
  }, [propDeals, queryDeals, isDemoMode]);

  const effectiveTotalValue = useMemo(() => {
    if (propTotalValue && propTotalValue > 0) return propTotalValue;
    return effectiveDeals.reduce((acc, d: any) => acc + (Number(d.value) || 0), 0);
  }, [propTotalValue, effectiveDeals]);

  // Company Name
  const effectiveCompanyName = useMemo(() => {
    if (isDemoMode) return "Goom Global";
    return (
      (user?.user_metadata?.company as string) ||
      companies[0]?.name ||
      "Goom Construction"
    );
  }, [isDemoMode, user, companies]);

  // User Name
  const userName = useMemo(() => {
    if (isDemoMode) return "Alex";
    return (
      user?.user_metadata?.full_name?.split(" ")[0] ||
      user?.email?.split("@")[0] ||
      "there"
    );
  }, [user, isDemoMode]);

  // Context Builder for Groq
  const crmContext: CRMContextData = useMemo(() => {
    return {
      companyName: effectiveCompanyName,
      userName: user?.user_metadata?.full_name || userName,
      userRole: userRole || "Executive",
      totalValue: effectiveTotalValue,
      winRate: effectiveDeals.length > 0 ? 42 : 38,
      deals: effectiveDeals.map((d: any) => ({
        id: d.id,
        title: d.title,
        value: Number(d.value) || 0,
        stage_name: d.stage_name || stages.find((s) => s.id === d.stage_id)?.name || "Active",
        company_name: d.company_name || d.companies?.name || effectiveCompanyName,
        contact_name:
          d.contact_name ||
          (d.contacts ? `${d.contacts.first_name} ${d.contacts.last_name || ""}`.trim() : undefined),
        probability: d.probability || 50,
        close_date: d.close_date,
        notes: d.notes,
      })),
      contacts: (contacts.length > 0 ? contacts : (isDemoMode ? INITIAL_DEMO_CONTACTS : [])).map((c: any) => ({
        id: c.id,
        first_name: c.first_name,
        last_name: c.last_name,
        email: c.email,
        phone: c.phone,
        position: c.position,
        company_name: c.company_name || c.companies?.name,
        tags: c.tags,
      })),
      companies: (companies.length > 0 ? companies : (isDemoMode ? INITIAL_DEMO_COMPANIES : [])).map((c: any) => ({
        id: c.id,
        name: c.name,
        industry: c.industry,
        website: c.website,
      })),
      stages: stages.map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        count: effectiveDeals.filter((d: any) => d.stage_id === s.id).length,
        value: effectiveDeals
          .filter((d: any) => d.stage_id === s.id)
          .reduce((sum: number, d: any) => sum + (Number(d.value) || 0), 0),
      })),
      activities: activities.map((a: any) => ({
        title: a.title,
        type: a.type,
        description: a.description,
        created_at: a.created_at,
      })),
      tasks: tasks.map((t: any) => ({
        title: t.title,
        due_date: t.due_date,
        priority: t.priority,
        completed: t.completed,
      })),
    };
  }, [
    effectiveCompanyName,
    userName,
    user,
    userRole,
    effectiveTotalValue,
    effectiveDeals,
    contacts,
    companies,
    stages,
    activities,
    tasks,
    isDemoMode,
  ]);

  const initialGreeting = useMemo(() => {
    if (effectiveDeals.length === 0) {
      return `Hello ${userName}! I am your Goom AI Copilot, powered by Groq LPU™ intelligence. I'm connected to **${effectiveCompanyName}**. Your workspace is live and ready. Ask me anything about setting up deals, importing contacts, or organizing your pipeline!`;
    }
    return `Hello ${userName}! I am your Goom AI Copilot, powered by Groq LPU™ intelligence for **${effectiveCompanyName}**. I've audited your active **${formatCurrency(effectiveTotalValue)}** pipeline across **${effectiveDeals.length} opportunities**. What would you like to focus on today?`;
  }, [userName, effectiveCompanyName, effectiveTotalValue, effectiveDeals.length]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "m-0",
      sender: "copilot",
      content: initialGreeting,
      time: "Just now",
    },
  ]);

  // Keep initial greeting updated if company name resolves
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === "m-0") {
        return [
          {
            id: "m-0",
            sender: "copilot",
            content: initialGreeting,
            time: "Just now",
          },
        ];
      }
      return prev;
    });
  }, [initialGreeting]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen && activeTab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, activeTab, isThinking]);

  // Proactive Signals Radar
  const signals = useMemo(() => {
    if (effectiveDeals.length === 0) {
      return [
        {
          id: 1,
          type: "opportunity",
          tag: "Setup",
          title: "Create Initial Deal",
          desc: `Add your first sales contract to ${effectiveCompanyName} to activate predictive AI forecasting.`,
          actionLabel: "How to add deals",
          prompt: `How should I structure opportunities for ${effectiveCompanyName}?`,
        },
        {
          id: 2,
          type: "forecast",
          tag: "Imports",
          title: "Import Account Database",
          desc: "Upload CSV contacts or contractor records to sync real-time communications.",
          actionLabel: "Data Import Guide",
          prompt: "What is the fastest way to import company contacts into Goom CRM?",
        },
      ];
    }

    const sorted = [...effectiveDeals].sort((a: any, b: any) => (Number(b.value) || 0) - (Number(a.value) || 0));
    const topDeal = sorted[0];
    const secondDeal = sorted[1] || sorted[0];

    return [
      {
        id: 1,
        type: "risk",
        tag: "High Value Priority",
        title: `${topDeal.title} (${formatCurrency(Number(topDeal.value) || 0)})`,
        desc: `Top opportunity in ${effectiveCompanyName}'s pipeline. Needs executive alignment to expedite signature.`,
        actionLabel: "Audit Deal Risks",
        prompt: `Audit ${topDeal.title} (${formatCurrency(Number(topDeal.value) || 0)}). What are the key risks and next steps?`,
      },
      {
        id: 2,
        type: "opportunity",
        tag: "Executive Draft",
        title: `Follow-up on ${secondDeal.title}`,
        desc: "Prepare an executive check-in note to accelerate timeline and confirm milestones.",
        actionLabel: "Draft Email",
        prompt: `Draft a high-priority follow-up email for ${secondDeal.title} for ${effectiveCompanyName}.`,
      },
      {
        id: 3,
        type: "forecast",
        tag: "Pacing Model",
        title: `${effectiveCompanyName} Revenue Pacing`,
        desc: `${formatCurrency(effectiveTotalValue)} active across ${effectiveDeals.length} projects.`,
        actionLabel: "Quarterly Forecast",
        prompt: `Provide an executive revenue forecast and closing schedule for ${effectiveCompanyName}'s ${effectiveDeals.length} active deals.`,
      },
    ];
  }, [effectiveDeals, effectiveCompanyName, effectiveTotalValue]);

  // Contextual Quick Prompts
  const quickPrompts = useMemo(() => {
    if (effectiveDeals.length === 0) {
      return [
        "💡 Getting started guide",
        "📊 Best pipeline stages",
        "📥 How to import CSV",
        "🏗️ Construction CRM tips",
      ];
    }

    const topTitle = effectiveDeals[0]?.title || "our top deal";
    return [
      `🏗️ ${effectiveCompanyName} overview`,
      `📑 Audit: ${topTitle.length > 22 ? topTitle.slice(0, 20) + "..." : topTitle}`,
      "✉️ Draft closing follow-up",
      "🚨 Stalled deals audit",
      "📈 Revenue forecast model",
    ];
  }, [effectiveCompanyName, effectiveDeals]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isThinking) return;
    setActiveTab("chat");

    const userMsg: Message = {
      id: `m-${Date.now()}`,
      sender: "user",
      content: textToSend,
      time: "Just now",
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputQuery("");
    setIsThinking(true);

    try {
      const groqHistory = updatedMessages.map((m) => ({
        role: m.sender,
        content: m.content,
      }));

      const res: CopilotResponse = await askGroqCopilot(groqHistory, textToSend, crmContext);

      const botMsg: Message = {
        id: `m-bot-${Date.now()}`,
        sender: "copilot",
        content: res.content,
        time: "Just now",
        actionPayload: res.actionPayload,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error("Copilot error:", err);
      const errorMsg: Message = {
        id: `m-bot-err-${Date.now()}`,
        sender: "copilot",
        content: `I ran into an issue connecting to Groq AI: ${err?.message || "Please check network connectivity."}\n\nHere is a quick summary based on your live CRM data:\n• Active Deals: ${effectiveDeals.length}\n• Total Pipeline: ${formatCurrency(effectiveTotalValue)}`,
        time: "Just now",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleCopy = (text?: string, id?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (id) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    }
    toast({
      title: "Copied to clipboard! 📋",
      description: "Ready to paste into your email client or document.",
    });
  };

  return (
    <>
      {/* Floating Trigger Button (Bottom Right) */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className="h-11 rounded-full bg-foreground text-background hover:bg-foreground/90 px-4 shadow-2xl flex items-center gap-2.5 font-medium border border-border group transition-all"
        >
          <div className="relative">
            <Sparkles className="h-4 w-4 text-primary animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          </div>
          <span className="text-xs font-semibold">Goom Copilot</span>
          <Badge
            variant="outline"
            className="text-[9px] px-1.5 py-0 bg-background text-foreground border-border font-mono font-bold"
          >
            Groq AI
          </Badge>
        </Button>
      </div>

      {/* Slide-Up / Floating Panel Window */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-[450px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col h-[620px] max-h-[86vh] animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/40">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background shadow-xs">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-foreground">Goom AI Copilot</h3>
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1.5 py-0 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-medium"
                  >
                    Groq LPU™ Active
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-2.5 w-2.5 inline" />
                  <span>{effectiveCompanyName}</span>
                  <span>•</span>
                  <span>{effectiveDeals.length} Deals ({formatCurrency(effectiveTotalValue)})</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setMessages([
                    {
                      id: `m-${Date.now()}`,
                      sender: "copilot",
                      content: initialGreeting,
                      time: "Just now",
                    },
                  ]);
                }}
                title="Reset conversation"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Subheader Switcher */}
          <div className="flex items-center border-b border-border bg-secondary/15 px-4 py-1.5 gap-2 text-xs">
            <button
              onClick={() => setActiveTab("chat")}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                activeTab === "chat"
                  ? "bg-foreground text-background font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Live Copilot Chat
            </button>
            <button
              onClick={() => setActiveTab("signals")}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                activeTab === "signals"
                  ? "bg-foreground text-background font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Proactive Radar ({signals.length})
            </button>
          </div>

          {/* Tab 1: Signals View */}
          {activeTab === "signals" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex items-center justify-between pb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Proactive Telemetry
                </span>
                <span className="text-[10px] text-muted-foreground">Real-time DB Sync</span>
              </div>

              {signals.map((sig) => (
                <div
                  key={sig.id}
                  className="rounded-xl border border-border bg-secondary/20 p-3.5 space-y-2 hover:border-foreground/30 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1.5 py-0 font-semibold uppercase ${
                        sig.type === "risk"
                          ? "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                          : sig.type === "opportunity"
                          ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                          : "border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/10"
                      }`}
                    >
                      {sig.tag}
                    </Badge>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-foreground">{sig.title}</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">{sig.desc}</p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSendMessage(sig.prompt)}
                    className="w-full h-7 text-[11px] border-border hover:bg-secondary font-medium gap-1 justify-between"
                  >
                    <span>{sig.actionLabel}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Tab 2: Chat View */}
          {activeTab === "chat" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[90%] rounded-xl p-3 text-xs leading-relaxed shadow-xs ${
                      m.sender === "user"
                        ? "bg-foreground text-background font-medium whitespace-pre-line"
                        : "bg-secondary/40 border border-border text-foreground"
                    }`}
                  >
                    {m.sender === "user" ? (
                      m.content
                    ) : (
                      <FormattedAiText text={m.content} />
                    )}

                    {m.actionPayload && (
                      <div className="mt-3 pt-2.5 border-t border-border flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => handleCopy(m.actionPayload?.textToCopy, m.id)}
                          className="h-7 text-[10px] gap-1.5 bg-foreground text-background hover:bg-foreground/90 font-medium shadow-xs"
                        >
                          {copiedId === m.id ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-400" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>{m.actionPayload.label}</span>
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-muted-foreground mt-1 px-1">{m.time}</span>
                </div>
              ))}

              {isThinking && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-secondary/30 text-xs text-muted-foreground w-fit animate-pulse">
                  <Sparkles className="h-3.5 w-3.5 animate-spin text-foreground" />
                  <span>Groq AI is reasoning over {effectiveCompanyName} data...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Quick Prompts Strip */}
          <div className="px-3 py-2 border-t border-border/80 bg-secondary/20 flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {quickPrompts.map((qp, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(qp)}
                className="whitespace-nowrap rounded-md border border-border bg-card px-2.5 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-all shrink-0 font-medium"
              >
                {qp}
              </button>
            ))}
          </div>

          {/* Chat Input Footer */}
          <div className="p-3 border-t border-border bg-card shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputQuery);
              }}
              className="flex items-center gap-2"
            >
              <Input
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder={`Ask Copilot about ${effectiveCompanyName}, deals, drafting...`}
                className="h-9 text-xs border-border bg-secondary/20"
                disabled={isThinking}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!inputQuery.trim() || isThinking}
                className="h-9 w-9 p-0 bg-foreground text-background hover:bg-foreground/90 shrink-0 shadow-xs"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
