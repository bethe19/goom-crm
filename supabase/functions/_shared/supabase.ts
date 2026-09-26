// Supabase clients + caller authentication for edge functions.
import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

function env(name: string, ...fallbacks: string[]): string | undefined {
  for (const key of [name, ...fallbacks]) {
    const value = Deno.env.get(key);
    if (value) return value;
  }
  return undefined;
}

const SUPABASE_URL = env("SUPABASE_URL");
const SUPABASE_ANON_KEY = env("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY");
const SUPABASE_SERVICE_ROLE_KEY = env("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY");

const noSession = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

/** Service-role client: bypasses RLS. Only use after checking the caller's permissions. */
export function adminClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not available to the function.");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, noSession);
}

/**
 * Verifies the caller's access token (Authorization: Bearer <jwt>) with Supabase Auth.
 * Returns the user, or null when the header is missing, malformed, expired or revoked.
 */
export async function getCaller(req: Request): Promise<User | null> {
  const header = req.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match?.[1]?.trim();
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  // A publishable/anon key is not a user session.
  if (token === SUPABASE_ANON_KEY || token.startsWith("sb_")) return null;

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    ...noSession,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}
