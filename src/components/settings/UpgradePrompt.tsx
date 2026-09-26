import { Link } from "react-router-dom";
import { ArrowUpRight, Lock, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { FEATURE_LABELS, formatLimit, minimumPlanFor, type PlanFeature, type PlanLimits } from "@/lib/plans";
import { usePlan } from "@/hooks/usePlan";
import { cn } from "@/lib/utils";

export const BILLING_PATH = "/settings?tab=billing";

const FEATURE_BLURBS: Record<PlanFeature, string> = {
  forecast: "Project revenue against quota with a weighted forecast by month and owner.",
  advanced_reports: "Period comparisons, win/loss trends, leaderboard, lost reasons and activity mix.",
  csv_import: "Bring contacts, companies and deals in from a spreadsheet with column mapping.",
  csv_export: "Download every record in the workspace as CSV.",
  audit_history: "See every change made to a deal: who changed what, and when.",
  workspace_backup: "Download a full JSON backup of the workspace.",
  priority_support: "Faster answers from the Goom team.",
};

/** The call to action shown in upgrade prompts: admins can switch the plan, others ask an admin. */
function UpgradeAction({ planName, compact }: { planName: string; compact?: boolean }) {
  const { can } = useAuth();
  if (can("workspace.billing")) {
    return (
      <Button asChild size="sm" variant={compact ? "outline" : "default"} className="gap-1.5">
        <Link to={BILLING_PATH}>
          Upgrade to {planName} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </Button>
    );
  }
  return <p className="text-xs text-muted-foreground">Ask your workspace admin to upgrade to {planName}.</p>;
}

/**
 * Locked state for a plan feature (e.g. Forecast on Starter). Renders nothing when the current
 * plan already includes the feature, so it can be dropped in unconditionally.
 */
export function UpgradePrompt({ feature, compact, className }: { feature: PlanFeature; compact?: boolean; className?: string }) {
  const { hasFeature } = useAuth();
  if (hasFeature(feature)) return null;
  const plan = minimumPlanFor(feature);

  if (compact) {
    return (
      <div
        className={cn(
          "flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between",
          className,
        )}
      >
        <div className="flex items-start gap-2.5">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="text-sm font-medium">
              {FEATURE_LABELS[feature]} is on the {plan.name} plan
            </p>
            <p className="text-xs text-muted-foreground">{FEATURE_BLURBS[feature]}</p>
          </div>
        </div>
        <div className="shrink-0">
          <UpgradeAction planName={plan.name} compact />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Lock className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="text-base font-semibold">
        {FEATURE_LABELS[feature]} is available on {plan.name}
      </h3>
      <p className="mt-1 max-w-sm text-balance text-sm text-muted-foreground">{FEATURE_BLURBS[feature]}</p>
      <div className="mt-5">
        <UpgradeAction planName={plan.name} />
      </div>
    </div>
  );
}

const LIMIT_NOUNS: Record<keyof PlanLimits, string> = {
  seats: "seats (members and pending invitations)",
  pipelines: "pipelines",
  contacts: "contacts",
  ai_requests_per_month: "AI requests per month",
};

/**
 * Inline notice shown before an action that would exceed a plan limit (invite, new pipeline,
 * new contact, import). Renders nothing unless `wouldExceed(limit, count)` is true.
 */
export function LimitNotice({
  limit,
  count = 1,
  className,
  action,
}: {
  limit: keyof PlanLimits;
  /** How many would be added (e.g. rows in an import). */
  count?: number;
  className?: string;
  /** Verb phrase for the message, e.g. "import these contacts". */
  action?: string;
}) {
  const { plan, wouldExceed, remaining } = usePlan();
  const { can } = useAuth();
  if (!wouldExceed(limit, count)) return null;
  const left = remaining(limit) ?? 0;
  const max = plan.limits[limit];

  return (
    <div role="status" className={cn("flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm", className)}>
      <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">
          Your {plan.name} plan includes {formatLimit(max)} {LIMIT_NOUNS[limit]}.
        </p>
        <p className="text-xs text-muted-foreground">
          {left === 0 ? "You've reached the limit" : `Only ${formatLimit(left)} left`}
          {action ? `, so you can't ${action}` : ""}.{" "}
          {can("workspace.billing") ? (
            <Link to={BILLING_PATH} className="font-medium text-foreground underline underline-offset-2">
              Upgrade your plan
            </Link>
          ) : (
            "Ask your workspace admin to upgrade."
          )}
        </p>
      </div>
    </div>
  );
}
