import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, CircleAlert, Clock, Info, Sparkles } from "lucide-react";
import { useAuth, type BillingState } from "@/contexts/AuthContext";
import { usePlan, useRequestPlan, useSetWorkspacePlan, type WorkspaceUsage } from "@/hooks/usePlan";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { ErrorState } from "@/components/common/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FEATURE_LABELS, PLAN_ORDER, PLANS, TRIAL_AI_REQUESTS_PER_MONTH, formatLimit, type PlanId, type PlanLimits } from "@/lib/plans";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { SettingsSection } from "./shared";
import { errorMessage } from "./validation";
import {
  billingStatusLabel,
  featuresLost,
  limitsExceeded,
  planChangeMode,
  planDirection,
  planRequestMessage,
  usageMeter,
  type MeterTone,
} from "./billing";

const METERS: {
  limit: keyof PlanLimits;
  usage: keyof WorkspaceUsage;
  label: string;
  hint: (u: WorkspaceUsage, trialing: boolean) => string | null;
}[] = [
  {
    limit: "seats",
    usage: "seats_used",
    label: "Seats",
    hint: (u) =>
      `${u.members} member${u.members === 1 ? "" : "s"}${u.pending_invites ? ` + ${u.pending_invites} pending invitation${u.pending_invites === 1 ? "" : "s"}` : ""}`,
  },
  { limit: "pipelines", usage: "pipelines", label: "Pipelines", hint: () => null },
  { limit: "contacts", usage: "contacts", label: "Contacts", hint: () => null },
  {
    limit: "ai_requests_per_month",
    usage: "ai_requests_this_month",
    label: "AI requests this month",
    hint: (_u, trialing) =>
      trialing
        ? `Counts assistant messages from everyone in the workspace. Trials include up to ${formatLimit(TRIAL_AI_REQUESTS_PER_MONTH)} a month.`
        : "Counts assistant messages from everyone in the workspace.",
  },
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

/**
 * A plan's price, limits and highlights, with `children` as the footer (actions). Shared by the
 * billing settings and the paywall shown when a trial or subscription ends.
 */
export function PlanCard({
  id,
  current,
  badges,
  children,
}: {
  id: PlanId;
  /** Highlights the card as the workspace's plan. */
  current?: boolean;
  badges?: ReactNode;
  children?: ReactNode;
}) {
  const p = PLANS[id];
  return (
    <article
      aria-label={`${p.name} plan${current ? " (current)" : ""}`}
      className={cn("flex flex-col rounded-xl border bg-card p-5", current ? "border-foreground/40 ring-1 ring-foreground/10" : "border-border")}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{p.name}</h3>
        {badges && <div className="flex flex-wrap justify-end gap-1">{badges}</div>}
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

      {children && <div className="mt-5 space-y-1.5">{children}</div>}
    </article>
  );
}

const STATE_BADGE: Record<BillingState, { label: string; variant: "info" | "success" | "destructive" }> = {
  trialing: { label: "Free trial", variant: "info" },
  active: { label: "Paid", variant: "success" },
  expired: { label: "Ended", variant: "destructive" },
};

/** What the billing state means for this workspace, in plain words. */
function stateExplanation(state: BillingState, canBill: boolean, trialEndsAt: string | null, paidUntil: string | null): string {
  const trialEnd = trialEndsAt ? formatDate(trialEndsAt) : "the end of your trial";
  const aiNote = `Trials include up to ${formatLimit(TRIAL_AI_REQUESTS_PER_MONTH)} AI assistant requests a month.`;
  if (state === "trialing") {
    return canBill
      ? `Try any plan during your trial — switching is instant. To keep using Goom after ${trialEnd}, request the plan you want: we'll email you payment details (invoice or bank transfer, no card needed) and activate it as soon as payment is confirmed. ${aiNote}`
      : `This workspace is on a free trial until ${trialEnd}. A workspace admin can choose a plan to continue after it. ${aiNote}`;
  }
  if (state === "active") {
    const end = paidUntil ? formatDate(paidUntil) : "the end of the current period";
    return canBill
      ? `Your paid period runs until ${end}. To renew or upgrade, request a plan and we'll email payment details; downgrades apply right away.`
      : `This workspace is on a paid plan until ${end}. Ask a workspace admin about renewals or upgrades.`;
  }
  return canBill
    ? "This workspace's data is safe but locked. Request a plan and we'll email payment details; the workspace reopens as soon as payment is confirmed."
    : "This workspace's data is safe but locked until a workspace admin chooses a plan.";
}

export function BillingSettings() {
  const { can, organization, user } = useAuth();
  const { plan, limits, billingState, usage } = usePlan();
  const setPlan = useSetWorkspacePlan();
  const requestPlan = useRequestPlan();
  const confirm = useConfirm();
  /** `switch:<plan>`, `request:<plan>` or `withdraw` while that action runs. */
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const canBill = can("workspace.billing");
  const trialing = billingState === "trialing";
  const requested = organization?.requestedPlan ?? null;
  const trialEndsAt = organization?.trialEndsAt ?? null;
  const paidUntil = organization?.paidUntil ?? null;
  const email = user?.email ?? null;
  const busy = setPlan.isPending || requestPlan.isPending;

  const run = async (key: string, action: () => Promise<void>) => {
    setActionError(null);
    setPendingAction(key);
    try {
      await action();
    } catch (err) {
      const message = errorMessage(err); // P0001 refusals (usage over the limit, upgrades while paid) are shown verbatim
      setActionError(message);
      toast.error(message);
    } finally {
      setPendingAction(null);
    }
  };

  /** set_workspace_plan: any plan during the trial, downgrades once paid (planChangeMode decides). */
  const switchTo = async (target: PlanId) => {
    const direction = planDirection(plan.id, target);
    const next = PLANS[target];
    const lost = featuresLost(plan.id, target);
    const blockers = limitsExceeded(target, usage.data);
    const again = trialing ? "You can switch again at any time during your trial." : "";
    const description =
      direction === "upgrade"
        ? `The ${next.name} limits and features apply to everyone in the workspace right away. ${again}`
        : [
            lost.length ? `You'll lose access to ${lost.map((f) => FEATURE_LABELS[f].toLowerCase()).join(", ")}.` : "",
            blockers.length
              ? `Your workspace currently has ${blockers.join(", ")}, so the switch will be refused until you reduce usage.`
              : `Your current usage fits within ${next.name}'s limits.`,
            again,
          ]
            .filter(Boolean)
            .join(" ");
    const ok = await confirm({
      title: `Switch to ${next.name}?`,
      description: description.trim(),
      confirmLabel: `Switch to ${next.name}`,
      destructive: direction === "downgrade",
    });
    if (!ok) return;
    await run(`switch:${target}`, async () => {
      await setPlan.mutateAsync(target);
      toast.success(`Your workspace is now on ${next.name}`);
    });
  };

  /** request_plan: the Goom team emails payment details and activates the plan once paid. */
  const requestTo = async (target: PlanId) => {
    const next = PLANS[target];
    const to = email ?? "you";
    const replaces = requested && requested !== target ? ` This replaces your request for ${PLANS[requested].name}.` : "";
    const renewal = billingState === "active" && target === plan.id;
    let description: string;
    if (trialing) {
      description = `We'll email ${to} with payment details (invoice or bank transfer). Your trial continues${trialEndsAt ? ` until ${formatDate(trialEndsAt)}` : ""}; ${next.name} starts as soon as payment is confirmed.`;
    } else if (renewal) {
      description = `We'll email ${to} with payment details to renew ${next.name}. The new period starts when the current one ends${paidUntil ? ` (${formatDate(paidUntil)})` : ""}.`;
    } else if (billingState === "active") {
      description = `You stay on ${plan.name} until payment is confirmed. We'll email ${to} with payment details (invoice or bank transfer); then ${next.name}'s limits and features apply to everyone.`;
    } else {
      description = `We'll email ${to} with payment details (invoice or bank transfer). The workspace reopens on ${next.name} as soon as payment is confirmed.`;
    }
    const ok = await confirm({
      title: renewal ? `Renew ${next.name}?` : `Request ${next.name}?`,
      description: description + replaces,
      confirmLabel: renewal ? "Request renewal" : `Request ${next.name}`,
      destructive: false,
    });
    if (!ok) return;
    await run(`request:${target}`, async () => {
      await requestPlan.mutateAsync(target);
      toast.success(renewal ? "Renewal requested" : `${next.name} requested`, { description: `We'll email ${to} with payment details.` });
    });
  };

  const withdraw = async () => {
    if (!requested) return;
    const ok = await confirm({
      title: `Withdraw your request for ${PLANS[requested].name}?`,
      description: "We won't follow up with payment details for it. You can request a plan again at any time.",
      confirmLabel: "Withdraw request",
      cancelLabel: "Keep request",
      destructive: false,
    });
    if (!ok) return;
    await run("withdraw", async () => {
      await requestPlan.mutateAsync(null);
      toast.success("Request withdrawn");
    });
  };

  const stateBadge = STATE_BADGE[billingState];
  const statusFooter =
    canBill && !requested && billingState !== "expired" ? (
      trialing ? (
        <Button onClick={() => void requestTo(plan.id)} loading={pendingAction === `request:${plan.id}`} disabled={busy}>
          Request {plan.name} to continue after the trial
        </Button>
      ) : (
        <Button variant="outline" onClick={() => void requestTo(plan.id)} loading={pendingAction === `request:${plan.id}`} disabled={busy}>
          Request renewal
        </Button>
      )
    ) : undefined;

  return (
    <div className="space-y-6">
      <SettingsSection title="Plan" description="Limits, features and billing for everyone in this workspace." footer={statusFooter}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
            <Sparkles className="h-5 w-5 text-foreground" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-base font-semibold">
              {plan.name} <Badge variant={stateBadge.variant}>{stateBadge.label}</Badge>
            </p>
            <p className="text-sm text-muted-foreground">{billingStatusLabel({ billingState, trialEndsAt, paidUntil })}</p>
          </div>
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-info/10 px-3 py-2 text-sm text-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden />
          <span>{stateExplanation(billingState, canBill, trialEndsAt, paidUntil)}</span>
        </p>

        {requested && (
          <div
            role="status"
            className="mt-3 flex flex-col gap-3 rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium">
                  {requested === plan.id && billingState === "active" ? "Renewal requested" : `${PLANS[requested].name} requested`}
                </p>
                <p className="text-muted-foreground">
                  {canBill
                    ? planRequestMessage(PLANS[requested].name, email, billingState)
                    : `A workspace admin has requested ${PLANS[requested].name}. It applies as soon as payment is confirmed.`}
                </p>
              </div>
            </div>
            {canBill && (
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => void withdraw()}
                loading={pendingAction === "withdraw"}
                disabled={busy}
              >
                Withdraw request
              </Button>
            )}
          </div>
        )}
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
                limit={limits[m.limit]}
                hint={m.hint(usage.data, trialing)}
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
            {!canBill
              ? "Only workspace admins can change the plan. Ask an admin if your team needs more."
              : trialing
                ? "Switch freely during your trial — changes apply right away. Request the plan you want to continue with after the trial. Downgrades are refused if your current usage doesn't fit the smaller plan."
                : billingState === "active"
                  ? "Downgrades apply right away if your usage fits the smaller plan. Upgrades start once payment is confirmed: request one and we'll email payment details."
                  : "Request a plan and we'll email payment details; the workspace reopens as soon as payment is confirmed."}
          </p>
        </div>

        {actionError && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
            <span>{actionError}</span>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          {PLAN_ORDER.map((id) => {
            const p = PLANS[id];
            const current = id === plan.id;
            const isRequested = requested === id;
            const mode = planChangeMode(billingState, plan.id, id);
            return (
              <PlanCard
                key={id}
                id={id}
                current={current}
                badges={
                  <>
                    {current && <Badge variant="default">Current</Badge>}
                    {isRequested && <Badge variant="info">Requested</Badge>}
                  </>
                }
              >
                {!canBill ? (
                  current ? (
                    <Button variant="outline" className="w-full" disabled>
                      Your current plan
                    </Button>
                  ) : (
                    <p className="text-center text-xs text-muted-foreground">Ask a workspace admin to change plans.</p>
                  )
                ) : (
                  <>
                    {mode === "current" ? (
                      <Button variant="outline" className="w-full" disabled>
                        Your current plan
                      </Button>
                    ) : mode === "switch" ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        loading={pendingAction === `switch:${id}`}
                        disabled={busy}
                        onClick={() => void switchTo(id)}
                      >
                        {pendingAction === `switch:${id}` ? "Switching…" : `Switch to ${p.name}`}
                      </Button>
                    ) : isRequested ? (
                      <Button variant="outline" className="w-full" disabled>
                        {billingState === "active" ? "Upgrade requested" : "Requested"}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full"
                        loading={pendingAction === `request:${id}`}
                        disabled={busy}
                        onClick={() => void requestTo(id)}
                      >
                        {billingState === "active" ? "Request upgrade" : "Request this plan"}
                      </Button>
                    )}
                    {trialing &&
                      (isRequested ? (
                        <p className="text-center text-xs text-muted-foreground">Requested to continue after the trial</p>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          loading={pendingAction === `request:${id}`}
                          disabled={busy}
                          onClick={() => void requestTo(id)}
                        >
                          Request this plan
                          <span className="sr-only"> ({p.name}) to continue after the trial</span>
                        </Button>
                      ))}
                  </>
                )}
              </PlanCard>
            );
          })}
        </div>
      </section>
    </div>
  );
}
