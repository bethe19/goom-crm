import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, CircleAlert, Info, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan, useSetWorkspacePlan, type WorkspaceUsage } from "@/hooks/usePlan";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { ErrorState } from "@/components/common/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FEATURE_LABELS, PLAN_ORDER, PLANS, formatLimit, type PlanId, type PlanLimits } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { SettingsSection } from "./shared";
import { errorMessage } from "./validation";
import { featuresLost, limitsExceeded, planDirection, usageMeter, type MeterTone } from "./billing";

const METERS: { limit: keyof PlanLimits; usage: keyof WorkspaceUsage; label: string; hint: (u: WorkspaceUsage) => string | null }[] = [
  {
    limit: "seats",
    usage: "seats_used",
    label: "Seats",
    hint: (u) =>
      `${u.members} member${u.members === 1 ? "" : "s"}${u.pending_invites ? ` + ${u.pending_invites} pending invitation${u.pending_invites === 1 ? "" : "s"}` : ""}`,
  },
  { limit: "pipelines", usage: "pipelines", label: "Pipelines", hint: () => null },
  { limit: "contacts", usage: "contacts", label: "Contacts", hint: () => null },
  { limit: "ai_requests_per_month", usage: "ai_requests_this_month", label: "AI requests this month", hint: () => "Counts assistant messages from everyone in the workspace." },
];

const TONE_BAR: Record<MeterTone, string> = { ok: "bg-primary", warning: "bg-warning", full: "bg-destructive" };

function Meter({ label, used, limit, hint }: { label: string; used: number; limit: number | null; hint: string | null }) {
  const m = usageMeter(used, limit);
  const id = `meter-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p id={id} className="text-sm font-medium">
          {label}
        </p>
        <p className="text-sm tabular-nums text-muted-foreground">{m.label}</p>
      </div>
      {m.unlimited ? (
        <p className="text-xs text-muted-foreground">Unlimited on your plan.</p>
      ) : (
        <div
          role="progressbar"
          aria-labelledby={id}
          aria-valuemin={0}
          aria-valuemax={limit ?? 0}
          aria-valuenow={Math.min(used, limit ?? used)}
          aria-valuetext={m.label}
          className="h-2 w-full overflow-hidden rounded-full bg-secondary"
        >
          <div className={cn("h-full rounded-full transition-[width] duration-200 ease-out", TONE_BAR[m.tone])} style={{ width: `${m.percent}%` }} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {m.tone === "full" && (
          <span className="inline-flex items-center gap-1 font-medium text-destructive">
            <CircleAlert className="h-3.5 w-3.5" aria-hidden /> Limit reached
          </span>
        )}
        {m.tone === "warning" && (
          <span className="inline-flex items-center gap-1 font-medium text-warning">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {m.percent}% used
          </span>
        )}
        {hint && <span>{hint}</span>}
      </div>
    </div>
  );
}

function limitRows(limits: PlanLimits): { label: string; value: string }[] {
  return [
    { label: "Seats", value: formatLimit(limits.seats) },
    { label: "Pipelines", value: formatLimit(limits.pipelines) },
    { label: "Contacts", value: formatLimit(limits.contacts) },
    { label: "AI requests / month", value: formatLimit(limits.ai_requests_per_month) },
  ];
}

export function BillingSettings() {
  const { can } = useAuth();
  const { plan, usage } = usePlan();
  const setPlan = useSetWorkspacePlan();
  const confirm = useConfirm();
  const [pendingPlan, setPendingPlan] = useState<PlanId | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const canBill = can("workspace.billing");

  const switchTo = async (target: PlanId) => {
    const direction = planDirection(plan.id, target);
    const next = PLANS[target];
    const lost = featuresLost(plan.id, target);
    const blockers = limitsExceeded(target, usage.data);
    const description =
      direction === "upgrade"
        ? `The ${next.name} limits and features apply to everyone in the workspace right away. Billing isn't live during the beta, so this is free.`
        : [
            lost.length ? `You'll lose access to ${lost.map((f) => FEATURE_LABELS[f].toLowerCase()).join(", ")}.` : "",
            blockers.length
              ? `Your workspace currently has ${blockers.join(", ")}, so the switch will be refused until you reduce usage.`
              : `Your current usage fits within ${next.name}'s limits.`,
          ]
            .filter(Boolean)
            .join(" ");
    const ok = await confirm({
      title: `Switch to ${next.name}?`,
      description,
      confirmLabel: `Switch to ${next.name}`,
      destructive: direction === "downgrade",
    });
    if (!ok) return;
    setSwitchError(null);
    setPendingPlan(target);
    try {
      await setPlan.mutateAsync(target);
      toast.success(`Your workspace is now on ${next.name}`);
    } catch (err) {
      const message = errorMessage(err); // P0001 downgrade refusals are shown verbatim
      setSwitchError(message);
      toast.error(message);
    } finally {
      setPendingPlan(null);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Plan"
        description="Limits and features for everyone in this workspace."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <Sparkles className="h-5 w-5 text-foreground" aria-hidden />
            </div>
            <div>
              <p className="flex items-center gap-2 text-base font-semibold">
                {plan.name} <Badge variant="secondary">Current plan</Badge>
              </p>
              <p className="text-sm text-muted-foreground">{plan.tagline}</p>
            </div>
          </div>
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-info/10 px-3 py-2 text-sm text-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden />
          <span>Billing isn't live during the beta — plan changes are free.</span>
        </p>
      </SettingsSection>

      <SettingsSection title="Usage" description="How much of your plan this workspace is using.">
        {usage.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2" aria-busy="true" aria-label="Loading usage">
            {METERS.map((m) => (
              <Skeleton key={m.limit} className="h-[92px] rounded-lg" />
            ))}
          </div>
        ) : usage.isError || !usage.data ? (
          <ErrorState compact error={usage.error} title="Couldn't load usage" onRetry={() => usage.refetch()} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {METERS.map((m) => (
              <Meter
                key={m.limit}
                label={m.label}
                used={usage.data[m.usage]}
                limit={plan.limits[m.limit]}
                hint={m.hint(usage.data)}
              />
            ))}
          </div>
        )}
      </SettingsSection>

      <section aria-labelledby="plans-heading" className="space-y-3">
        <div className="space-y-1">
          <h2 id="plans-heading" className="text-sm font-semibold">
            Plans
          </h2>
          <p className="text-sm text-muted-foreground">
            {canBill
              ? "Switch at any time. Downgrades are refused if your current usage doesn't fit the smaller plan."
              : "Only workspace admins can change the plan. Ask an admin if your team needs more."}
          </p>
        </div>

        {switchError && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
            <span>{switchError}</span>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          {PLAN_ORDER.map((id) => {
            const p = PLANS[id];
            const current = id === plan.id;
            const direction = planDirection(plan.id, id);
            return (
              <article
                key={id}
                aria-label={`${p.name} plan${current ? " (current)" : ""}`}
                className={cn(
                  "flex flex-col rounded-xl border bg-card p-5",
                  current ? "border-foreground/40 ring-1 ring-foreground/10" : "border-border",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{p.name}</h3>
                  {current && <Badge variant="default">Current</Badge>}
                </div>
                <p className="mt-2">
                  <span className="text-2xl font-semibold tabular-nums tracking-tight">${p.price}</span>
                  <span className="text-sm text-muted-foreground"> / month</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{p.tagline}</p>

                <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg bg-muted/50 p-3 text-xs">
                  {limitRows(p.limits).map((r) => (
                    <div key={r.label}>
                      <dt className="text-muted-foreground">{r.label}</dt>
                      <dd className="font-medium tabular-nums">{r.value}</dd>
                    </div>
                  ))}
                </dl>

                <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                  {p.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5">
                  {current ? (
                    <Button variant="outline" className="w-full" disabled>
                      Your current plan
                    </Button>
                  ) : canBill ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      loading={pendingPlan === id}
                      disabled={setPlan.isPending}
                      onClick={() => switchTo(id)}
                    >
                      {pendingPlan === id ? "Switching…" : `${direction === "upgrade" ? "Upgrade" : "Switch"} to ${p.name}`}
                    </Button>
                  ) : (
                    <p className="text-center text-xs text-muted-foreground">Ask a workspace admin to switch plans.</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
