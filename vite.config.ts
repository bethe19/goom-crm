import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const REQUIRED_ENV = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"] as const;

// Provider key formats that must never be exposed through a VITE_* variable.
const SECRET_PATTERNS: [RegExp, string][] = [
  [/^gsk_/, "Groq API key"],
  [/^sk-/, "OpenAI-style API key"],
  [/^sb_secret_/, "Supabase secret key"],
  [/^re_[A-Za-z0-9]+_/, "Resend API key"],
  [/^GOCSPX-/, "Google OAuth client secret"],
];

// A production bundle without real Supabase settings would load and then fail on every request.
// Fail the build instead, and refuse anything that looks like a server-side secret.
function assertProductionEnv(env: Record<string, string>) {
  const missing = REQUIRED_ENV.filter((k) => !env[k] || /placeholder|your[-_]/i.test(env[k]));
  if (missing.length) {
    throw new Error(`Missing or placeholder environment variables for production build: ${missing.join(", ")}. See .env.example.`);
  }
  for (const [name, value] of Object.entries(env)) {
    const hit = SECRET_PATTERNS.find(([re]) => re.test(value.trim()));
    if (hit) {
      throw new Error(`${name} looks like a ${hit[1]}. VITE_* variables are public; move it to an Edge Function secret and remove it from .env.`);
    }
  }
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (key.startsWith("sb_secret_")) {
    throw new Error("VITE_SUPABASE_PUBLISHABLE_KEY is a secret key. Use the publishable (anon) key; VITE_* values are public.");
  }
  if (key.startsWith("eyJ")) {
    try {
      const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"));
      if (payload.role !== "anon") {
        throw new Error(`VITE_SUPABASE_PUBLISHABLE_KEY has role "${payload.role}". Only the anon key may be bundled.`);
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("VITE_")) throw err;
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === "build" && mode === "production") {
    assertProductionEnv(loadEnv(mode, process.cwd(), "VITE_"));
  }

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          // Long-lived vendor chunks: app deploys don't invalidate them.
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            supabase: ["@supabase/supabase-js"],
            query: ["@tanstack/react-query"],
            charts: ["recharts"],
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
