import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Building2,
  ChevronRight,
  Contact,
  Download,
  FileUp,
  Gauge,
  Handshake,
  KeyRound,
  Kanban,
  ListTodo,
  Loader2,
  Mail,
  MessageSquare,
  Star,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMembers } from "@/hooks/useTeam";
import {
  FEEDBACK_STATUSES,
  exportWorkspaceBackup,
  useUpdateFeedbackStatus,
  useWorkspaceCounts,
  useWorkspaceFeedback,
} from "@/hooks/useWorkspaceAdmin";
import { PageBanner } from "@/components/PageBanner";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/States";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatNumber, formatRelativeDate } from "@/lib/formatters";
import { errorMessage, initials, roleLabel } from "@/components/settings/validation";
import { UpgradePrompt } from "@/components/settings/UpgradePrompt";

export default function Admin() {
  const { organization, hasFeature } = useAuth();
  const canBackup = hasFeature("workspace_backup");
  const [exporting, setExporting] = useState<string | null>(null);

  const exportBackup = async () => {
    if (!organization) return;
    setExporting("starting");
    try {
      const { filename, rows } = await exportWorkspaceBackup(organization, setExporting);
      toast.success(`Backup downloaded (${formatNumber(rows)} records)`, { description: filename });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageBanner title="Workspace admin" description={`An overview of ${organization?.name ?? "your workspace"}.`}>
        {canBackup && (
          <Button variant="outline" className="gap-1.5" onClick={exportBackup} disabled={!!exporting || !organization}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? `Exporting${exporting === "starting" ? "" : ` ${exporting.replace(/_/g, " ")}`}…` : "Export backup"}
          </Button>
        )}
      </PageBanner>

      {!canBackup && <UpgradePrompt feature="workspace_backup" compact />}

      <CountsRow />

      <div className="grid gap-6 lg:grid-cols-2">
        <MembersCard />
        <ShortcutsCard />
      </div>

      <FeedbackCard />
    </div>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function CountsRow() {
  const counts = useWorkspaceCounts();
  const members = useMembers();

  const tiles = [
    { label: "Members", value: members.data?.length, icon: Users, to: "/settings?tab=team", loading: members.isLoading },
    { label: "Deals", value: counts.data?.deals, icon: Handshake, to: "/pipeline", loading: counts.isLoading },
    { label: "Contacts", value: counts.data?.contacts, icon: Contact, to: "/contacts", loading: counts.isLoading },
    { label: "Companies", value: counts.data?.companies, icon: Building2, to: "/companies", loading: counts.isLoading },
    { label: "Open tasks", value: counts.data?.openTasks, icon: ListTodo, to: "/tasks", loading: counts.isLoading },
  ];

  if (counts.isError) {
    return <ErrorState compact error={counts.error} title="Couldn't load workspace totals" onRetry={() => counts.refetch()} />;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map(({ label, value, icon: Icon, to, loading }) => (
        <Link
          key={label}
          to={to}
          className="group rounded-xl border border-border bg-card p-4 transition-colors duration-150 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{label}</span>
            <Icon className="h-4 w-4" aria-hidden />
          </div>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-12" />
          ) : (
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value === undefined ? "—" : formatNumber(value)}</p>
          )}
        </Link>
      ))}
    </div>
  );
}

function MembersCard() {
  const members = useMembers();
  const recent = [...(members.data ?? [])].sort((a, b) => b.joined_at.localeCompare(a.joined_at)).slice(0, 5);

  return (
    <Card
      title="Recently joined"
      action={
        <Button variant="ghost" size="sm" asChild>
          <Link to="/settings?tab=team">Manage team</Link>
        </Button>
      }
    >
      {members.isLoading ? (
        <ListSkeleton rows={3} />
      ) : members.isError ? (
        <ErrorState compact error={members.error} title="Couldn't load members" onRetry={() => members.refetch()} />
      ) : recent.length === 0 ? (
        <EmptyState
          compact
          icon={Users}
          title="Just you so far"
          description="Invite teammates to share the pipeline."
          action={
            <Button asChild size="sm">
              <Link to="/settings?tab=team">Invite teammates</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {recent.map((m) => (
            <li key={m.user_id} className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={m.avatar_url ?? undefined} alt="" />
                <AvatarFallback className="text-xs">{initials(m.full_name, m.email)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.full_name || m.email}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {roleLabel(m.role)} · joined {formatRelativeDate(m.joined_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ShortcutsCard() {
  const links = [
    { to: "/settings?tab=workspace", icon: Building2, title: "Workspace", text: "Name, currency and monthly quota" },
    { to: "/settings?tab=team", icon: Users, title: "Team", text: "Members, roles and invitations" },
    { to: "/settings?tab=roles", icon: KeyRound, title: "Roles & permissions", text: "What admins, managers and reps can do" },
    { to: "/settings?tab=billing", icon: Gauge, title: "Plan & usage", text: "Your plan, limits and usage" },
    { to: "/settings?tab=pipeline", icon: Kanban, title: "Pipeline", text: "Stages, probabilities and pipelines" },
    { to: "/settings?tab=templates", icon: Mail, title: "Email templates", text: "Your reusable emails" },
    { to: "/data", icon: FileUp, title: "Import & export", text: "CSV import and export" },
  ];
  return (
    <Card title="Settings">
      <ul className="-my-2 divide-y divide-border">
        {links.map(({ to, icon: Icon, title, text }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex items-center gap-3 rounded-md py-2.5 transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{title}</span>
                <span className="block truncate text-xs text-muted-foreground">{text}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function FeedbackCard() {
  const feedback = useWorkspaceFeedback();
  const updateStatus = useUpdateFeedbackStatus();

  const setStatus = (id: string, status: string) =>
    updateStatus.mutate(
      { id, status },
      {
        onSuccess: () => toast.success(`Marked as ${status}`),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );

  return (
    <Card title="Feedback">
      {feedback.isLoading ? (
        <ListSkeleton rows={3} />
      ) : feedback.isError ? (
        <ErrorState compact error={feedback.error} title="Couldn't load feedback" onRetry={() => feedback.refetch()} />
      ) : !feedback.data?.length ? (
        <EmptyState
          compact
          icon={MessageSquare}
          title="No feedback yet"
          description="Feedback your team sends with the Feedback button appears here."
        />
      ) : (
        <ul className="divide-y divide-border">
          {feedback.data.map((f) => (
            <li key={f.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="font-normal">
                    {f.category}
                  </Badge>
                  <span className="inline-flex items-center gap-0.5 tabular-nums" aria-label={`Rated ${f.rating} out of 5`}>
                    <Star className="h-3 w-3" aria-hidden /> {f.rating}/5
                  </span>
                  <span>{formatRelativeDate(f.created_at)}</span>
                  {f.email && <span className="truncate">· {f.email}</span>}
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">{f.comment}</p>
              </div>
              <Select value={f.status} onValueChange={(v) => setStatus(f.id, v)}>
                <SelectTrigger className="h-8 w-32 shrink-0 capitalize" aria-label="Feedback status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(FEEDBACK_STATUSES as readonly string[]).includes(f.status) ? null : (
                    <SelectItem value={f.status} className="capitalize">
                      {f.status}
                    </SelectItem>
                  )}
                  {FEEDBACK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
