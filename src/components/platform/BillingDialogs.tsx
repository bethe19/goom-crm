import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { errorMessage } from "@/components/settings/validation";
import { formatDate } from "@/lib/formatters";
import { isPlanId, PLAN_ORDER, PLANS, type PlanId } from "@/lib/plans";
import { useActivatePlatformWorkspace, useExtendPlatformTrial, type PlatformWorkspaceRow } from "@/hooks/usePlatform";
import {
  ACTIVATION_MONTHS,
  TRIAL_EXTENSION_DAYS,
  activationEndsAt,
  defaultActivationPlan,
  trialExtendedTo,
} from "./platformUtils";

interface DialogProps {
  workspace: PlatformWorkspaceRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const monthsLabel = (m: number) => `${m} ${m === 1 ? "month" : "months"}`;

/** "Activate…": after payment, set the plan and extend the paid period (platform_activate_workspace). */
export function ActivateWorkspaceDialog({ workspace, open, onOpenChange }: DialogProps) {
  const activate = useActivatePlatformWorkspace();
  return (
    <Dialog open={open} onOpenChange={(o) => !activate.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        {/* Mounted per opening, so the choices start from fresh defaults each time. */}
        <ActivateForm workspace={workspace} activate={activate} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ActivateForm({
  workspace,
  activate,
  onClose,
}: {
  workspace: PlatformWorkspaceRow;
  activate: ReturnType<typeof useActivatePlatformWorkspace>;
  onClose: () => void;
}) {
  const [plan, setPlan] = useState<PlanId>(() => defaultActivationPlan(workspace));
  const [months, setMonths] = useState<number>(1);
  const name = workspace.name || "this workspace";
  const currentPaidUntil = workspace.billing_state === "active" ? workspace.paid_until : null;
  const endsAt = activationEndsAt(workspace.paid_until, months);

  const submit = () => {
    if (activate.isPending) return;
    activate.mutate(
      { orgId: workspace.id, plan, months },
      {
        onSuccess: () => {
          toast.success(`${name} is active on ${PLANS[plan].name} until ${formatDate(endsAt)}`);
          onClose();
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Activate {name}</DialogTitle>
        <DialogDescription>
          Use this once payment has been received. It sets the plan, extends the paid period and clears any pending request.
        </DialogDescription>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="activate-plan">Plan</Label>
            <Select value={plan} onValueChange={(v) => isPlanId(v) && setPlan(v)}>
              <SelectTrigger id="activate-plan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLAN_ORDER.map((id) => (
                  <SelectItem key={id} value={id}>
                    {PLANS[id].name}
                    {id === workspace.requested_plan ? " (requested)" : id === workspace.plan ? " (current)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="activate-months">Paid period</Label>
            <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
              <SelectTrigger id="activate-months">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVATION_MONTHS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {monthsLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
          {currentPaidUntil ? `Currently paid until ${formatDate(currentPaidUntil)}. ` : ""}
          Paid until <span className="font-medium text-foreground">{formatDate(endsAt)}</span> after activation
          {currentPaidUntil ? " (added to the current period)" : ""}.
        </p>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={activate.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={activate.isPending}>
            {activate.isPending ? "Activating…" : `Activate ${PLANS[plan].name} for ${monthsLabel(months)}`}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

/** "Extend trial…": give more free trial days (platform_extend_trial). */
export function ExtendTrialDialog({ workspace, open, onOpenChange }: DialogProps) {
  const extend = useExtendPlatformTrial();
  return (
    <Dialog open={open} onOpenChange={(o) => !extend.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <ExtendTrialForm workspace={workspace} extend={extend} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ExtendTrialForm({
  workspace,
  extend,
  onClose,
}: {
  workspace: PlatformWorkspaceRow;
  extend: ReturnType<typeof useExtendPlatformTrial>;
  onClose: () => void;
}) {
  const [days, setDays] = useState<number>(TRIAL_EXTENSION_DAYS[0]);
  const name = workspace.name || "this workspace";
  const endsAt = trialExtendedTo(workspace.trial_ends_at, days);
  const expired = workspace.billing_state === "expired";

  const submit = () => {
    if (extend.isPending) return;
    extend.mutate(
      { orgId: workspace.id, days },
      {
        onSuccess: () => {
          toast.success(`${name}'s trial now ends ${formatDate(endsAt)}`);
          onClose();
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Extend {name}'s trial</DialogTitle>
        <DialogDescription>
          {expired
            ? "The trial has ended, so the extension starts today and reopens the workspace for its members right away."
            : "Adds days to the end of the current trial."}
        </DialogDescription>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="extend-days">Extend by</Label>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger id="extend-days">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRIAL_EXTENSION_DAYS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d} days
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
          {workspace.trial_ends_at ? `${expired ? "Trial ended" : "Trial ends"} ${formatDate(workspace.trial_ends_at)}. ` : ""}
          New trial end: <span className="font-medium text-foreground">{formatDate(endsAt)}</span>.
        </p>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={extend.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={extend.isPending}>
            {extend.isPending ? "Extending…" : `Extend by ${days} days`}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
