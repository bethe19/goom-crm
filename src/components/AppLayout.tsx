import { useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { GlobalSearch } from "./GlobalSearch";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationCenter } from "./NotificationCenter";
import { BetaFeedbackDialog } from "./BetaFeedbackDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, MessageSquarePlus, Zap, Shield } from "lucide-react";
import { FloatingAiCopilot } from "./dashboard/FloatingAiCopilot";

export function AppLayout() {
  const { session, loading, isDemoMode, exitDemoMode, isAdmin } = useAuth();
  const { data: onboardingStatus, isLoading: onboardingLoading } = useOnboardingStatus();
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  if (loading || (!isDemoMode && !isAdmin && onboardingLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  // Admin users are platform superadmins and never prompted with rep sales onboarding
  if (!isAdmin && !isDemoMode && onboardingStatus?.needsOnboarding && !onboardingDismissed) {
    return <OnboardingWizard onComplete={() => setOnboardingDismissed(true)} />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar onOpenFeedback={() => setFeedbackOpen(true)} />
        <main className="flex-1 overflow-auto">
          {/* Top Bar with 2026 Navigation Controls & Status */}
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border/60 bg-card/60 backdrop-blur-md sticky top-0 z-40">
            <div className="flex items-center gap-2.5">
              <SidebarTrigger />

              <div className="hidden sm:flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="h-5 border-border bg-secondary text-[10px] font-mono text-foreground font-medium"
                >
                  v0.9.8 Beta
                </Badge>

                {isAdmin && (
                  <Badge className="h-5 bg-foreground text-background text-[10px] font-medium gap-1 px-2">
                    <Shield className="h-3 w-3" />
                    <span>Platform Admin</span>
                  </Badge>
                )}

                {isDemoMode && (
                  <button
                    onClick={exitDemoMode}
                    title="Click to switch to standard login"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-[10px] font-medium text-foreground hover:bg-secondary/70 transition-colors"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
                    <span>Demo Sandbox</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <GlobalSearch />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFeedbackOpen(true)}
                className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground gap-1.5 px-2.5"
              >
                <MessageSquarePlus className="h-3.5 w-3.5 text-foreground" />
                <span className="hidden sm:inline">Feedback</span>
              </Button>
              <NotificationCenter />
              <ThemeToggle />
            </div>
          </div>

          <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>

      <FloatingAiCopilot />
      <BetaFeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </SidebarProvider>
  );
}
