// @ts-types="https://deno.land/x/deno/cli/tsc/dts/lib.deno.d.ts"
/// <reference lib="deno.ns" />
// ai-chat: authenticated, rate-limited proxy to Groq's OpenAI-compatible chat API.
//
// Request  (POST, Authorization: Bearer <user access token>):
//   { messages: [{ role: "system" | "user" | "assistant", content: string }], temperature?, max_tokens? }
// Response: 200 { content: string }
//   errors:  { error: string, code?: string } with 400 (bad input), 401 (not signed in),
//            403 (no active workspace, code "no_workspace"), 405,
//            429 (Retry-After header; code "rate_limit" = per-user minute/day guard,
//                 code "plan_limit" = the workspace's monthly AI allowance for its plan is used up),
//            500/502 (provider/internal failure), 503 (AI not configured).
//
// Secrets (supabase secrets set ...): GROQ_API_KEY (required), GROQ_MODEL (optional,
// default llama-3.3-70b-versatile), GROQ_FALLBACK_MODEL (optional, default llama-3.1-8b-instant),
// AI_RATE_LIMIT_PER_MINUTE / AI_RATE_LIMIT_PER_DAY (optional, default 20 / 300).
import { errorResponse, json, preflight } from "../_shared/cors.ts";
import { adminClient, getCaller } from "../_shared/supabase.ts";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_FALLBACK_MODEL = "llama-3.1-8b-instant";

const MAX_MESSAGES = 40;
const MAX_CHARS_PER_MESSAGE = 24_000;
const MAX_TOTAL_CHARS = 60_000;
const DEFAULT_MAX_TOKENS = 800;
const MAX_TOKENS_CAP = 2_048;
const PROVIDER_TIMEOUT_MS = 30_000;

type Role = "system" | "user" | "assistant";
interface ChatMessage { role: Role; content: string }

function intFromEnv(name: string, fallback: number): number {
  const n = Number.parseInt(Deno.env.get(name) ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseMessages(raw: unknown): ChatMessage[] | string {
  if (!Array.isArray(raw) || raw.length === 0) return "messages must be a non-empty array.";
  // Keep the system prompt(s) and the most recent turns if the conversation is long.
  const system = raw.filter((m) => m?.role === "system");
  const rest = raw.filter((m) => m?.role !== "system");
  const trimmed = [...system.slice(0, 2), ...rest.slice(-(MAX_MESSAGES - Math.min(system.length, 2)))];

  const out: ChatMessage[] = [];
  let total = 0;
  for (const m of trimmed) {
    if (!m || typeof m !== "object") return "Each message must be an object.";
    const { role, content } = m as { role?: unknown; content?: unknown };
    if (role !== "system" && role !== "user" && role !== "assistant") return "Invalid message role.";
    if (typeof content !== "string") return "Message content must be a string.";
    const text = content.slice(0, MAX_CHARS_PER_MESSAGE);
    total += text.length;
    out.push({ role, content: text });
  }
  if (!out.some((m) => m.role === "user")) return "At least one user message is required.";
  if (total > MAX_TOTAL_CHARS) {
    // Drop the oldest non-system turns until the conversation fits.
    while (total > MAX_TOTAL_CHARS) {
      const idx = out.findIndex((m) => m.role !== "system");
      if (idx === -1 || out.filter((m) => m.role !== "system").length <= 1) break;
      total -= out[idx].content.length;
      out.splice(idx, 1);
    }
    if (total > MAX_TOTAL_CHARS) return "The conversation is too long. Start a new chat.";
  }
  return out;
}

interface GroqResult { ok: true; content: string; model: string; promptTokens?: number; completionTokens?: number }
interface GroqFailure { ok: false; status: number; retryable: boolean; message: string }

async function callGroq(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
): Promise<GroqResult | GroqFailure> {
  let res: Response;
  try {
    res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: false }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("ai-chat: provider request failed", model, err instanceof Error ? err.message : err);
    return { ok: false, status: 502, retryable: true, message: "The AI provider did not respond." };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("ai-chat: provider error", model, res.status, body.slice(0, 500));
    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: 503, retryable: false, message: "The AI provider rejected the server's API key." };
    }
    if (res.status === 429) {
      return { ok: false, status: 429, retryable: true, message: "The AI provider is busy. Try again in a moment." };
    }
    const modelProblem = res.status === 404 || (res.status === 400 && /model/i.test(body));
    return {
      ok: false,
      status: 502,
      retryable: modelProblem || res.status >= 500,
      message: "The AI provider returned an error.",
    };
  }

  const data = await res.json().catch(() => null) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    model?: string;
  } | null;
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    return { ok: false, status: 502, retryable: true, message: "The AI provider returned an empty answer." };
  }
  return {
    ok: true,
    content: content.trim(),
    model: data?.model ?? model,
    promptTokens: data?.usage?.prompt_tokens,
    completionTokens: data?.usage?.completion_tokens,
  };
}

interface QuotaRow {
  allowed: boolean;
  retry_after_seconds: number;
  usage_id: string | null;
  /** null when allowed; "rate_minute" | "rate_day" | "monthly_limit" | "no_workspace" */
  reason?: string | null;
  plan?: string | null;
  monthly_limit?: number | null;
  monthly_used?: number | null;
}

const PLAN_NAMES: Record<string, string> = { starter: "Starter", growth: "Growth", enterprise: "Enterprise" };

/** Maps a denied quota check to the response the client sees. */
function quotaDenial(row: QuotaRow | null): {
  status: number;
  code: string;
  message: string;
  headers: Record<string, string>;
} {
  const retry = String(Math.max(1, row?.retry_after_seconds ?? 60));
  switch (row?.reason) {
    case "monthly_limit": {
      const plan = PLAN_NAMES[row.plan ?? ""] ?? "current";
      const limit = new Intl.NumberFormat("en-US").format(row.monthly_limit ?? 0);
      return {
        status: 429,
        code: "plan_limit",
        message: `Your workspace has used its ${limit} AI requests for this month on the ${plan} plan. ` +
          "Upgrade the plan for more, or wait until the allowance resets on the 1st.",
        headers: { "Retry-After": retry },
      };
    }
    case "no_workspace":
      return {
        status: 403,
        code: "no_workspace",
        message: "The assistant is unavailable because you're not in an active workspace.",
        headers: {},
      };
    case "rate_day":
      return {
        status: 429,
        code: "rate_limit",
        message: "You've reached today's assistant limit. Try again tomorrow.",
        headers: { "Retry-After": retry },
      };
    default:
      return {
        status: 429,
        code: "rate_limit",
        message: "You're sending requests too quickly. Wait a minute and try again.",
        headers: { "Retry-After": retry },
      };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return errorResponse(req, 405, "Method not allowed.");

  const user = await getCaller(req);
  if (!user) return errorResponse(req, 401, "Sign in to use the assistant.");

  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) return errorResponse(req, 503, "The AI assistant is not configured on the server.");

  let body: { messages?: unknown; temperature?: unknown; max_tokens?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse(req, 400, "Request body must be JSON.");
  }

  const messages = parseMessages(body?.messages);
  if (typeof messages === "string") return errorResponse(req, 400, messages);

  const temperature = typeof body.temperature === "number" && Number.isFinite(body.temperature)
    ? Math.min(Math.max(body.temperature, 0), 1.5)
    : 0.4;
  const maxTokens = typeof body.max_tokens === "number" && Number.isFinite(body.max_tokens)
    ? Math.min(Math.max(Math.floor(body.max_tokens), 16), MAX_TOKENS_CAP)
    : DEFAULT_MAX_TOKENS;

  const model = Deno.env.get("GROQ_MODEL") || DEFAULT_MODEL;
  const fallbackModel = Deno.env.get("GROQ_FALLBACK_MODEL") || DEFAULT_FALLBACK_MODEL;

  // Per-user rate limits + the workspace's monthly plan allowance (atomic check + record).
  let admin;
  let usageId: string | null = null;
  try {
    admin = adminClient();
    const { data, error } = await admin.rpc("consume_ai_quota", {
      p_user_id: user.id,
      p_per_minute: intFromEnv("AI_RATE_LIMIT_PER_MINUTE", 20),
      p_per_day: intFromEnv("AI_RATE_LIMIT_PER_DAY", 300),
      p_model: model,
    });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as QuotaRow | null;
    if (!row?.allowed) {
      const denied = quotaDenial(row);
      return json(req, { error: denied.message, code: denied.code }, denied.status, denied.headers);
    }
    usageId = row.usage_id;
  } catch (err) {
    console.error("ai-chat: rate limit check failed", err instanceof Error ? err.message : err);
    return errorResponse(req, 500, "The assistant is temporarily unavailable.");
  }

  let result = await callGroq(apiKey, model, messages, temperature, maxTokens);
  if (!result.ok && result.retryable && result.status !== 429 && fallbackModel && fallbackModel !== model) {
    result = await callGroq(apiKey, fallbackModel, messages, temperature, maxTokens);
  }

  if (!result.ok) {
    // Failed answers still count toward the per-minute/day guards, but not toward the
    // workspace's monthly plan allowance.
    if (usageId) {
      const { error } = await admin.from("ai_usage").update({ failed: true }).eq("id", usageId);
      if (error) console.error("ai-chat: could not mark the failed request", error.message);
    }
    return errorResponse(req, result.status, result.message);
  }

  if (usageId) {
    const { error } = await admin.from("ai_usage").update({
      model: result.model,
      prompt_tokens: result.promptTokens ?? null,
      completion_tokens: result.completionTokens ?? null,
    }).eq("id", usageId);
    if (error) console.error("ai-chat: could not record token usage", error.message);
  }

  return json(req, { content: result.content });
});
