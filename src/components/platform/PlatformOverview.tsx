import type { LucideIcon } from "lucide-react";
import { Ban, Bot, Building2, Contact, Handshake, MailCheck, UserPlus, Users, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/States";
import { SectionCard } from "@/components/dashboard/ChartParts";
import { formatNumber, formatPercent } from "@/lib/formatters";
import { PLAN_ORDER, PLANS } from "@/lib/plans";
import { usePlatformOverview, type PlatformOverview as Overview } from "@/hooks/usePlatform";
import { ActivityCharts } from "./ActivityCharts";

interface Tile {
  label: string;
  value: number;
  icon: LucideIcon;
  sub?: string;
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

function StatTile({ tile }: { tile: Tile }) {
  const Icon = tile.icon;
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-muted-foreground">{tile.label}</p>
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
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
          <PlanMix counts={query.data.plan_counts} />
        </>
      )}

      <ActivityCharts />
    </div>
  );
}
