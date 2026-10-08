/**
 * AI client. All model calls go through the `ai-chat` Supabase Edge Function, which holds the
 * provider key server-side and rate-limits per user. No API keys ever live in client code.
 */
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AiRole = "system" | "user" | "assistant";

export interface AiMessage {
  role: AiRole;
  content: string;
}

export interface AiChatOptions {
  temperature?: number;
  max_tokens?: number;
  /** Aborts the underlying request (e.g. when the user presses Stop). */
  signal?: AbortSignal;
}

interface AiChatResponse {
  content?: string;
  error?: string;
}

/** Error body from the edge function (`{ error, code }`) or the Supabase gateway (`{ message }`). */
export interface AiErrorBody {
  error?: string;
  code?: string;
  message?: string;
}

export class AiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "AiError";
    this.status = status;
  }
}

/** 503 from the edge function: no AI provider key is configured on the server. */
export class AiNotConfiguredError extends AiError {
  constructor() {
    super("The AI assistant isn't set up for this workspace yet.", 503);
    this.name = "AiNotConfiguredError";
  }
}

/** 404 from the Supabase gateway: the `ai-chat` edge function was never deployed. */
export class AiNotDeployedError extends AiError {
  constructor() {
    super("The AI service isn't deployed yet. See supabase/README.md → Edge functions.", 404);
    this.name = "AiNotDeployedError";
  }
}

/** 429 `rate_limit`: the per-user minute/day guard. */
export class AiRateLimitError extends AiError {
  constructor(message = "You've sent a lot of requests in a short time. Please wait a minute and try again.") {
    super(message, 429);
    this.name = "AiRateLimitError";
  }
}

/** 429 `plan_limit`: the workspace used its monthly AI allowance for its plan. */
export class AiPlanLimitError extends AiError {
  constructor(message = "Your workspace has used this month's AI requests for its plan. Upgrade the plan for more.") {
    super(message, 429);
    this.name = "AiPlanLimitError";
  }
}

export class AiAbortedError extends AiError {
  constructor() {
    super("Request cancelled.");
    this.name = "AiAbortedError";
  }
}

const FUNCTION_NOT_FOUND = /requested function was not found/i;

/** The server may try a fallback model after a 30 s provider timeout; give up after that. */
const REQUEST_TIMEOUT_MS = 75_000;
const TIMED_OUT_MESSAGE = "The assistant took too long to answer. Please try again.";

/** Server messages are written for users, but never show anything long or unexpected. */
function safeServerMessage(text: string | undefined): string | undefined {
  const t = text?.trim();
  return t && t.length <= 300 && !/[<>{}]/.test(t) ? t : undefined;
}

/** Maps an HTTP status (and the error body, when readable) from the edge function to a typed, user-safe error. */
export function aiErrorFromStatus(status: number | undefined, body: AiErrorBody | null = null): AiError {
  const serverMessage = safeServerMessage(body?.error);
  if (status === 404 || FUNCTION_NOT_FOUND.test(body?.message ?? "") || FUNCTION_NOT_FOUND.test(body?.error ?? "")) {
    return new AiNotDeployedError();
  }
  if (status === 503) return new AiNotConfiguredError();
  if (status === 429) {
    if (body?.code === "plan_limit") return new AiPlanLimitError(serverMessage);
    return new AiRateLimitError(serverMessage);
  }
  if (status === 401) return new AiError("Your session has expired. Please sign in again.", 401);
  if (status === 403 && serverMessage) return new AiError(serverMessage, 403);
  // e.g. "This conversation is too long for the assistant…": retrying the same request won't help.
  if ((status === 400 || status === 413) && serverMessage) return new AiError(serverMessage, status);
  return new AiError("The assistant couldn't answer right now. Please try again.", status);
}

/** Reads the JSON error body from a FunctionsHttpError/RelayError context (a fetch Response). */
async function readErrorBody(context: unknown): Promise<{ status?: number; body: AiErrorBody | null }> {
  const res = context as Response | undefined;
  const status = typeof res?.status === "number" ? res.status : undefined;
  if (!res || typeof res.clone !== "function") return { status, body: null };
  try {
    const text = await res.clone().text();
    try {
      return { status, body: JSON.parse(text) as AiErrorBody };
    } catch {
      return { status, body: { message: text.slice(0, 300) } };
    }
  } catch {
    return { status, body: null };
  }
}

/**
 * Sends a conversation to the `ai-chat` edge function and returns the assistant's reply.
 * Request: `{ messages, temperature?, max_tokens? }` → `{ content }` (see supabase/functions/ai-chat).
 * Throws AiNotDeployedError (404), AiNotConfiguredError (503), AiPlanLimitError / AiRateLimitError (429),
 * AiAbortedError, or AiError.
 */
export async function chat(messages: AiMessage[], opts: AiChatOptions = {}): Promise<string> {
  const { signal, temperature, max_tokens } = opts;
  if (signal?.aborted) throw new AiAbortedError();

  let result: { data: AiChatResponse | null; error: unknown };
  try {
    result = await supabase.functions.invoke<AiChatResponse>("ai-chat", {
      body: { messages, temperature, max_tokens },
      signal,
      timeout: REQUEST_TIMEOUT_MS,
    });
  } catch (err) {
    if (signal?.aborted) throw new AiAbortedError();
    if (err instanceof DOMException && err.name === "AbortError") throw new AiError(TIMED_OUT_MESSAGE);
    throw new AiError("Couldn't reach the assistant. Check your connection and try again.");
  }

  if (signal?.aborted) throw new AiAbortedError();

  const { data, error } = result;
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const { status, body } = await readErrorBody(error.context);
      throw aiErrorFromStatus(status, body);
    }
    if (error instanceof FunctionsFetchError) {
      if (signal?.aborted) throw new AiAbortedError();
      const cause = (error.context as { name?: string } | undefined)?.name;
      if (cause === "AbortError") throw new AiError(TIMED_OUT_MESSAGE);
      throw new AiError("Couldn't reach the assistant. Check your connection and try again.");
    }
    if (error instanceof FunctionsRelayError) {
      const { status, body } = await readErrorBody(error.context);
      if (status === 404 || FUNCTION_NOT_FOUND.test(body?.message ?? "") || FUNCTION_NOT_FOUND.test(error.message)) {
        throw new AiNotDeployedError();
      }
      throw new AiError("The assistant service is temporarily unavailable. Please try again shortly.");
    }
    if (error instanceof Error && FUNCTION_NOT_FOUND.test(error.message)) throw new AiNotDeployedError();
    throw new AiError("The assistant couldn't answer right now. Please try again.");
  }

  const content = typeof data?.content === "string" ? data.content.trim() : "";
  if (!content) throw new AiError("The assistant returned an empty answer. Please try again.");
  return content;
}

/* -------------------------------------------------------------------------------------------- */
/* Prompt helpers (workspace-agnostic)                                                           */
/* -------------------------------------------------------------------------------------------- */

export interface AssistantContextInput {
  workspaceName?: string | null;
  userName?: string | null;
  userRole?: string | null;
  currency: string;
  today: string; // YYYY-MM-DD
  /** Compact, pre-formatted workspace summary (see buildWorkspaceSummary in the copilot). */
  workspaceSummary: string;
}

/**
 * Builds the workspace context sent as the "system" message. The ai-chat function owns the
 * assistant's instructions and treats this text as data, so it holds facts only.
 */
export function buildAssistantSystemPrompt(ctx: AssistantContextInput): string {
  const who = [ctx.userName, ctx.userRole ? `(${ctx.userRole})` : null].filter(Boolean).join(" ");
  return [
    `User: ${who || "unknown"}${ctx.workspaceName ? ` · Workspace: "${ctx.workspaceName}"` : ""}`,
    `Today: ${ctx.today} · Currency: ${ctx.currency}`,
    "",
    "WORKSPACE DATA:",
    ctx.workspaceSummary.trim() || "(The workspace has no records yet.)",
  ].join("\n");
}

/** Keeps the system prompt + the most recent turns within a rough character budget. */
export function trimHistory(history: AiMessage[], maxTurns = 8, maxChars = 12_000): AiMessage[] {
  const recent = history.slice(-maxTurns);
  let total = 0;
  const kept: AiMessage[] = [];
  for (let i = recent.length - 1; i >= 0; i--) {
    total += recent[i].content.length;
    if (total > maxChars && kept.length > 0) break;
    kept.unshift(recent[i]);
  }
  // A conversation sent to the model should start with a user turn.
  while (kept.length > 0 && kept[0].role !== "user") kept.shift();
  return kept;
}

/**
 * Normalises model output to the markdown subset MarkdownView renders
 * (**bold**, *italic*, "- " lists, line breaks). Links are shown as plain text: CRM notes the
 * model reads can contain planted instructions, so its output must not become clickable links.
 */
export function normalizeAiMarkdown(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => (label === href ? href : `${label} (${href})`))
    .replace(/^```[a-z]*\s*$/gim, "") // drop code fences
    .replace(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/gm, "**$1**") // headings → bold line
    .replace(/^(\s*)[*•+]\s+/gm, "$1- ") // alternative bullets → "- "
    .replace(/^\s+- /gm, "- ") // flatten nested bullets
    .replace(/^\s*[-*_]{3,}\s*$/gm, "") // horizontal rules
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* -------------------------------------------------------------------------------------------- */
/* Opening the assistant from elsewhere (command palette, empty states, …)                       */
/* -------------------------------------------------------------------------------------------- */

export const OPEN_ASSISTANT_EVENT = "goom:open-assistant";

/** Opens the floating assistant panel; with `prompt`, asks that question right away. */
export function openAssistant(prompt?: string): void {
  window.dispatchEvent(new CustomEvent<{ prompt?: string }>(OPEN_ASSISTANT_EVENT, { detail: { prompt } }));
}
