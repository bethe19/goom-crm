import { Ban, CheckCircle2 } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { isPlanId, PLANS } from "@/lib/plans";

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
