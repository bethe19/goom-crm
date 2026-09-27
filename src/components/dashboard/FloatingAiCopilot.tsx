import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowUp, Check, Copy, Loader2, RotateCcw, Sparkles, Square, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MarkdownView } from "@/components/ui/rich-text-editor";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { sanitizeErrorMessage } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import {
  AiAbortedError,
  AiNotConfiguredError,
  AiNotDeployedError,
  AiPlanLimitError,
  AiRateLimitError,
  OPEN_ASSISTANT_EVENT,
  buildAssistantSystemPrompt,
  chat,
  normalizeAiMarkdown,
  trimHistory,
  type AiMessage,
} from "@/lib/ai";
import { fetchWorkspaceSnapshot, summarizeWorkspace, toIsoDate } from "@/lib/aiContext";

type ErrorKind = "not_configured" | "not_deployed" | "plan_limit" | "rate_limit" | "stopped" | "generic";
type Unavailable = "not_configured" | "not_deployed" | null;

interface ChatItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Set on assistant items that represent a failed turn (never sent back to the model). */
  error?: ErrorKind;
}

const CONTEXT_STALE_MS = 60_000;

let idCounter = 0;
const nextId = () => `m${Date.now().toString(36)}${(idCounter++).toString(36)}`;

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function FloatingAiCopilot() {
  const { organization, user, userRole, isAdmin, isPlatformAdmin, can } = useAuth();
  const canBill = can("workspace.billing");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [unavailable, setUnavailable] = useState<Unavailable>(null);
  const notConfigured = unavailable !== null;
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const requestRef = useRef<{ id: number; controller: AbortController | null }>({ id: 0, controller: null });
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const orgId = organization?.id ?? null;
  const currency = organization?.currency || "ETB";
  const contextKey = useMemo(() => ["ai-context", orgId] as const, [orgId]);

  // Workspace snapshot: loaded when the panel opens (for suggestions) and reused at ask-time.
  const contextQuery = useQuery({
    queryKey: contextKey,
    queryFn: fetchWorkspaceSnapshot,
    enabled: open && !!orgId,
    staleTime: CONTEXT_STALE_MS,
  });
  const summary = useMemo(
    () => (contextQuery.data ? summarizeWorkspace(contextQuery.data, currency, new Date()) : null),
    [contextQuery.data, currency],
  );

  // A different workspace means a different conversation.
  useEffect(() => {
    requestRef.current.controller?.abort();
    requestRef.current = { id: requestRef.current.id + 1, controller: null };
    setMessages([]);
    setPending(false);
    setUnavailable(null);
  }, [orgId]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending, open]);

  // Focus the composer when opening.
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  // Abort anything in flight on unmount.
  useEffect(() => () => requestRef.current.controller?.abort(), []);

  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => launcherRef.current?.focus());
  }, []);

  const run = useCallback(
    async (conversation: ChatItem[]) => {
      requestRef.current.controller?.abort();
      const controller = new AbortController();
      const reqId = requestRef.current.id + 1;
      requestRef.current = { id: reqId, controller };
      const isCurrent = () => requestRef.current.id === reqId;

      setMessages(conversation);
      setPending(true);

      const fail = (kind: ErrorKind, content: string) => {
        if (!isCurrent()) return;
        setMessages((prev) => [...prev, { id: nextId(), role: "assistant", content, error: kind }]);
      };

      try {
        let snapshot;
        try {
          snapshot = await queryClient.fetchQuery({
            queryKey: contextKey,
            queryFn: fetchWorkspaceSnapshot,
            staleTime: CONTEXT_STALE_MS,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          fail("generic", `Couldn't load your workspace data. ${sanitizeErrorMessage(msg)}`);
          return;
        }
        if (!isCurrent()) return;

        const today = new Date();
        const system = buildAssistantSystemPrompt({
          workspaceName: organization?.name,
          userName: (user?.user_metadata?.full_name as string | undefined) || null,
          userRole,
          currency,
          today: toIsoDate(today),
          workspaceSummary: summarizeWorkspace(snapshot, currency, today).text,
        });

        const history: AiMessage[] = trimHistory(
          conversation.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content })),
        );

        const answer = await chat([{ role: "system", content: system }, ...history], {
          temperature: 0.3,
          max_tokens: 900,
          signal: controller.signal,
        });
        if (!isCurrent()) return;
        setUnavailable(null);
        setMessages((prev) => [...prev, { id: nextId(), role: "assistant", content: normalizeAiMarkdown(answer) }]);
      } catch (err) {
        if (!isCurrent()) return;
        if (err instanceof AiAbortedError) fail("stopped", "Stopped.");
        else if (err instanceof AiNotDeployedError) {
          setUnavailable("not_deployed");
          fail("not_deployed", "The assistant isn't available yet.");
        } else if (err instanceof AiNotConfiguredError) {
          setUnavailable("not_configured");
          fail("not_configured", err.message);
        } else if (err instanceof AiPlanLimitError) fail("plan_limit", err.message);
        else if (err instanceof AiRateLimitError) fail("rate_limit", err.message);
        else fail("generic", err instanceof Error ? err.message : "The assistant couldn't answer right now. Please try again.");
      } finally {
        if (isCurrent()) {
          setPending(false);
          requestRef.current.controller = null;
        }
      }
    },
    [queryClient, contextKey, organization?.name, user, userRole, currency],
  );

  const send = useCallback(
    (text: string) => {
      const q = text.trim();
      if (!q || pending) return;
      setInput("");
      void run([...messages, { id: nextId(), role: "user", content: q }]);
    },
    [messages, pending, run],
  );

  const stop = useCallback(() => {
    const { controller } = requestRef.current;
    // Invalidate the request first so a late response is ignored even if abort isn't honoured.
    requestRef.current = { id: requestRef.current.id + 1, controller: null };
    controller?.abort();
    setPending(false);
    setMessages((prev) => [...prev, { id: nextId(), role: "assistant", content: "Stopped.", error: "stopped" }]);
    inputRef.current?.focus();
  }, []);

  const retry = useCallback(
    (errorId: string) => {
      const idx = messages.findIndex((m) => m.id === errorId);
      if (idx <= 0 || pending) return;
      void run(messages.slice(0, idx));
    },
    [messages, pending, run],
  );

  const clear = useCallback(() => {
    requestRef.current.controller?.abort();
    requestRef.current = { id: requestRef.current.id + 1, controller: null };
    setMessages([]);
    setPending(false);
    setInput("");
    inputRef.current?.focus();
  }, []);

  const copy = useCallback(
    async (item: ChatItem) => {
      try {
        await navigator.clipboard.writeText(item.content);
        setCopiedId(item.id);
        window.setTimeout(() => setCopiedId((c) => (c === item.id ? null : c)), 2000);
      } catch {
        toast({ title: "Couldn't copy", description: "Your browser blocked clipboard access.", variant: "destructive" });
      }
    },
    [toast],
  );

  // Other parts of the app can open the assistant (optionally with a question).
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    const onOpen = (e: Event) => {
      const prompt = (e as CustomEvent<{ prompt?: string }>).detail?.prompt;
      setOpen(true);
      if (prompt) window.setTimeout(() => sendRef.current(prompt), 0);
    };
    window.addEventListener(OPEN_ASSISTANT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, onOpen);
  }, []);

  const suggestions = useMemo(() => {
    const list = ["Summarize my pipeline", "Which deals are at risk?", "What should I focus on today?"];
    if (summary?.followUpDeal) list.push(`Draft a follow-up email for "${summary.followUpDeal.title}"`);
    return list;
  }, [summary]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(input);
    }
  };

  // Auto-grow the composer up to a max height.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input, open]);

  if (!user) return null;

  if (!open) {
    return (
      <Button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open AI assistant"
        aria-haspopup="dialog"
        className="fixed bottom-4 right-4 z-40 h-11 w-11 rounded-full p-0 shadow-lg sm:bottom-6 sm:right-6 sm:h-10 sm:w-auto sm:px-4 sm:gap-2 print:hidden"
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        <span className="hidden text-sm font-medium sm:inline">Ask AI</span>
      </Button>
    );
  }

  const empty = messages.length === 0;

  return (
    <section
      role="dialog"
      aria-label="AI assistant"
      aria-modal="false"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          close();
        }
      }}
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xl",
        "inset-x-2 bottom-2 top-16 sm:inset-x-auto sm:top-auto sm:bottom-6 sm:right-6 sm:w-[420px] sm:h-[min(640px,calc(100vh-6rem))]",
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200",
      )}
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold leading-tight">Assistant</h2>
            <p className="truncate text-xs text-muted-foreground">
              {organization?.name ? `Answers from ${organization.name}` : "Answers from your workspace"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <IconButton label="Clear conversation" onClick={clear} disabled={empty && !pending}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
          <IconButton label="Close (Esc)" onClick={close}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
      </header>

      {/* Conversation */}
      <div ref={logRef} role="log" aria-live="polite" aria-busy={pending} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {notConfigured && empty ? null : empty ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">How can I help?</p>
              <p className="text-xs text-muted-foreground">
                I read your current deals, tasks and recent activity when you ask, and answer from that data only.
              </p>
            </div>
            {contextQuery.isLoading ? (
              <div className="space-y-2" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-9 rounded-lg bg-muted motion-safe:animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {summary?.isEmpty && (
                  <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                    Your workspace doesn't have any deals, tasks or activities yet, so answers will be limited.
                  </p>
                )}
                <ul className="space-y-2" aria-label="Suggested questions">
                  {suggestions.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => send(s)}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="line-clamp-2">{s}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : (
          messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                  {m.content}
                </div>
              </div>
            ) : m.error ? (
              <div
                key={m.id}
                className={cn(
                  "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
                  m.error === "stopped" ? "border-dashed text-muted-foreground" : "border-destructive/30 bg-destructive/5",
                )}
              >
                {m.error !== "stopped" && <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />}
                <div className="min-w-0 flex-1">
                  <p>{m.content}</p>
                  {m.error === "plan_limit" && canBill && (
                    <Button asChild variant="link" size="sm" className="h-auto px-0 py-1 text-xs">
                      <Link to="/settings?tab=billing" onClick={() => setOpen(false)}>
                        View plan
                      </Link>
                    </Button>
                  )}
                  {m.error === "plan_limit" && !canBill && (
                    <p className="mt-1 text-xs text-muted-foreground">Ask your workspace admin about upgrading the plan.</p>
                  )}
                  {m.error !== "not_configured" && m.error !== "not_deployed" && m.error !== "plan_limit" && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto px-0 py-1 text-xs"
                      onClick={() => retry(m.id)}
                      disabled={pending}
                    >
                      <RotateCcw className="mr-1 h-3 w-3" aria-hidden="true" />
                      Try again
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div key={m.id} className="group space-y-1">
                <MarkdownView value={m.content} className="text-sm leading-relaxed text-foreground break-words" />
                <div className="flex items-center gap-1 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => void copy(m)}
                    aria-label={/^\s*\**subject:/im.test(m.content) ? "Copy email draft" : "Copy answer"}
                  >
                    {copiedId === m.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedId === m.id ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
            ),
          )
        )}

        {notConfigured && (
          <div className="rounded-lg border bg-muted/40 px-3 py-3 text-sm">
            <p className="font-medium">
              {unavailable === "not_deployed" ? "The AI service isn't deployed yet" : "AI isn't set up for this workspace yet"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {!(isAdmin || isPlatformAdmin)
                ? "Ask your workspace admin to enable the AI assistant. Everything else in the CRM works as usual."
                : unavailable === "not_deployed"
                  ? "The ai-chat edge function hasn't been deployed to this Supabase project. See supabase/README.md → Edge functions, then try again."
                  : "The assistant needs a server-side AI provider key. Whoever deploys this app should set the GROQ_API_KEY secret for the ai-chat edge function, then try again."}
            </p>
          </div>
        )}

        {pending && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
            <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden="true" />
            Thinking…
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        className="border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <div className="flex items-end gap-2 rounded-lg border bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring">
          <label htmlFor="ai-assistant-input" className="sr-only">
            Ask the assistant
          </label>
          <textarea
            id="ai-assistant-input"
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask about your deals, tasks or pipeline…"
            maxLength={4000}
            className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent px-1 py-2 text-sm placeholder:text-muted-foreground focus:outline-none"
          />
          {pending ? (
            <Button type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={stop} aria-label="Stop generating">
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : (
            <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={!input.trim()} aria-label="Send">
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="mt-1.5 px-1 text-xs text-muted-foreground">
          Enter to send · Shift+Enter for a new line · Answers can be wrong — check before acting.
        </p>
      </form>
    </section>
  );
}

export default FloatingAiCopilot;
