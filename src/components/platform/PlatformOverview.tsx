import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Ban, Bot, Building2, Clock, Contact, CreditCard, Handshake, Inbox, Lock, MailCheck, UserPlus, Users, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/States";
import { SectionCard } from "@/components/dashboard/ChartParts";
import { formatNumber, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { PLAN_ORDER, PLANS } from "@/lib/plans";
import { usePlatformOverview, type PlatformOverview as Overview } from "@/hooks/usePlatform";
import { ActivityCharts } from "./ActivityCharts";

interface Tile {
  label: string;
  value: number;
  icon: LucideIcon;
  sub?: string;
  /** Highlight (e.g. plan requests waiting for payment details). */
  attention?: boolean;
}

function tilesFor(o: Overview): Tile[] {
  const share = (part: number, whole: number) => (whole > 0 ? formatPercent(part / whole) : "—");
  return [
    { label: "Workspaces", value: o.total_workspaces, icon: Building2, sub: "All time" },
    { label: "Active workspaces", value: o.active_workspaces_30d, icon: Activity, sub: `${share(o.active_workspaces_30d, o.total_workspaces)} active in 30 days` },
    { label: "Suspended", value: o.suspended_workspaces, icon: Ban, sub: o.suspended_workspaces ? "Members can't access these" : "None suspended" },
    { label: "Users", value: o.total_users, icon: Users, sub: "All accounts" },
    { label: "Confirmed users", value: o.confirmed_users, icon: MailCheck, sub: `${share(o.confirmed_users, o.total_users)} confirmed their email` },
    { label: "Signups (7 days)", value: o.signups_7d, icon: UserPlus, sub: "New accounts this week" },
    { label: "Signups (30 days)", value: o.signups_30d, icon: UserPlus, sub: "New accounts this month" },
    { label: "AI requests (30 days)", value: o.ai_requests_30d, icon: Bot, sub: "Across all workspaces" },
    { label: "Deals", value: o.total_deals, icon: Handshake, sub: "Count only, all workspaces" },
    { label: "Contacts", value: o.total_contacts, icon: Contact, sub: "Count only, all workspaces" },
  ];
}

function billingTilesFor(o: Overview): Tile[] {
  return [
    { label: "Paying", value: o.paying_workspaces, icon: CreditCard, sub: "Paid period running" },
    { label: "On free trial", value: o.trialing_workspaces, icon: Clock, sub: "Trial running, not paid" },
    { label: "Expired", value: o.expired_workspaces, icon: Lock, sub: o.expired_workspaces ? "Data locked until activated" : "None locked" },
    {
      label: "Plan requests",
      value: o.plan_requests,
      icon: Inbox,
      sub: o.plan_requests ? "Waiting for payment details" : "Nothing pending",
      attention: o.plan_requests > 0,
    },
  ];
}

function StatTile({ tile }: { tile: Tile }) {
  const Icon = tile.icon;
  return (
    <div className={cn("min-w-0 rounded-xl border bg-card p-4", tile.attention ? "border-warning/40 bg-warning/5" : "border-border")}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-muted-foreground">{tile.label}</p>
        <Icon className={cn("h-4 w-4 shrink-0", tile.attention ? "text-warning" : "text-muted-foreground")} aria-hidden />
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-foreground">{formatNumber(tile.value)}</p>
      {tile.sub && <p className="mt-1 truncate text-xs text-muted-foreground">{tile.sub}</p>}
    </div>
  );
}

function PlanMix({ counts }: { counts: Overview["plan_counts"] }) {
  const total = PLAN_ORDER.reduce((s, id) => s + counts[id], 0);
  return (
    <SectionCard title="Plan mix" description="Workspaces on each plan">
      <ul className="grid gap-4 sm:grid-cols-3">
        {PLAN_ORDER.map((id) => {
          const count = counts[id];
          const pct = total > 0 ? count / total : 0;
          return (
            <li key={id} className="min-w-0">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-foreground">{PLANS[id].name}</span>
                <span className="tabular-nums text-foreground">
                  {formatNumber(count)} <span className="text-xs text-muted-foreground">· {formatPercent(pct)}</span>
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="h-full rounded-full bg-foreground transition-[width] duration-200 ease-out" style={{ width: `${pct * 100}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

export function PlatformOverview() {
  const query = usePlatformOverview();

  return (
    <div className="space-y-6">
      {query.isPending ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading overview">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="mt-3 h-7 w-1/2" />
                <Skeleton className="mt-2 h-3 w-3/4" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[98px] rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-[108px] w-full rounded-xl" />
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} title="Couldn't load platform overview" />
      ) : (
        <>
          <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {tilesFor(query.data).map((t) => (
              <StatTile key={t.label} tile={t} />
            ))}
          </section>
          <section aria-labelledby="billing-overview-heading" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 id="billing-overview-heading" className="text-sm font-semibold">
                Billing
              </h2>
              {query.data.plan_requests > 0 && (
                <Link
                  to="/platform?tab=workspaces"
                  className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Review {query.data.plan_requests === 1 ? "request" : "requests"} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {billingTilesFor(query.data).map((t) => (
                <StatTile key={t.label} tile={t} />
              ))}
            </div>
          </section>
          <PlanMix counts={query.data.plan_counts} />
        </>
      )}

      <ActivityCharts />
    </div>
  );
}
