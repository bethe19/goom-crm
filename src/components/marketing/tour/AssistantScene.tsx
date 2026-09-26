import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, Copy, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLANS, PLAN_ORDER, formatLimit } from "@/lib/plans";
import { atRiskDeals, formatMoney, stageTotals, weightedPipeline, type TourDeal } from "./data";
import { useDemoScript } from "./hooks";
import { SceneHeader } from "./ui";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
}

const PROMPTS = ["Which deals are at risk?", "Summarize my pipeline by stage", "Draft a follow-up to Kestrel Logistics"] as const;

/** Answers are computed from the tour's example deals, the same way the real assistant reads your workspace. */
function answerFor(prompt: string, deals: TourDeal[]): string {
  if (prompt === PROMPTS[0]) {
    const risks = atRiskDeals(deals);
    if (risks.length === 0) return "Nothing looks at risk right now: every open deal has a future close date and recent activity.";
    return [
      `${risks.length} open deal${risks.length === 1 ? " needs" : "s need"} attention:`,
      ...risks.map((r) => `• ${r.deal.title} (${r.deal.company}, ${formatMoney(r.deal.value)}) — ${r.reason}.`),
      "Want me to draft follow-ups for these?",
    ].join("\n");
  }
  if (prompt === PROMPTS[1]) {
    const totals = stageTotals(deals).filter((t) => t.count > 0);
    return [
      "Here's the pipeline by stage:",
      ...totals.map((t) => `• ${t.stage.name}: ${t.count} deal${t.count === 1 ? "" : "s"}, ${formatMoney(t.value)}`),
      `Weighted open pipeline: ${formatMoney(weightedPipeline(deals))}.`,
    ].join("\n");
  }
  if (prompt === PROMPTS[2]) {
    const d = deals.find((x) => x.company === "Kestrel Logistics");
    return [
      `Subject: Next steps on the ${d?.title.toLowerCase() ?? "warehouse fit-out"}`,
      "",
      `Hi ${d?.contact.split(" ")[0] ?? "Hana"},`,
      "",
      "Thanks again for walking us through the site. I've attached the revised quote with the phased schedule we discussed. Would Thursday or Friday suit for a 20-minute call to confirm the start date?",
      "",
      "Best,\nAmira",
    ].join("\n");
  }
  return "This tour only knows a few example questions — try one of the suggestions. In your workspace, the assistant answers from your own deals, tasks and recent activity.";
}

export function AssistantScene({ deals, demo, animate }: { deals: TourDeal[]; demo: boolean; animate: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<{ id: string; full: string; shown: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const ask = (prompt: string) => {
    const text = prompt.trim();
    if (!text || streaming) return;
    const answer = answerFor(text, deals);
    const id = `m-${Date.now()}`;
    setMessages((m) => [...m, { id: `${id}-q`, role: "user", text }, { id, role: "assistant", text: answer }]);
    setStreaming({ id, full: answer, shown: animate ? 0 : answer.length });
    setInput("");
    setCopied(false);
  };

  // Reveal the answer a few characters at a time.
  useEffect(() => {
    if (!streaming || streaming.shown >= streaming.full.length) {
      if (streaming) setStreaming(null);
      return;
    }
    const t = window.setTimeout(
      () => setStreaming((s) => (s ? { ...s, shown: Math.min(s.full.length, s.shown + 6) } : s)),
      streaming.shown === 0 ? 500 : 18,
    );
    return () => window.clearTimeout(t);
  }, [streaming]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming?.shown]);

  useDemoScript(demo, [[1000, () => ask(PROMPTS[0])]]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    ask(input);
  };

  const last = messages[messages.length - 1];

  return (
    <div className="flex h-full flex-col">
      <SceneHeader title="Assistant" subtitle="Answers from the deals, tasks and activity in your workspace">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-background">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </SceneHeader>

      <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
        {messages.length === 0 && (
          <div className="mx-auto max-w-sm pt-4 text-center">
            <p className="text-sm font-medium">Ask about your pipeline</p>
            <p className="mt-1 text-xs text-muted-foreground">Pick a question below, or type your own.</p>
          </div>
        )}
        {messages.map((m) => {
          const isStreaming = streaming?.id === m.id;
          const text = isStreaming ? m.text.slice(0, streaming.shown) : m.text;
          return m.role === "user" ? (
            <div key={m.id} className="ml-auto w-fit max-w-[85%] rounded-xl rounded-br-sm bg-foreground px-3 py-2 text-xs text-background">
              {m.text}
            </div>
          ) : (
            <div key={m.id} className="max-w-[92%]">
              {isStreaming && streaming.shown === 0 ? (
                <p className="text-xs text-muted-foreground">Reading your pipeline…</p>
              ) : (
                <p className="whitespace-pre-wrap rounded-xl rounded-bl-sm border border-border bg-card px-3 py-2 text-xs leading-relaxed">
                  {text}
                  {isStreaming && <span className="ml-0.5 inline-block h-3 w-1 translate-y-0.5 bg-foreground/60" aria-hidden="true" />}
                </p>
              )}
              {!isStreaming && m === last && m.text.startsWith("Subject:") && (
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(m.text).catch(() => undefined);
                    setCopied(true);
                  }}
                  className="mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <Copy className="h-3 w-3" aria-hidden="true" /> {copied ? "Copied" : "Copy draft"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="sr-only" aria-live="polite">
        {!streaming && last?.role === "assistant" ? last.text : ""}
      </p>

      <div className="space-y-2 border-t border-border px-4 py-3 sm:px-5">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              disabled={!!streaming}
              onClick={() => ask(p)}
              className="shrink-0 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground/90 transition-colors hover:bg-secondary disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>
        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <label htmlFor="tour-ai-input" className="sr-only">
            Ask the assistant
          </label>
          <input
            id="tour-ai-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your deals…"
            className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!input.trim() || !!streaming}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40",
            )}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </form>
        <p className="text-[11px] text-muted-foreground">
          AI requests per workspace each month:{" "}
          {PLAN_ORDER.map((id) => `${PLANS[id].name} ${formatLimit(PLANS[id].limits.ai_requests_per_month)}`).join(" · ")}
        </p>
      </div>
    </div>
  );
}
