import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://placeholder-project.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_placeholder_key";

if (!import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes("placeholder")) {
  console.info(
    "[Supabase Client] Running with sandbox/demo configuration. To connect to your live database, add your Supabase URL and key to .env."
  );
}


function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

// Resilient browser storage adapter with in-memory fallback
function getSafeStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const testKey = "__sb_storage_test__";
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {
    // In-memory fallback if third-party cookies/storage are disabled
    const memory = new Map<string, string>();
    return {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
      removeItem: (key: string) => { memory.delete(key); },
      clear: () => { memory.clear(); },
      key: (index: number) => Array.from(memory.keys())[index] ?? null,
      length: memory.size,
    } as Storage;
  }
}

const authStorage = getSafeStorage();

// The key supabase-js derives by default, so existing sessions survive.
const AUTH_STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;

/**
 * Removes the persisted session. supabase-js keeps it when the /logout request fails (offline,
 * 5xx), which would sign the previous user back in on the next load.
 */
export function clearPersistedAuth(): void {
  for (const suffix of ["", "-code-verifier", "-user"]) {
    try {
      authStorage?.removeItem(AUTH_STORAGE_KEY + suffix);
    } catch {
      // storage unavailable
    }
  }
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: {
    fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
  },
  auth: {
    storage: authStorage,
    storageKey: AUTH_STORAGE_KEY,
    persistSession: true,
    autoRefreshToken: true,
  },
});

