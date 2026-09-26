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
