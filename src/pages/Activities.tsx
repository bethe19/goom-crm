import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity as ActivityIcon, Loader2, Plus, Search, SearchX, X } from "lucide-react";
import { ACTIVITY_TYPES, useActivitiesFeed, useActivity, useDeleteActivity, type Activity, type ActivityType } from "@/hooks/useActivities";
import { useDebounce } from "@/hooks/useDebounce";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/components/settings/validation";
import { PageBanner } from "@/components/PageBanner";
import { RepScopeNotice } from "@/components/settings/AccessNotice";
import { useAuth } from "@/contexts/AuthContext";
import { useRecordPermissions } from "@/hooks/useRecordPermissions";
import { BulkActionBar } from "@/components/BulkActionBar";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActivityItem } from "@/components/activities/ActivityItem";
import { LogActivityDialog } from "@/components/activities/LogActivityDialog";
import { ActivityDetailDialog } from "@/components/activities/ActivityDetailDialog";
import { ACTIVITY_META, groupByDay } from "@/components/activities/activityUtils";
import { ContactPicker, DealPicker } from "@/components/pipeline/pickers";

export default function Activities() {
  const { toast } = useToast();
  const { can } = useAuth();
  const seesAll = can("records.view_all");
  const { canDelete } = useRecordPermissions();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filters (deal/contact can be preset via ?deal= / ?contact=).
  const [type, setType] = useState<ActivityType | "">("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [dealId, setDealId] = useState<string | null>(() => searchParams.get("deal"));
  const [contactId, setContactId] = useState<string | null>(() => searchParams.get("contact"));
  const filtersActive = !!(type || search.trim() || dealId || contactId);
  const clearFilters = () => {
    setType("");
    setSearch("");
    setDealId(null);
    setContactId(null);
  };

  const feed = useActivitiesFeed({ type, dealId, contactId, search: debouncedSearch });
  const rows = useMemo(() => feed.data?.pages.flatMap((p) => p.rows) ?? [], [feed.data]);
  const total = feed.data?.pages[0]?.count ?? 0;
  const groups = useMemo(() => groupByDay(rows, (a) => a.created_at), [rows]);

  // Dialogs & URL params.
  const [logOpen, setLogOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const openFromFeed = rows.find((a) => a.id === openId) ?? null;
  const openQuery = useActivity(openFromFeed ? null : openId);
  const fetchedOpen = openQuery.data;
  const openActivity: Activity | null = openFromFeed ?? fetchedOpen ?? null;

  useEffect(() => {
    if (openId && !openFromFeed && openQuery.isSuccess && openQuery.data === null) {
      toast({ title: "Activity not found", description: "It may have been deleted.", variant: "warning" });
      setOpenId(null);
    }
  }, [openId, openFromFeed, openQuery.isSuccess, openQuery.data, toast]);

  useEffect(() => {
    const id = searchParams.get("open");
    const isNew = searchParams.get("new");
    if (!id && !isNew) return;
    if (id) {
      setOpenId(id);
      setHighlightId(id);
    }
    if (isNew) setLogOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("open");
    next.delete("new");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Scroll the highlighted activity into view once it's rendered, then fade the highlight.
  useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById(`activity-${highlightId}`);
    if (el) {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    }
    const t = setTimeout(() => setHighlightId(null), 4000);
    return () => clearTimeout(t);
  }, [highlightId, rows.length]);

  // Selection & bulk delete.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const deleteActivity = useDeleteActivity();
  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const handleBulkDelete = async () => {
    setDeleting(true);
    const ids = Array.from(selected);
    const results = await Promise.allSettled(ids.map((id) => deleteActivity.mutateAsync(id)));
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    setDeleting(false);
    setSelected(new Set(ids.filter((_, i) => results[i].status === "rejected")));
    if (failed.length) {
      toast({
        title: `${ids.length - failed.length} deleted, ${failed.length} failed`,
        description: errorMessage(failed[0].reason),
        variant: "destructive",
      });
    } else {
      toast({ title: `${ids.length} ${ids.length === 1 ? "activity" : "activities"} deleted`, variant: "success" });
    }
  };

  let content: React.ReactNode;
  if (feed.isLoading) {
    content = <ListSkeleton rows={6} />;
  } else if (feed.error) {
    content = <ErrorState title="Couldn't load activities" error={feed.error} onRetry={() => feed.refetch()} />;
  } else if (rows.length === 0 && filtersActive) {
    content = (
      <EmptyState
        icon={SearchX}
        title="No activities match your filters"
        description="Try a different search or clear the filters."
        action={
          <Button variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        }
      />
    );
  } else if (rows.length === 0) {
    content = (
      <EmptyState
        icon={ActivityIcon}
        title="No activity yet"
        description="Log calls, emails, meetings and notes to keep a shared history of every relationship."
        action={
          <Button onClick={() => setLogOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden /> Log activity
          </Button>
        }
      />
    );
  } else {
    content = (
      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g.key} aria-labelledby={`day-${g.key}`}>
            <h2 id={`day-${g.key}`} className="sticky top-0 z-[1] -mx-1 mb-2 bg-background/95 px-1 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
              {g.label}
            </h2>
            <ul className="space-y-2">
              {g.items.map((a) => (
                <li key={a.id} className="flex items-start gap-3">
                  {canDelete({ user_id: a.user_id }) ? (
                    <Checkbox
                      checked={selected.has(a.id)}
                      onCheckedChange={() => toggleSelect(a.id)}
                      className="mt-4"
                      aria-label={`Select “${a.title}”`}
                    />
                  ) : (
                    // Keeps rows aligned; reps can only select (and delete) activities they logged.
                    <span className="mt-4 h-4 w-4 shrink-0" aria-hidden />
                  )}
                  <ActivityItem activity={a} onOpen={(x) => setOpenId(x.id)} highlighted={highlightId === a.id} className="flex-1" />
                </li>
              ))}
            </ul>
          </section>
        ))}
        <div className="flex flex-col items-center gap-2 pt-2 text-xs text-muted-foreground">
          <span className="tabular-nums">
            Showing {rows.length} of {total}
          </span>
          {feed.hasNextPage && (
            <Button variant="outline" size="sm" onClick={() => feed.fetchNextPage()} disabled={feed.isFetchingNextPage}>
              {feed.isFetchingNextPage ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
                </>
              ) : (
                "Load more"
              )}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageBanner
        title="Activities"
        description={
          seesAll ? "Every call, email, meeting and note across your team." : "Your calls, emails, meetings and notes, plus activity on your deals."
        }
      >
        <Button onClick={() => setLogOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden /> Log activity
        </Button>
      </PageBanner>

      {!seesAll && <RepScopeNotice scope="activities" className="-mt-3" />}

      <div className="flex flex-wrap items-center gap-2" role="search" aria-label="Filter activities">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search activities…" className="h-9 pl-9 text-sm" aria-label="Search activities" />
        </div>
        <Select value={type || "all"} onValueChange={(v) => setType(v === "all" ? "" : (v as ActivityType))}>
          <SelectTrigger className="h-9 w-[140px] text-sm" aria-label="Activity type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {ACTIVITY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {ACTIVITY_META[t].plural}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="w-full sm:w-52">
          <DealPicker value={dealId} onChange={setDealId} placeholder="Any deal" className="h-9 text-sm" aria-label="Filter by deal" />
        </div>
        <div className="w-full sm:w-52">
          <ContactPicker value={contactId} onChange={setContactId} placeholder="Any contact" allowCreate={false} className="h-9 text-sm" aria-label="Filter by contact" />
        </div>
        {filtersActive && (
          <Button variant="ghost" size="sm" className="h-9 gap-1 px-3" onClick={clearFilters}>
            <X className="h-4 w-4" aria-hidden /> Clear filters
          </Button>
        )}
      </div>

      {content}

      <BulkActionBar count={selected.size} onDelete={handleBulkDelete} onClear={() => setSelected(new Set())} deleting={deleting} />
      <LogActivityDialog open={logOpen} onOpenChange={setLogOpen} defaultDealId={dealId ?? undefined} defaultContactId={contactId ?? undefined} />
      <ActivityDetailDialog activity={openActivity} open={!!openId && !!openActivity} onOpenChange={(o) => !o && setOpenId(null)} />
    </div>
  );
}
