import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "manager" | "rep";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userRole: AppRole | null;
  isAdmin: boolean;
  isManager: boolean;
  loading: boolean;
  isDemoMode: boolean;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
  signOut: () => Promise<void>;
  refreshUserRole: () => Promise<void>;
}

// Demo user for display purposes only — never used to make real DB calls
const DEMO_USER: User = {
  id: "demo-user-alex-vance",
  app_metadata: {},
  user_metadata: { full_name: "Alex Vance", company: "Goom Global", title: "Account Executive" },
  aud: "authenticated",
  created_at: "2026-01-01T00:00:00Z",
  email: "alex.vance@goomcrm.io",
  role: "authenticated",
  updated_at: new Date().toISOString(),
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  userRole: null,
  isAdmin: false,
  isManager: false,
  loading: true,
  isDemoMode: false,
  enterDemoMode: () => {},
  exitDemoMode: () => {},
  signOut: async () => {},
  refreshUserRole: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState<boolean>(() => {
    return localStorage.getItem("goom_demo_active") !== "true";
  });
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    return localStorage.getItem("goom_demo_active") === "true";
  });

  const fetchRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (!error && data?.role) {
        setUserRole(data.role as AppRole);
      } else {
        setUserRole("rep");
      }
    } catch {
      // Silent: default to rep on network error
      setUserRole("rep");
    }
  };

  useEffect(() => {
    // 1. If demo active from previous session, restore it immediately
    if (localStorage.getItem("goom_demo_active") === "true") {
      setSession(null); // demo mode never has a real session
      setIsDemoMode(true);
      setUserRole("rep");
      setLoading(false);
      return;
    }

    let isMounted = true;

    // Safety timeout: ensure loading is NEVER stuck at true for more than 1.5 seconds
    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 1500);

    // 2. Subscribe to auth changes
    // CRITICAL: Do NOT await supabase queries directly inside onAuthStateChange callback,
    // as Supabase auth v2 holds an internal mutex that deadlocks PostgREST queries.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!isMounted) return;

        if (localStorage.getItem("goom_demo_active") === "true") {
          return;
        }

        setSession(newSession);
        setLoading(false);

        if (newSession?.user) {
          // Defer role query to next microtask outside the auth event lock
          setTimeout(() => {
            if (isMounted) {
              fetchRole(newSession.user.id);
            }
          }, 0);
        } else {
          setUserRole(null);
        }
      }
    );

    // 3. Resolve initial session on mount
    supabase.auth.getSession()
      .then(({ data: { session: currentSession } }) => {
        if (!isMounted) return;
        if (localStorage.getItem("goom_demo_active") === "true") return;

        setSession(currentSession);
        if (currentSession?.user) {
          setTimeout(() => {
            if (isMounted) fetchRole(currentSession.user.id);
          }, 0);
        } else {
          setUserRole(null);
        }
      })
      .catch(() => {
        // Silent: network error handled by safety timeout
      })
      .finally(() => {
        if (isMounted && localStorage.getItem("goom_demo_active") !== "true") {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const refreshUserRole = async () => {
    if (session?.user?.id && !isDemoMode) {
      await fetchRole(session.user.id);
    }
  };

  const enterDemoMode = () => {
    localStorage.setItem("goom_demo_active", "true");
    setIsDemoMode(true);
    setSession(null); // no real session in demo mode
    setUserRole("rep");
    setLoading(false);
  };

  const exitDemoMode = () => {
    localStorage.removeItem("goom_demo_active");
    setIsDemoMode(false);
    setUserRole(null);
    setLoading(true);

    const safety = setTimeout(() => setLoading(false), 1500);

    supabase.auth.getSession()
      .then(({ data: { session: currentSession } }) => {
        setSession(currentSession);
        if (currentSession?.user) {
          setTimeout(() => fetchRole(currentSession.user.id), 0);
        }
      })
      .catch(() => {
        setSession(null);
      })
      .finally(() => {
        clearTimeout(safety);
        setLoading(false);
      });
  };

  const signOut = async () => {
    localStorage.removeItem("goom_demo_active");
    setIsDemoMode(false);
    setSession(null);
    setUserRole(null);
    try {
      await supabase.auth.signOut();
    } catch {
      // Silent: best-effort sign out
    }
  };

  // Role-based flags — never granted in demo mode
  const isAdmin = !isDemoMode && userRole === "admin";
  const isManager = !isDemoMode && userRole === "manager";

  // In demo mode expose the demo user for display; otherwise use the real session user
  const user = isDemoMode ? DEMO_USER : (session?.user ?? null);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        userRole,
        isAdmin,
        isManager,
        loading,
        isDemoMode,
        enterDemoMode,
        exitDemoMode,
        signOut,
        refreshUserRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
