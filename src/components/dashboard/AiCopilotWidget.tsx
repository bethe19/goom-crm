import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/formatters";
import { askGroqCopilot } from "@/lib/groq";
import {
  Sparkles,
  Zap,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Send,
  CheckCircle2,
  Bot,
  Copy,
  RefreshCw,
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

interface AiCopilotWidgetProps {
  deals?: any[];
  totalValue?: number;
}

export function AiCopilotWidget({ deals = [], totalValue = 0 }: AiCopilotWidgetProps) {
  const { toast } = useToast();
  const { user, isDemoMode } = useAuth();
  const [activeTab, setActiveTab] = useState<"signals" | "chat">("signals");
  const [inputQuery, setInputQuery] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  const userName = useMemo(() => {
    if (isDemoMode) return "Alex";
    return (
      user?.user_metadata?.full_name?.split(" ")[0] ||
      user?.email?.split("@")[0] ||
      "there"
    );
  }, [user, isDemoMode]);

  const initialGreeting = useMemo(() => {
    if (isDemoMode) {
      return "Hello Alex! I am your 2026 Goom AI Copilot. I've audited your active $918,500 pipeline. 2 deals need immediate follow-up to hit your $1.25M Q3 target. What would you like to focus on?";
    }
    if (!deals || deals.length === 0) {
      return `Hello ${userName}! I am your Goom AI Copilot. Your workspace is initialized and ready. To activate proactive deal health signals, revenue forecasting, and automated follow-ups, create your first deal or import contacts.`;
    }
    return `Hello ${userName}! I am your Goom AI Copilot. I've audited your active ${formatCurrency(totalValue)} pipeline across ${deals.length} opportunities. What would you like to focus on?`;
  }, [userName, isDemoMode, deals, totalValue]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "m-0",
      sender: "copilot",
      content: initialGreeting,
      time: "Just now",
    },
  ]);

  const signals = useMemo(() => {
    if (isDemoMode) {
      return [
        {
          id: 1,
          type: "risk",
          tag: "Action Required",
          title: "Harbor & Co. ($98,000)",
          desc: "Proposal sent 5 days ago with no follow-up. Win probability drops 12% after day 7.",
          actionLabel: "Draft Re-engagement",
          prompt: "Draft tailored executive check-in for Sofia Miller at Harbor & Co.",
        },
        {
          id: 2,
          type: "opportunity",
          tag: "High Velocity",
          title: "Northstar Enterprise AI ($145,000)",
          desc: "94% closing probability detected. Legal amendments cleared yesterday.",
          actionLabel: "Fast-Track Contract",
          prompt: "Generate closing contract email to Maya Chen at Northstar Labs.",
        },
        {
          id: 3,
          type: "forecast",
          tag: "Pace Indicator",
          title: "Q3 Target Pacing Ahead",
          desc: "$412,800 projected quarter close vs $380,000 baseline (+8.6% delta).",
          actionLabel: "Forecast Audit",
          prompt: "Explain our Q3 revenue projection and highest risk deals.",
        },
      ];
    }

    if (!deals || deals.length === 0) {
      return [
        {
          id: 1,
          type: "opportunity",
          tag: "Get Started",
          title: "Create Your First Deal",
          desc: "Add an opportunity to your sales pipeline to activate live velocity metrics.",
          actionLabel: "Create Deal",
          prompt: "How do I create and structure a new sales deal?",
        },
        {
          id: 2,
          type: "forecast",
          tag: "Quick Setup",
          title: "Import Contacts & Companies",
          desc: "Upload contacts via CSV or add them manually to start tracking touchpoints.",
          actionLabel: "Import Data",
          prompt: "How do I import existing customer data?",
        },
        {
          id: 3,
          type: "risk",
          tag: "Best Practice",
          title: "Sales Target Alignment",
          desc: "Baseline quota is initialized to $1.25M. Target pacing updates dynamically.",
          actionLabel: "Target Overview",
          prompt: "Explain the revenue forecast and quota model.",
        },
      ];
    }

    const topDeal = [...deals].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))[0];
    return [
      {
        id: 1,
        type: "opportunity",
        tag: "Priority Deal",
        title: `${topDeal?.title || "Top Opportunity"} (${formatCurrency(Number(topDeal?.value) || 0)})`,
        desc: `Highest volume opportunity in your current active pipeline.`,
        actionLabel: "Audit Deal",
        prompt: `Analyze next best actions for ${topDeal?.title || "my top deal"}.`,
      },
      {
        id: 2,
        type: "forecast",
        tag: "Pipeline Telemetry",
        title: `${deals.length} Active Opportunities`,
        desc: `${formatCurrency(totalValue)} total pipeline across configured stages.`,
        actionLabel: "Pacing Audit",
        prompt: "Summarize our current pipeline telemetry and pacing.",
      },
      {
        id: 3,
        type: "risk",
        tag: "Deal Health",
        title: "Velocity Safeguards",
        desc: "Regular activity touchpoints keep stage conversion probability high.",
        actionLabel: "Check Follow-ups",
        prompt: "What are the recommended follow-ups for our active pipeline?",
      },
    ];
  }, [isDemoMode, deals, totalValue]);

  const quickPrompts = useMemo(() => {
    if (isDemoMode) {
      return [
        "🚨 Stalled deals audit",
        "📈 Q3 revenue prediction",
        "✉️ Draft email to Maya Chen",
        "⚡ What closes this week?",
      ];
    }
    if (!deals || deals.length === 0) {
      return [
        "💡 How to get started",
        "📊 Pipeline best practices",
        "📥 How to import CSV",
        "🎯 Revenue quota guide",
      ];
    }
    return [
      "📈 Pipeline forecast summary",
      "⚡ High leverage opportunities",
      "🚨 Stalled deals audit",
      "✉️ Draft closing follow-up",
    ];
  }, [isDemoMode, deals]);

  const generateCopilotResponse = (prompt: string): { content: string; actionPayload?: Message["actionPayload"] } => {
    const q = prompt.toLowerCase();

    if (isDemoMode) {
      if (q.includes("maya") || q.includes("northstar")) {
        const emailText =
          "Subject: Finalizing Northstar Labs x Goom Enterprise Agreement\n\nHi Maya,\n\nFollowing our review of the multi-region AI deployment architecture, our team has integrated all legal amendments approved by your counsel. We are locked in for the September 28 launch date.\n\nCould you review and execute the final e-signature packet below?\n\nBest regards,\nAlex Vance | VP of Revenue";
        return {
          content:
            "I've generated a high-converting closing note for **Maya Chen (VP of Engineering, Northstar Labs)**. Legal redlines are noted as cleared with zero blockers.",
          actionPayload: {
            type: "email",
            label: "Copy Email to Clipboard",
            textToCopy: emailText,
          },
        };
      }

      if (q.includes("stalled") || q.includes("harbor") || q.includes("risk")) {
        const followUpText =
          "Subject: Checking in on Harbor & Co. Wealth Operations Proposal\n\nHi Sofia,\n\nI wanted to check in on the global platform proposal we discussed last week. We have reserved dedicated onboarding engineering capacity starting next week to ensure smooth integration.\n\nDo you have 10 minutes tomorrow afternoon to confirm the SLA requirements?\n\nBest,\nAlex Vance | VP of Revenue";
        return {
          content:
            "**🚨 Deal Health Risk Alert: Harbor & Co. ($98,000)**\n• **Stall Duration:** 5 days without customer touchpoint\n• **Risk Factor:** Competitor evaluation window expires in 48 hours\n• **Recommended Action:** Send the following follow-up to Sofia Miller:",
          actionPayload: {
            type: "email",
            label: "Copy Re-engagement Email",
            textToCopy: followUpText,
          },
        };
      }

      if (q.includes("predict") || q.includes("q3") || q.includes("revenue") || q.includes("forecast")) {
        return {
          content:
            "**📊 2026 AI Revenue Projection (Q3 2026):**\n• **Target Quota:** $1,250,000\n• **Current Closed ARR:** $208,000 (CyberShield + Quantum Bio)\n• **Weighted High-Probability Pipeline:** $610,500\n• **Projected Attainment:** 108.6% of baseline target\n• **Key Win Driver:** Securing Northstar Labs ($145k) and Atlas Works ($78.5k) by September 28 puts you in the top 5% rep quota bracket.",
        };
      }

      return {
        content:
          `I analyzed your pipeline for: "${prompt}".\n\n• **Active Deals:** 10 enterprise opportunities ($918,500 total value)\n• **Average Deal Size:** $91,850\n• **Sales Cycle Velocity:** 16 days average (down 52% from legacy benchmark)\n• **Next Best Action:** Fast-track e-signatures on Northstar Labs and schedule a check-in with Arc Systems.`,
      };
    }

    // Live Account with 0 deals
    if (!deals || deals.length === 0) {
      if (q.includes("import") || q.includes("csv")) {
        return {
          content:
            "**Importing Data into Goom CRM:**\n\n1. Navigate to **Data & Imports** in the navigation bar.\n2. You can upload CSV spreadsheets of your Contacts, Companies, and Deals.\n3. The system automatically maps standard columns (Name, Email, Phone, Company, Deal Value) and imports in bulk into your Supabase database.",
        };
      }

      if (q.includes("create") || q.includes("start") || q.includes("deal")) {
        return {
          content:
            "**Getting Started with Deals:**\n\n• Click the **New Deal** button in the dashboard or open the **Pipeline** view.\n• Provide a deal title, projected value, expected close date, and assign it to an account.\n• Drag and drop deals across stages (Lead → Qualified → Demo → Proposal → Negotiation → Won) to track velocity in real time.",
        };
      }

      return {
        content:
          `I analyzed your query: "${prompt}".\n\nYour workspace is ready for real deal telemetry. As soon as you add opportunities or import contacts, I'll provide real-time deal health scores, revenue pacing calculations, and executive summaries.`,
      };
    }

    // Live Account with deals
    const avgDeal = Math.round(totalValue / (deals.length || 1));
    const topDeal = [...deals].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))[0];

    if (q.includes("email") || q.includes("draft") || q.includes("follow")) {
      const emailText = `Subject: Checking in on ${topDeal?.title || "our partnership"}\n\nHi,\n\nI wanted to circle back regarding our timeline. We're eager to support your team's objectives this quarter.\n\nLet me know if you have 10 minutes this week for a quick sync.\n\nBest regards,\n${user?.user_metadata?.full_name || "Revenue Team"}`;
      return {
        content: `I've generated a tailored follow-up note for **${topDeal?.title || "your active deal"}**:`,
        actionPayload: {
          type: "email",
          label: "Copy Email Template",
          textToCopy: emailText,
        },
      };
    }

    if (q.includes("forecast") || q.includes("revenue") || q.includes("pacing") || q.includes("summary")) {
      return {
        content:
          `**Live Pipeline Intelligence:**\n\n• **Total Active Pipeline:** ${formatCurrency(totalValue)}\n• **Active Deals:** ${deals.length} opportunities\n• **Average Deal Size:** ${formatCurrency(avgDeal)}\n• **Highest Value Opportunity:** ${topDeal?.title || "None"} (${formatCurrency(Number(topDeal?.value) || 0)})\n• **Quota Target:** $1,250,000 (${Math.min(Math.round((totalValue / 1250000) * 100), 100)}% coverage)`,
      };
    }

    return {
      content:
        `Pipeline telemetry analyzed for: "${prompt}".\n\n• **Active Pipeline:** ${formatCurrency(totalValue)} across ${deals.length} opportunities\n• **Average Deal Size:** ${formatCurrency(avgDeal)}\n• **Top Lever:** ${topDeal?.title || "Add more deals"} (${formatCurrency(Number(topDeal?.value) || 0)})\n• Real-time Postgres synchronization active.`,
    };
  };

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isThinking) return;
    setActiveTab("chat");

    const userMsg: Message = {
      id: `m-${Date.now()}`,
      sender: "user",
      content: textToSend,
      time: "Just now",
    };

    const updated = [...messages, userMsg];
    setMessages(updated);
    setInputQuery("");
    setIsThinking(true);

    try {
      const res = await askGroqCopilot(
        updated.map((m) => ({ role: m.sender, content: m.content })),
        textToSend,
        {
          userName,
          companyName: (user?.user_metadata?.company as string) || "Goom Construction",
          deals: deals.map((d: any) => ({
            title: d.title,
            value: Number(d.value) || 0,
            stage_name: d.stage_name || "Active",
            probability: d.probability || 50,
          })),
          totalValue,
        }
      );

      const botMsg: Message = {
        id: `m-bot-${Date.now()}`,
        sender: "copilot",
        content: res.content,
        time: "Just now",
        actionPayload: res.actionPayload,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const fallback = generateCopilotResponse(textToSend);
      const botMsg: Message = {
        id: `m-bot-${Date.now()}`,
        sender: "copilot",
        content: fallback.content,
        time: "Just now",
        actionPayload: fallback.actionPayload,
      };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleCopy = (text?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard! 📋",
      description: "Email note ready to paste.",
    });
  };

  return (
    <Card className="border border-border/80 bg-card shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header */}
      <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4 border-b border-border/60 bg-secondary/30">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-background">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold tracking-tight">Goom AI Copilot</h3>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border bg-background">
                Telemetry
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">Deal coaching & revenue intelligence</p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => {
            setMessages([
              {
                id: "m-0",
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
      </CardHeader>

      {/* Tabs */}
      <div className="flex items-center border-b border-border/60 bg-secondary/10 px-4 py-1.5 gap-2 text-xs">
        <button
          onClick={() => setActiveTab("signals")}
          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
            activeTab === "signals"
              ? "bg-foreground text-background font-semibold shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Signal Radar ({signals.length})
        </button>
        <button
          onClick={() => setActiveTab("chat")}
          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
            activeTab === "chat"
              ? "bg-foreground text-background font-semibold shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Live Copilot Chat
        </button>
      </div>

      {/* Tab 1: Signals */}
      {activeTab === "signals" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Proactive Telemetry
            </span>
            <span className="text-[10px] text-muted-foreground">Updated real-time</span>
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
                      ? "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                      : sig.type === "opportunity"
                      ? "border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10"
                      : "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                  }`}
                >
                  {sig.tag}
                </Badge>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-foreground">{sig.title}</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{sig.desc}</p>
              </div>

              <Button
                size="sm"
                variant="outline"
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

      {/* Tab 2: Chat */}
      {activeTab === "chat" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-xl p-3 text-xs leading-relaxed whitespace-pre-line shadow-xs ${
                  m.sender === "user"
                    ? "bg-foreground text-background font-medium"
                    : "bg-secondary/40 border border-border text-foreground"
                }`}
              >
                {m.content}

                {m.actionPayload && (
                  <div className="mt-3 pt-2.5 border-t border-border flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => handleCopy(m.actionPayload?.textToCopy)}
                      className="h-7 text-[10px] gap-1.5 bg-foreground text-background hover:bg-foreground/90 font-medium"
                    >
                      <Copy className="h-3 w-3" />
                      <span>{m.actionPayload.label}</span>
                    </Button>
                  </div>
                )}
              </div>
              <span className="text-[9px] text-muted-foreground mt-1 px-1">{m.time}</span>
            </div>
          ))}

          {isThinking && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-secondary/30 text-xs text-muted-foreground w-fit">
              <Sparkles className="h-3.5 w-3.5 animate-spin text-foreground" />
              <span>Analyzing pipeline telemetry...</span>
            </div>
          )}
        </div>
      )}

      {/* Quick Prompts */}
      <div className="px-3 py-2 border-t border-border/80 bg-secondary/20 flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        {quickPrompts.map((qp, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(qp)}
            className="whitespace-nowrap rounded-md border border-border bg-card px-2.5 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-all shrink-0"
          >
            {qp}
          </button>
        ))}
      </div>

      {/* Input */}
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
            placeholder="Ask Copilot about deals, velocity, or drafting..."
            className="h-9 text-xs border-border bg-secondary/20"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!inputQuery.trim() || isThinking}
            className="h-9 w-9 p-0 bg-foreground text-background hover:bg-foreground/90 shrink-0"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>
    </Card>
  );
}
