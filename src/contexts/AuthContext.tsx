import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { clearPersistedAuth, supabase } from "@/integrations/supabase/client";
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

/** "trialing" (free trial), "active" (paid until paidUntil) or "expired" (data locked until a plan is activated). */
export type BillingState = "trialing" | "active" | "expired";

export interface Organization {
  id: string;
  name: string;
  monthly_quota: number;
  currency: string;
  plan: PlanId;
  billingState: BillingState;
  /** ISO timestamp; end of the free trial. */
  trialEndsAt: string | null;
  /** ISO timestamp; end of the paid period (null if never paid). */
  paidUntil: string | null;
  /** Plan an admin asked to (re)activate or upgrade to; cleared when the platform activates it. */
  requestedPlan: PlanId | null;
}

/** sessionStorage key holding an invitation token until the invitee is signed in. */
export const INVITE_TOKEN_KEY = "goom_invite_token";

/** localStorage key other tabs watch to follow a workspace switch. */
const ORG_SYNC_KEY = "goom:current-org";

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
  trial_ends_at?: string | null;
  paid_until?: string | null;
  billing_state?: string | null;
  requested_plan?: string | null;
};

function toBillingState(value: string | null | undefined): BillingState {
  // Databases without the billing migration report no state: treat them as paid.
  return value === "trialing" || value === "expired" ? value : "active";
}

/** CRM data cached in browser storage for the signed-in user (cleared on sign-out). */
function clearUserLocalData() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("goom:recent-records:")) localStorage.removeItem(key);
    }
    sessionStorage.removeItem(INVITE_TOKEN_KEY);
  } catch {
    // storage blocked
  }
}

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
  const lastUserId = useRef<string | null>(null);
  const currentOrgId = useRef<string | null>(null);

  const resetContext = useCallback(() => {
    loadingFor.current = null;
    currentOrgId.current = null;
    setOrganization(null);
    setUserRole(null);
    setIsPlatformAdmin(false);
    setContextLoadedFor(null);
  }, []);

  const loadContext = useCallback(async (userId: string, opts: { refresh?: boolean } = {}) => {
    loadingFor.current = userId;
    setContextError(null);
    setContextErrorKind(null);
    try {
      // Accept a pending invitation first so the user lands in the workspace they were invited to.
      // (If the confirmation email was opened in another tab, get_my_context accepts the invite
      // from the sign-up metadata server-side.) Claim the token before awaiting so a concurrent
      // load can't accept it twice.
      let inviteToken: string | null = null;
      try {
        inviteToken = sessionStorage.getItem(INVITE_TOKEN_KEY);
        sessionStorage.removeItem(INVITE_TOKEN_KEY);
      } catch {
        // storage blocked: the invite page accepts it explicitly
      }
      if (inviteToken) {
        const { error } = await supabase.rpc("accept_invitation", { p_token: inviteToken });
        if (error) console.warn("Could not accept invitation:", error.message);
      }

      const { data, error } = await supabase.rpc("get_my_context");
      if (loadingFor.current !== userId) return; // a newer sign-in superseded this load

      const row = (Array.isArray(data) ? data[0] : data) as MyContextRow | null | undefined;
      if (error || !row) {
        const kind = classifyContextError(error);
        // A background refresh that hit a network blip keeps the current workspace on screen.
        if (opts.refresh && kind === "network" && currentOrgId.current) {
          console.warn("Workspace refresh failed:", error?.message);
          return;
        }
        currentOrgId.current = null;
        setOrganization(null);
        setUserRole(null);
        setIsPlatformAdmin(false);
        setContextError(error?.message ?? "No workspace found for this account.");
        setContextErrorKind(kind);
        if (error) {
          // Keep the platform console reachable for operators whose own workspace is unavailable.
          const { data: admin } = await supabase.rpc("is_platform_admin");
          if (loadingFor.current === userId) setIsPlatformAdmin(!!admin);
        }
        return;
      }

      if (currentOrgId.current !== row.organization_id) {
        // Never render one workspace's cached records inside another.
        if (currentOrgId.current !== null) {
          queryClient.removeQueries();
          try {
            localStorage.setItem(ORG_SYNC_KEY, row.organization_id);
          } catch {
            // storage blocked: other tabs catch up on their next load
          }
        }
        currentOrgId.current = row.organization_id;
      }
      setOrganization({
        id: row.organization_id,
        name: row.organization_name,
        monthly_quota: Number(row.monthly_quota ?? 0),
        currency: row.currency ?? "ETB",
        plan: isPlanId(row.plan) ? row.plan : "starter",
        billingState: toBillingState(row.billing_state),
        trialEndsAt: row.trial_ends_at ?? null,
        paidUntil: row.paid_until ?? null,
        requestedPlan: isPlanId(row.requested_plan) ? row.requested_plan : null,
      });
      setUserRole(row.role);
      setIsPlatformAdmin(!!row.is_platform_admin);
    } catch (err) {
      if (loadingFor.current !== userId) return;
      setContextError(err instanceof Error ? err.message : "Couldn't load your workspace.");
      setContextErrorKind("other");
    } finally {
      if (loadingFor.current === userId) setContextLoadedFor(userId);
    }
  }, [queryClient]);

  useEffect(() => {
    let active = true;

    // Supabase holds an auth lock during this callback: never await queries inside it.
    // INITIAL_SESSION always fires (with null when there is no session or it couldn't be read).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!active) return;
      const uid = newSession?.user.id ?? null;

      // Another account signed in (e.g. a confirmation link opened in another tab) or the user
      // signed out: drop everything cached for the previous one.
      if (lastUserId.current !== uid) {
        if (lastUserId.current !== null) {
          queryClient.clear();
          if (!uid) clearUserLocalData();
        }
        lastUserId.current = uid;
        currentOrgId.current = null;
      }

      setSession(newSession);
      setSessionResolved(true);

      if (!uid) {
        resetContext();
        return;
      }
      // Any event that brings a user whose workspace isn't loaded yet (sign-in, password recovery,
      // cross-tab sign-in). Deferred: the auth lock is held here.
      if (loadingFor.current !== uid) {
        setTimeout(() => {
          if (active && loadingFor.current !== uid) void loadContext(uid);
        }, 0);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadContext, queryClient, resetContext]);

  const refreshUserRole = useCallback(async () => {
    if (session?.user?.id) {
      loadingFor.current = null;
      await loadContext(session.user.id, { refresh: true });
    }
  }, [session?.user?.id, loadContext]);

  // Follow workspace switches made in other tabs (writes default to the server-side current
  // workspace, so a stale tab would otherwise save into the wrong one).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === ORG_SYNC_KEY && e.newValue && e.newValue !== currentOrgId.current) void refreshUserRole();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refreshUserRole]);

  // The workspace can change server-side (trial ended, removed by an admin, suspended): re-check
  // when the tab comes back into view.
  const lastVisibleCheck = useRef(0);
  useEffect(() => {
    if (!session?.user?.id) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastVisibleCheck.current < 60_000) return;
      lastVisibleCheck.current = Date.now();
      void refreshUserRole();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [session?.user?.id, refreshUserRole]);

  const signOut = useCallback(async () => {
    let failed = false;
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      failed = !!error;
    } catch {
      failed = true;
    }
    if (failed) clearPersistedAuth();
    clearUserLocalData();
    lastUserId.current = null;
    resetContext();
    setSession(null);
    queryClient.clear();
  }, [queryClient, resetContext]);

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
