import { Ban, CheckCircle2, Clock, CreditCard, Lock } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { isPlanId, PLANS } from "@/lib/plans";
import { workspaceBillingBadge, type PlatformWorkspaceRow } from "./platformUtils";

const PLAN_VARIANT: Record<string, BadgeProps["variant"]> = {
  starter: "secondary",
  growth: "info",
  enterprise: "default",
};

export function PlanBadge({ plan }: { plan: string }) {
  const label = isPlanId(plan) ? PLANS[plan].name : plan || "Unknown";
  return <Badge variant={PLAN_VARIANT[plan] ?? "outline"}>{label}</Badge>;
}

export function WorkspaceStatusBadge({ status }: { status: string }) {
  if (status === "suspended") {
    return (
      <Badge variant="destructive">
        <Ban aria-hidden /> Suspended
      </Badge>
    );
  }
  if (status === "active") {
    return (
      <Badge variant="success">
        <CheckCircle2 aria-hidden /> Active
      </Badge>
    );
  }
  return <Badge variant="outline">{status || "Unknown"}</Badge>;
}

/** Trial with days left / paid until a date / expired (data locked). */
export function BillingStateBadge({ workspace }: { workspace: Pick<PlatformWorkspaceRow, "billing_state" | "trial_ends_at" | "paid_until"> }) {
  const info = workspaceBillingBadge(workspace);
  if (info.state === "active") {
    return (
      <Badge variant="success" title={info.detail}>
        <CreditCard aria-hidden /> {info.label}
      </Badge>
    );
  }
  if (info.state === "trialing") {
    return (
      <Badge variant={info.attention ? "warning" : "info"} title={info.detail}>
        <Clock aria-hidden /> {info.label}
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" title={info.detail}>
      <Lock aria-hidden /> {info.label}
    </Badge>
  );
}
