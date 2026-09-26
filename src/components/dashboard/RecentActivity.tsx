import { Link } from "react-router-dom";
import { Activity as ActivityIcon, ArrowUpRight, Calendar, FileText, Mail, Phone } from "lucide-react";
import { useActivities } from "@/hooks/useActivities";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/common/States";
import { formatRelativeDate } from "@/lib/formatters";
import { SectionCard } from "./ChartParts";
import { ACTIVITY_SERIES } from "./chartTheme";

const TYPE_COLOR = Object.fromEntries(ACTIVITY_SERIES.map((s) => [s.key, s.color])) as Record<string, string>;

const TYPE_META: Record<string, { icon: typeof Phone; label: string }> = {
  call: { icon: Phone, label: "Call" },
  email: { icon: Mail, label: "Email" },
  meeting: { icon: Calendar, label: "Meeting" },
  note: { icon: FileText, label: "Note" },
};

/** The workspace's latest logged activities. */
export function RecentActivity({ limit = 6 }: { limit?: number }) {
  const { data, isLoading, isError, error, refetch } = useActivities({ limit });

  return (
    <SectionCard
      title="Recent activity"
      description="Latest calls, emails, meetings and notes"
      action={
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground">
          <Link to="/activities">
            All activity <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </Button>
      }
    >
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <ErrorState compact error={error} onRetry={() => refetch()} title="Couldn't load activity" />
      ) : !data || data.length === 0 ? (
        <EmptyState
          compact
          icon={ActivityIcon}
          title="No activity yet"
          description="Log calls, emails and meetings to keep your team in the loop."
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/activities?new=1">Log activity</Link>
            </Button>
          }
        />
      ) : (
        <ol className="relative space-y-3 before:absolute before:bottom-3 before:left-4 before:top-3 before:w-px before:bg-border">
          {data.map((a) => {
            const meta = TYPE_META[a.type] ?? TYPE_META.note;
            const Icon = meta.icon;
            const about =
              a.deals?.title ?? (a.contacts ? `${a.contacts.first_name} ${a.contacts.last_name ?? ""}`.trim() : null);
            return (
              <li key={a.id} className="flex items-start gap-3">
                <span className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground">
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  <span
                    aria-hidden
                    className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-card"
                    style={{ backgroundColor: TYPE_COLOR[a.type] ?? TYPE_COLOR.note }}
                  />
                  <span className="sr-only">{meta.label}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{a.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {meta.label}
                    {about ? ` · ${about}` : ""} · <time dateTime={a.created_at}>{formatRelativeDate(a.created_at)}</time>
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </SectionCard>
  );
}
