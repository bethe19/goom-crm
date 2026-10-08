import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Hourglass, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { BILLING_PATH, daysUntil, isStaleTrialBannerKey, isTrialUrgent, trialBannerDismissKey, trialDaysLeftLabel } from "@/components/settings/billing";
import { formatDate } from "@/lib/formatters";
import { PLANS } from "@/lib/plans";
import { cn } from "@/lib/utils";

function readDismissed(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false; // storage blocked: the banner just shows again
  }
}

function storeDismissed(key: string, orgId: string) {
  try {
    // Keep one key per workspace: drop the ones from earlier days.
    for (const k of Object.keys(localStorage)) {
      if (isStaleTrialBannerKey(k, orgId, key)) localStorage.removeItem(k);
    }
    localStorage.setItem(key, "1");
  } catch {
    // storage blocked: dismissed for this page view only
  }
}

/**
 * Slim notice above page content while the workspace is on its free trial: days left, and for
 * admins a link to choose a plan. Dismissible for the rest of the day; stronger near the end.
 * Renders nothing unless the workspace is trialing.
 */
export function TrialBanner() {
  const { organization, isAdmin } = useAuth();
  const trialing = organization?.billingState === "trialing";
  const key = organization ? trialBannerDismissKey(organization.id) : null;
  const storedDismissed = useMemo(() => (key ? readDismissed(key) : false), [key]);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  if (!organization || !trialing || !key || storedDismissed || dismissedKey === key) return null;

  const days = daysUntil(organization.trialEndsAt) ?? 0;
  const urgent = isTrialUrgent(days);
  const requested = organization.requestedPlan ? PLANS[organization.requestedPlan] : null;

  const dismiss = () => {
    storeDismissed(key, organization.id);
    setDismissedKey(key);
  };

  return (
    <aside
      aria-label="Free trial"
      className={cn(
        "mb-4 flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm md:mb-6",
        urgent ? "border-warning/30 bg-warning/10" : "border-border bg-muted/40",
      )}
    >
      <Hourglass className={cn("h-4 w-4 shrink-0", urgent ? "text-warning" : "text-muted-foreground")} aria-hidden />
      <p className="min-w-0 flex-1">
        <span className="font-medium text-foreground">{trialDaysLeftLabel(days)}</span>
        {organization.trialEndsAt && days > 0 && (
          <span className="hidden text-muted-foreground sm:inline"> · ends {formatDate(organization.trialEndsAt)}</span>
        )}
        {requested ? (
          <span className="text-muted-foreground"> · {requested.name} requested</span>
        ) : (
          !isAdmin && <span className="text-muted-foreground"> · A workspace admin can choose a plan.</span>
        )}
      </p>
      {isAdmin && (
        <Link
          to={BILLING_PATH}
          className="shrink-0 whitespace-nowrap rounded-sm font-medium text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {requested ? "View request" : "Choose a plan"}
        </Link>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={dismiss}
        aria-label="Hide until tomorrow"
      >
        <X aria-hidden />
      </Button>
    </aside>
  );
}
