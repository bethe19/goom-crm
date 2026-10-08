import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { CheckCircle2, Lock, LogOut, RotateCw, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRequestPlan } from "@/hooks/usePlan";
import { useMyWorkspaces, useSwitchWorkspace } from "@/hooks/useWorkspaces";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { Brand } from "@/components/Brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlanCard } from "@/components/settings/BillingSettings";
import { endedTitle, planRequestMessage } from "@/components/settings/billing";
import { errorMessage } from "@/components/settings/validation";
import { SITE } from "@/components/marketing/site";
import { formatDate } from "@/lib/formatters";
import { ROLE_LABELS } from "@/lib/permissions";
import { PLAN_ORDER, PLANS, type PlanId } from "@/lib/plans";

/** Other workspaces the user can open instead (hidden when there are none). */
function OtherWorkspaces({ currentId }: { currentId: string | undefined }) {
  const navigate = useNavigate();
  const workspaces = useMyWorkspaces();
  const switchWorkspace = useSwitchWorkspace();
  const [target, setTarget] = useState<string | null>(null);
  const others = (workspaces.data ?? []).filter((w) => w.id !== currentId && !w.suspended);
  if (others.length === 0) return null;

  const open = async (id: string) => {
    setTarget(id);
    try {
      await switchWorkspace.mutateAsync(id);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setTarget(null);
    }
  };

  return (
    <section aria-labelledby="other-workspaces-heading" className="mx-auto w-full max-w-2xl rounded-xl border border-border bg-card p-5 sm:p-6">
      <h2 id="other-workspaces-heading" className="text-sm font-semibold">
        Switch to another workspace
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">You're also a member of {others.length === 1 ? "this workspace" : "these workspaces"}.</p>
      <ul className="mt-3 divide-y divide-border">
        {others.map((w) => (
          <li key={w.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium" title={w.name}>
                {w.name || "Untitled workspace"}
              </p>
              <p className="text-xs text-muted-foreground">{ROLE_LABELS[w.role] ?? w.role}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {w.billingState === "expired" && <Badge variant="warning">Needs a plan</Badge>}
              <Button
                size="sm"
                variant="outline"
                loading={target === w.id}
                disabled={switchWorkspace.isPending}
                onClick={() => void open(w.id)}
                aria-label={`Open ${w.name || "untitled workspace"}`}
              >
                Open
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Full-page paywall shown instead of the app when the workspace's trial or paid period has ended
 * (billingState "expired"). The database hides the workspace's data until a plan is active; nothing
 * is deleted. Admins request a plan (payment details are emailed; no card or gateway here).
 */
export function TrialEndedScreen() {
  const { organization, user, isAdmin, refreshUserRole, signOut } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const requestPlan = useRequestPlan();
  const [pending, setPending] = useState<PlanId | "withdraw" | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const paidUntil = organization?.paidUntil ?? null;
  const endedOn = paidUntil ?? organization?.trialEndsAt ?? null;
  const requested = organization?.requestedPlan ?? null;
  const workspaceName = organization?.name || "your workspace";

  const request = async (plan: PlanId) => {
    setPending(plan);
    try {
      await requestPlan.mutateAsync(plan);
      setChoosing(false);
      toast.success(`${PLANS[plan].name} requested`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPending(null);
    }
  };

  const withdraw = async () => {
    if (!requested) return;
    const ok = await confirm({
      title: `Withdraw your request for ${PLANS[requested].name}?`,
      description: "We won't send payment details for it, and the workspace stays locked until a plan is active.",
      confirmLabel: "Withdraw request",
      cancelLabel: "Keep request",
      destructive: true,
    });
    if (!ok) return;
    setPending("withdraw");
    try {
      await requestPlan.mutateAsync(null);
      setChoosing(false);
      toast.success("Request withdrawn");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPending(null);
    }
  };

  const checkAgain = async () => {
    setChecking(true);
    try {
      await refreshUserRole();
      // If a plan is active now, the app replaces this screen; otherwise say we looked.
      setCheckedAt(new Date());
    } finally {
      setChecking(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate("/auth", { replace: true });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-5xl items-center px-4 py-5 sm:px-6">
        <Brand size="md" />
      </header>

      <div className="mx-auto w-full max-w-5xl space-y-8 px-4 pb-16 pt-4 sm:px-6 sm:pt-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10 text-warning">
            <Lock className="h-5 w-5" aria-hidden />
          </div>
          <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">{endedTitle(paidUntil)}</h1>
          <p className="mt-3 text-balance text-sm text-muted-foreground sm:text-base">
            {paidUntil ? "The paid period" : "The free trial"} for <span className="font-medium text-foreground">{workspaceName}</span> ended
            {endedOn ? ` on ${formatDate(endedOn)}` : ""}. Your data is safe: every deal, contact, task and note is kept exactly as you
            left it, and the workspace reopens as soon as a plan is active.
          </p>
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Nothing has been deleted.
          </p>
        </div>

        {!isAdmin ? (
          <section className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-5 text-center sm:p-6">
            <h2 className="text-base font-semibold">Ask a workspace admin to choose a plan.</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {requested
                ? `An admin has requested ${PLANS[requested].name}. The workspace reopens as soon as payment is confirmed.`
                : "Only workspace admins can choose a plan. Once it's active, everyone gets back in with all data as it was."}
            </p>
          </section>
        ) : requested && !choosing ? (
          <section role="status" className="mx-auto max-w-2xl rounded-xl border border-success/25 bg-success/5 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
              <div className="min-w-0 space-y-1">
                <h2 className="text-base font-semibold">Request received</h2>
                <p className="text-sm text-muted-foreground">{planRequestMessage(PLANS[requested].name, user?.email, "expired")}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => void withdraw()} loading={pending === "withdraw"} disabled={requestPlan.isPending}>
                Withdraw request
              </Button>
              <Button variant="outline" onClick={() => setChoosing(true)} disabled={requestPlan.isPending}>
                Change plan
              </Button>
            </div>
          </section>
        ) : (
          <section aria-labelledby="choose-plan-heading" className="space-y-4">
            <div className="mx-auto max-w-2xl text-center">
              <h2 id="choose-plan-heading" className="text-lg font-semibold tracking-tight">
                Choose a plan to reopen {workspaceName}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Request a plan and we'll email you payment details — pay by invoice or bank transfer, no card needed. The workspace
                reopens as soon as payment is confirmed.
              </p>
              {choosing && requested && (
                <Button variant="link" size="sm" className="mt-1" onClick={() => setChoosing(false)}>
                  Keep my request for {PLANS[requested].name}
                </Button>
              )}
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {PLAN_ORDER.map((id) => {
                const isCurrent = id === organization?.plan;
                return (
                  <PlanCard
                    key={id}
                    id={id}
                    current={isCurrent}
                    badges={
                      <>
                        {isCurrent && <Badge variant="secondary">{paidUntil ? "Your plan" : "Your trial plan"}</Badge>}
                        {requested === id && <Badge variant="info">Requested</Badge>}
                      </>
                    }
                  >
                    {requested === id ? (
                      <Button variant="outline" className="w-full" disabled>
                        Requested
                      </Button>
                    ) : (
                      <Button
                        variant={isCurrent ? "default" : "outline"}
                        className="w-full"
                        loading={pending === id}
                        disabled={requestPlan.isPending}
                        onClick={() => void request(id)}
                      >
                        {requested ? `Request ${PLANS[id].name} instead` : "Request this plan"}
                      </Button>
                    )}
                  </PlanCard>
                );
              })}
            </div>
          </section>
        )}

        <OtherWorkspaces currentId={organization?.id} />

        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
            <Button variant="outline" onClick={() => void handleSignOut()} loading={signingOut}>
              {!signingOut && <LogOut aria-hidden />}
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
            <Button variant={isAdmin ? "outline" : "default"} onClick={() => void checkAgain()} loading={checking}>
              {!checking && <RotateCw aria-hidden />}
              {checking ? "Checking…" : "Check again"}
            </Button>
          </div>
          {checkedAt && !checking && (
            <p role="status" className="max-w-md text-xs text-muted-foreground">
              No active plan yet (checked at {format(checkedAt, "p")}). If you've just paid, confirmation can take a little while.
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Questions about plans or payment? Email{" "}
            <a href={`mailto:${SITE.salesEmail}`} className="font-medium text-foreground underline underline-offset-4">
              {SITE.salesEmail}
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
