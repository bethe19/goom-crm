// Shared CORS + JSON helpers for Goom CRM edge functions.
//
// ALLOWED_ORIGINS (optional secret): comma-separated list of browser origins allowed to call the
// functions, e.g. "https://app.example.com,http://localhost:8080". When unset, any origin is
// allowed — acceptable because every function authenticates with the caller's JWT (no cookies).

const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Expose-Headers": "Retry-After",
  };
  if (allowedOrigins.length === 0) {
    headers["Access-Control-Allow-Origin"] = "*";
  } else {
    headers["Access-Control-Allow-Origin"] = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    headers["Vary"] = "Origin";
  }
  return headers;
}

/** Response for the CORS preflight request. */
export function preflight(req: Request): Response {
  return new Response("ok", { headers: corsHeaders(req) });
}

export function json(req: Request, body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8", ...extraHeaders },
  });
}

export function errorResponse(req: Request, status: number, message: string, extraHeaders: Record<string, string> = {}): Response {
  return json(req, { error: message }, status, extraHeaders);
}

/**
 * Reads a JSON request body, refusing anything larger than `maxBytes` before it is buffered.
 */
export async function readJsonBody(
  req: Request,
  maxBytes: number,
): Promise<{ ok: true; value: unknown } | { ok: false; status: 400 | 413; message: string }> {
  const tooLarge = { ok: false as const, status: 413 as const, message: "Request body is too large." };
  const notJson = { ok: false as const, status: 400 as const, message: "Request body must be JSON." };
  if (Number(req.headers.get("Content-Length") ?? "0") > maxBytes) return tooLarge;
  const reader = req.body?.getReader();
  if (!reader) return notJson;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      return tooLarge;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return notJson;
  }
}

/**
 * Deno.serve with CORS preflight handling and a last-resort error handler, so an unexpected
 * exception still reaches the browser as a readable JSON error instead of an opaque CORS failure.
 */
export function serveWithCors(handler: (req: Request) => Promise<Response>): void {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return preflight(req);
    try {
      return await handler(req);
    } catch (err) {
      console.error("unhandled error", err instanceof Error ? err.stack ?? err.message : err);
      return errorResponse(req, 500, "Something went wrong. Please try again.");
    }
  });
}
