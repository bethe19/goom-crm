// Supabase clients + caller authentication for edge functions.
import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.97.0";

function env(name: string, ...fallbacks: string[]): string | undefined {
  for (const key of [name, ...fallbacks]) {
    const value = Deno.env.get(key);
    if (value) return value;
  }
  return undefined;
}

/**
 * A key from SUPABASE_PUBLISHABLE_KEYS / SUPABASE_SECRET_KEYS, which the platform injects as JSON
 * keyed by name ({"default": "sb_..."}); the "default" key wins, and a bare key is accepted too.
 */
function keyFromSet(name: string): string | undefined {
  const raw = Deno.env.get(name)?.trim();
  if (!raw) return undefined;
  if (raw.startsWith("sb_")) return raw;
  try {
    const parsed: unknown = JSON.parse(raw);
    const values = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object"
        ? [(parsed as Record<string, unknown>).default, ...Object.values(parsed)]
        : [];
    return values.find((v): v is string => typeof v === "string" && v.startsWith("sb_"));
  } catch {
    return undefined;
  }
}

const SUPABASE_URL = env("SUPABASE_URL");
// Prefer the sb_publishable_ / sb_secret_ keys: the legacy JWT keys (SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY) stop working once they're disabled in the dashboard.
const LEGACY_ANON_KEY = env("SUPABASE_ANON_KEY");
const SUPABASE_ANON_KEY = env("SUPABASE_PUBLISHABLE_KEY") ?? keyFromSet("SUPABASE_PUBLISHABLE_KEYS") ?? LEGACY_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY =
  env("SUPABASE_SECRET_KEY") ?? keyFromSet("SUPABASE_SECRET_KEYS") ?? env("SUPABASE_SERVICE_ROLE_KEY");

const noSession = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

/** Service-role client: bypasses RLS. Only use after checking the caller's permissions. */
export function adminClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not available to the function.");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, noSession);
}

export type Caller = { user: User; status: 200 } | { user: null; status: 401 | 500 };

/**
 * Verifies the caller's access token (Authorization: Bearer <jwt>) with Supabase Auth.
 * 401 when the header is missing, malformed, expired or revoked; 500 when the function is
 * misconfigured or Auth is unreachable (so an outage isn't reported to users as "signed out").
 */
export async function getCaller(req: Request): Promise<Caller> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("getCaller: SUPABASE_URL / SUPABASE_ANON_KEY are not available to the function.");
    return { user: null, status: 500 };
  }
  const header = req.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match?.[1]?.trim();
  if (!token) return { user: null, status: 401 };
  // A publishable/anon key is not a user session.
  if (token === SUPABASE_ANON_KEY || token === LEGACY_ANON_KEY || token.startsWith("sb_")) return { user: null, status: 401 };

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    ...noSession,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error) {
    if (typeof error.status === "number" && error.status >= 400 && error.status < 500) return { user: null, status: 401 };
    console.error("getCaller: auth lookup failed", error.name, error.message);
    return { user: null, status: 500 };
  }
  return data?.user ? { user: data.user, status: 200 } : { user: null, status: 401 };
}
