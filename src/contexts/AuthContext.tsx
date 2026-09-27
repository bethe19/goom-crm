import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isPlanId, planHasFeature, type PlanFeature, type PlanId } from "@/lib/plans";
import { roleCan, type Permission } from "@/lib/permissions";

export type AppRole = "admin" | "manager" | "rep";

export type ContextErrorKind = "schema_outdated" | "network" | "no_workspace" | "suspended" | "other";

/** Classifies a get_my_context failure so the UI can say what actually went wrong. */
export function classifyContextError(error: { code?: string; message?: string } | null): ContextErrorKind {
  if (!error) return "no_workspace";
  const msg = (error.message ?? "").toLowerCase();
  // PGRST202: function not in the schema cache; PGRST205 / 42P01 / 42883: missing table or function.
  if (["PGRST202", "PGRST205", "42P01", "42883"].includes(error.code ?? "") || msg.includes("could not find the function")) {
    return "schema_outdated";
  }
  if (msg.includes("suspended")) return "suspended";
  if (msg.includes("failed to fetch") || msg.includes("network")) return "network";
  return "other";
}

export interface Organization {
  id: string;
  name: string;
  monthly_quota: number;
  currency: string;
  plan: PlanId;
}

/** sessionStorage key holding an invitation token until the invitee is signed in. */
export const INVITE_TOKEN_KEY = "goom_invite_token";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  /** The workspace the user is currently working in. Every record belongs to one. */
  organization: Organization | null;
  /** The user's role in the current workspace. */
  userRole: AppRole | null;
  isAdmin: boolean;
  isManager: boolean;
  /** Admins and managers: may delete others' records, change settings, see team reports. */
  canManage: boolean;
  /** RBAC check for the current workspace role (see src/lib/permissions.ts). */
  can: (permission: Permission) => boolean;
  /** Whether the current workspace's plan includes a feature (see src/lib/plans.ts). */
  hasFeature: (feature: PlanFeature) => boolean;
  /** SaaS operator (platform_admins table): may open /platform. Never grants access to workspace data. */
  isPlatformAdmin: boolean;
  /** True until the session AND (when signed in) the workspace + role have resolved. */
  loading: boolean;
  /** Set when the workspace context couldn't be loaded (e.g. database migrations not applied). */
  contextError: string | null;
  /** Why it failed: the database is missing the workspace schema, the network failed, or something else. */
  contextErrorKind: ContextErrorKind | null;
  signOut: () => Promise<void>;
  /** Re-fetches workspace + role (after accepting an invite, renaming the workspace, role changes). */
  refreshUserRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};

type MyContextRow = {
  organization_id: string;
  organization_name: string;
  monthly_quota: number | null;
  currency: string | null;
  role: AppRole;
  plan: string | null;
  is_platform_admin: boolean | null;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionResolved, setSessionResolved] = useState(false);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [contextLoadedFor, setContextLoadedFor] = useState<string | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [contextErrorKind, setContextErrorKind] = useState<ContextErrorKind | null>(null);
  const loadingFor = useRef<string | null>(null);

  const loadContext = useCallback(async (userId: string) => {
    loadingFor.current = userId;
    setContextError(null);
    setContextErrorKind(null);

    // Accept a pending invitation first so the user lands in the workspace they were invited to.
    // (If the confirmation email was opened in another tab, get_my_context accepts the invite
    // from the sign-up metadata server-side.)
    const inviteToken = sessionStorage.getItem(INVITE_TOKEN_KEY);
    if (inviteToken) {
      const { error } = await supabase.rpc("accept_invitation", { p_token: inviteToken });
      sessionStorage.removeItem(INVITE_TOKEN_KEY);
      if (error) console.warn("Could not accept invitation:", error.message);
      else queryClient.invalidateQueries();
    }

    const { data, error } = await supabase.rpc("get_my_context");
    if (loadingFor.current !== userId) return; // a newer sign-in superseded this load

    const row = (Array.isArray(data) ? data[0] : data) as MyContextRow | null | undefined;
    if (error || !row) {
      setOrganization(null);
      setUserRole(null);
      setIsPlatformAdmin(false);
      setContextError(error?.message ?? "No workspace found for this account.");
      setContextErrorKind(classifyContextError(error));
    } else {
      setOrganization({
        id: row.organization_id,
        name: row.organization_name,
        monthly_quota: Number(row.monthly_quota ?? 0),
        currency: row.currency ?? "ETB",
        plan: isPlanId(row.plan) ? row.plan : "starter",
      });
      setUserRole(row.role);
      setIsPlatformAdmin(!!row.is_platform_admin);
    }
    setContextLoadedFor(userId);
  }, [queryClient]);

  useEffect(() => {
    let active = true;

    // Supabase holds an auth lock during this callback: never await queries inside it.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!active) return;
      setSession(newSession);
      setSessionResolved(true);
      if (!newSession) {
        loadingFor.current = null;
        setOrganization(null);
        setUserRole(null);
        setIsPlatformAdmin(false);
        setContextLoadedFor(null);
        if (event === "SIGNED_OUT") queryClient.clear();
      } else if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "USER_UPDATED") {
        const uid = newSession.user.id;
        if (loadingFor.current !== uid) setTimeout(() => active && loadContext(uid), 0);
      }
    });

    supabase.auth.getSession()
      .then(({ data: { session: current } }) => {
        if (!active) return;
        setSession(current);
        if (current?.user && loadingFor.current !== current.user.id) loadContext(current.user.id);
      })
      .catch(() => { /* network error: user sees the sign-in screen */ })
      .finally(() => active && setSessionResolved(true));

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadContext, queryClient]);

  const refreshUserRole = useCallback(async () => {
    if (session?.user?.id) {
      loadingFor.current = null;
      await loadContext(session.user.id);
    }
  }, [session?.user?.id, loadContext]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // best effort; local state is cleared by onAuthStateChange or below
    }
    setSession(null);
    setOrganization(null);
    setUserRole(null);
    setIsPlatformAdmin(false);
    queryClient.clear();
  }, [queryClient]);

  const user = session?.user ?? null;
  const loading = !sessionResolved || (!!user && contextLoadedFor !== user.id);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        organization,
        userRole,
        isAdmin: userRole === "admin",
        isManager: userRole === "manager",
        canManage: userRole === "admin" || userRole === "manager",
        can: (permission: Permission) => roleCan(userRole, permission),
        hasFeature: (feature: PlanFeature) => planHasFeature(organization?.plan, feature),
        isPlatformAdmin,
        loading,
        contextError,
        contextErrorKind,
        signOut,
        refreshUserRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
