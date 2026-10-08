import { Suspense, useCallback, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, Loader2, LogOut, MessageSquarePlus, RotateCw } from "lucide-react";
import { useAuth, type ContextErrorKind } from "@/contexts/AuthContext";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { useGlobalShortcuts } from "@/hooks/useHotkeys";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { GMark } from "@/components/GMark";
import { AppSidebar } from "./AppSidebar";
import { CommandPaletteTrigger, GlobalSearch, KeyboardShortcutsDialog } from "./GlobalSearch";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationCenter } from "./NotificationCenter";
import { BetaFeedbackDialog } from "./BetaFeedbackDialog";
import { ProductTour } from "./ProductTour";
import { FloatingAiCopilot } from "./dashboard/FloatingAiCopilot";
import { TrialBanner } from "./billing/TrialBanner";
import { TrialEndedScreen } from "./billing/TrialEndedScreen";

function FullPageLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background" aria-busy="true">
      <GMark className="h-8 w-8 text-foreground" />
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Loading your workspace" />
    </div>
  );
}

/** Skeleton shown inside the shell while a lazily loaded page chunk arrives. */
function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading page">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

const WORKSPACE_ERROR_COPY: Record<ContextErrorKind, { title: string; body: string }> = {
  schema_outdated: {
    title: "Database update required",
    body: "You signed in successfully, but this Goom installation's database hasn't been upgraded to the latest version yet, so your workspace can't be loaded. Whoever manages the Supabase project needs to apply the latest migrations (see supabase/README.md), then press Retry.",
  },
  network: {
    title: "Can't reach the server",
    body: "You're signed in, but we couldn't reach the database to load your workspace. Check your connection and try again.",
  },
  no_workspace: {
    title: "No workspace found",
    body: "Your account isn't a member of any workspace. If you were invited, open the invitation link again; otherwise try again or contact your workspace admin.",
  },
  suspended: {
    title: "Workspace suspended",
    body: "This workspace has been suspended, so its data can't be opened right now. Nothing has been deleted. Contact Goom support to find out why and to get it reactivated.",
  },
  other: {
    title: "We couldn't load your workspace",
    body: "You're signed in, but your workspace and role couldn't be loaded. Try again; if it keeps happening, share the details below with whoever manages your Goom installation.",
  },
};

function WorkspaceError({ message, kind }: { message: string; kind: ContextErrorKind }) {
  const { refreshUserRole, signOut } = useAuth();
  const navigate = useNavigate();
  const [retrying, setRetrying] = useState(false);
  const copy = WORKSPACE_ERROR_COPY[kind];
  // Retrying won't lift a suspension; only offer it for transient/setup errors.
  const canRetry = kind !== "suspended";

  const retry = async () => {
    setRetrying(true);
    try {
      await refreshUserRole();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div role="alert" className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{copy.body}</p>
        <details className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">Technical details</summary>
          <p className="mt-2 font-mono [overflow-wrap:anywhere]">{message}</p>
        </details>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={async () => {
              await signOut();
              navigate("/auth", { replace: true });
            }}
          >
            <LogOut /> Sign out
          </Button>
          {canRetry ? (
            <Button onClick={retry} loading={retrying}>
              {!retrying && <RotateCw />}
              {retrying ? "Retrying…" : "Retry"}
            </Button>
          ) : (
            <Button asChild>
              <a href="/contact">Contact support</a>
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}

function readSidebarCookie(): boolean {
  if (typeof document === "undefined") return true;
  return !document.cookie.split("; ").includes("sidebar:state=false");
}

/** The platform console without the workspace shell (the operator's own workspace is unavailable). */
function BarePlatformLayout() {
  return (
    <main className="mx-auto w-full max-w-7xl p-4 md:p-6 lg:p-8">
      <ErrorBoundary>
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </ErrorBoundary>
    </main>
  );
}

export function AppLayout() {
  const { session, loading, contextError, contextErrorKind, organization, isPlatformAdmin } = useAuth();
  const { data: onboardingStatus, isLoading: onboardingLoading } = useOnboardingStatus();
  const location = useLocation();
  const navigate = useNavigate();
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [tourSignal, setTourSignal] = useState(0);

  const expired = organization?.billingState === "expired";
  const showOnboarding = !!onboardingStatus?.needsOnboarding && !onboardingDismissed;
  const shellReady = !loading && !!session && !contextError && !expired && !onboardingLoading && !showOnboarding;

  const openShortcuts = useCallback(() => setShortcutsOpen(true), []);
  const openFeedback = useCallback(() => setFeedbackOpen(true), []);
  const startTour = useCallback(() => setTourSignal((n) => n + 1), []);

  useGlobalShortcuts({
    enabled: shellReady,
    onOpenPalette: () => setPaletteOpen((o) => !o),
    onShowHelp: openShortcuts,
    onNavigate: (to) => navigate(to),
  });

  if (loading) return <FullPageLoader />;
  if (!session) return <Navigate to="/auth" replace state={{ from: location }} />;
  if ((contextError || expired) && isPlatformAdmin && location.pathname === "/platform") return <BarePlatformLayout />;
  if (contextError) return <WorkspaceError message={contextError} kind={contextErrorKind ?? "other"} />;
  // Trial or subscription ended: the workspace's data is locked server-side until a plan is active.
  if (expired) return <TrialEndedScreen />;
  if (onboardingLoading) return <FullPageLoader />;
  if (showOnboarding) {
    return (
      <ErrorBoundary>
        <OnboardingWizard onComplete={() => setOnboardingDismissed(true)} />
      </ErrorBoundary>
    );
  }

  return (
    <SidebarProvider defaultOpen={readSidebarCookie()}>
      <a
        href="#main-content"
        className="sr-only z-[70] rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <AppSidebar onOpenFeedback={openFeedback} onOpenShortcuts={openShortcuts} onStartTour={startTour} />

      <SidebarInset className="min-w-0 bg-background">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarTrigger className="h-8 w-8 text-muted-foreground hover:text-foreground" />
            </TooltipTrigger>
            <TooltipContent side="bottom">Toggle sidebar</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="mr-1 hidden h-5 sm:block" />

          <CommandPaletteTrigger onOpen={() => setPaletteOpen(true)} />

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openFeedback}
                  className="w-9 px-0 text-muted-foreground hover:text-foreground sm:w-auto sm:px-2.5"
                  aria-label="Send feedback"
                >
                  <MessageSquarePlus />
                  <span className="hidden sm:inline">Feedback</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="sm:hidden">Send feedback</TooltipContent>
            </Tooltip>
            <NotificationCenter />
            <ThemeToggle />
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-7xl flex-1 p-4 md:p-6 lg:p-8">
          <TrialBanner />
          <ErrorBoundary resetKey={location.pathname}>
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </SidebarInset>

      <GlobalSearch
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onShowShortcuts={openShortcuts}
        onOpenFeedback={openFeedback}
      />
      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <BetaFeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      <FloatingAiCopilot />
      <ProductTour enabled={shellReady} startSignal={tourSignal} />
    </SidebarProvider>
  );
}
