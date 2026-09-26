import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Download, Mail, Phone, Plus, Search, SearchX, Tag, Tags, Trash2, Upload, Users, X } from "lucide-react";
import {
  fetchContactsByIds,
  useBulkDeleteContacts,
  useBulkTagContacts,
  useContactTags,
  useContactsPage,
  type Contact,
  type ContactSort,
  type SortDir,
} from "@/hooks/useContacts";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuth } from "@/contexts/AuthContext";
import { useRecordPermissions, type RecordOwnership } from "@/hooks/useRecordPermissions";
import { PageBanner } from "@/components/PageBanner";
import { CreateContactDialog } from "@/components/contacts/CreateContactDialog";
import { ContactDetailSheet } from "@/components/contacts/ContactDetailSheet";
import { BulkTagDialog } from "@/components/contacts/BulkTagDialog";
import { CopyButton, PaginationFooter, RecordAvatar, SortHeader, Th } from "@/components/contacts/list-parts";
import { CompanyPicker, type CompanyChoice } from "@/components/companies/CompanyPicker";
import { BulkActionBar } from "@/components/BulkActionBar";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/States";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAGE_SIZE } from "@/lib/postgrest";
import { downloadCsv } from "@/lib/csv";
import { CONTACT_EXPORT_HEADERS, contactExportRow } from "@/lib/dataTransfer";
import { formatDate, formatRelativeDate } from "@/lib/formatters";
import { sanitizeHref } from "@/lib/sanitize";
import { errorMessage } from "@/components/settings/validation";
import { cn } from "@/lib/utils";

const SORT_OPTIONS: { value: string; label: string; sort: ContactSort; dir: SortDir }[] = [
  { value: "created:desc", label: "Newest first", sort: "created", dir: "desc" },
  { value: "created:asc", label: "Oldest first", sort: "created", dir: "asc" },
  { value: "name:asc", label: "Name A–Z", sort: "name", dir: "asc" },
  { value: "name:desc", label: "Name Z–A", sort: "name", dir: "desc" },
  { value: "company:asc", label: "Company A–Z", sort: "company", dir: "asc" },
];

const ALL_TAGS = "__all__";

export default function Contacts() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<ContactSort>("created");
  const [dir, setDir] = useState<SortDir>("desc");
  const [tag, setTag] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanyChoice>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [tagMode, setTagMode] = useState<"add" | "remove" | null>(null);
  const [exporting, setExporting] = useState(false);

  const query = useContactsPage({ search: debouncedSearch, page, sort, dir, tag, companyId: company?.id ?? null });
  const { data: allTags = [] } = useContactTags();
  const bulkDelete = useBulkDeleteContacts();
  const bulkTag = useBulkTagContacts();

  const rows = useMemo(() => query.data?.rows ?? [], [query.data]);
  // Who created each row we've shown, so bulk delete can tell a rep which selected contacts they can't delete.
  const { partition } = useRecordPermissions();
  const { hasFeature } = useAuth();
  const seen = useRef(new Map<string, RecordOwnership>());
  useEffect(() => {
    rows.forEach((r) => seen.current.set(r.id, { created_by: r.created_by }));
  }, [rows]);
  const total = query.data?.total ?? 0;
  const filtersActive = !!debouncedSearch.trim() || !!tag || !!company;

  // Reset to the first page whenever the result set changes shape.
  useEffect(() => setPage(0), [debouncedSearch, tag, company?.id, sort, dir]);

  // If the current page emptied (e.g. after deleting), step back.
  useEffect(() => {
    if (!query.isPlaceholderData && query.data && query.data.rows.length === 0 && page > 0) setPage((p) => Math.max(0, p - 1));
  }, [query.data, query.isPlaceholderData, page]);

  // ?new=1 and ?open=<id> deep links.
  useEffect(() => {
    const isNew = searchParams.get("new");
    const open = searchParams.get("open");
    if (!isNew && !open) return;
    if (isNew) setCreateOpen(true);
    if (open) setOpenId(open);
    const next = new URLSearchParams(searchParams);
    next.delete("new");
    next.delete("open");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const clearFilters = () => {
    setSearch("");
    setTag(null);
    setCompany(null);
  };

  const toggleSort = (column: ContactSort) => {
    if (sort === column) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(column);
      setDir(column === "created" ? "desc" : "asc");
    }
  };

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const pageIds = rows.map((r) => r.id);
  const selectedOnPage = pageIds.filter((id) => selected.has(id)).length;
  const allOnPage = pageIds.length > 0 && selectedOnPage === pageIds.length;
  const toggleAllOnPage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPage) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const ids = Array.from(selected);

  const handleBulkDelete = async () => {
    const { allowed, denied } = partition(ids, seen.current);
    if (allowed.length === 0) {
      toast.error(`You can't delete ${ids.length === 1 ? "this contact" : "these contacts"}`, {
        description: "Sales reps can delete only contacts they created. Ask a manager or admin to delete the others.",
      });
      return;
    }
    const allowedNoun = allowed.length === 1 ? "contact" : "contacts";
    const ok = await confirm({
      title: `Delete ${allowed.length} ${allowedNoun}?`,
      description: `${
        denied > 0
          ? `${denied} of the selected contacts ${denied === 1 ? "was" : "were"} created by teammates and will be kept — only their creator, a manager or an admin can delete them. `
          : ""
      }Linked deals, activities and tasks are kept but will no longer reference these contacts. This can't be undone.`,
      confirmLabel: `Delete ${allowed.length} ${allowedNoun}`,
    });
    if (!ok) return;
    try {
      const n = await bulkDelete.mutateAsync(allowed);
      toast.success(`${n} ${n === 1 ? "contact" : "contacts"} deleted`);
      clearSelection();
    } catch (err) {
      toast.error("Couldn't delete contacts", { description: errorMessage(err) });
    }
  };

  const handleExportSelected = async () => {
    setExporting(true);
    try {
      const data = await fetchContactsByIds(ids);
      downloadCsv(`contacts-${new Date().toISOString().slice(0, 10)}.csv`, CONTACT_EXPORT_HEADERS, data.map(contactExportRow));
      toast.success(`Exported ${data.length} ${data.length === 1 ? "contact" : "contacts"}`);
    } catch (err) {
      toast.error("Export failed", { description: errorMessage(err) });
    } finally {
      setExporting(false);
    }
  };

  const handleTag = async (value: string) => {
    if (!tagMode) return;
    try {
      const n = await bulkTag.mutateAsync({ ids, tag: value, mode: tagMode });
      toast.success(tagMode === "add" ? `Tagged ${n} ${n === 1 ? "contact" : "contacts"} “${value}”` : `Removed “${value}” from ${n} ${n === 1 ? "contact" : "contacts"}`);
      setTagMode(null);
    } catch (err) {
      toast.error("Couldn't update tags", { description: errorMessage(err) });
    }
  };

  const openContact = (c: Contact) => setOpenId(c.id);
  const initialContact = rows.find((r) => r.id === openId) ?? null;

  return (
    <div className="space-y-6">
      <PageBanner title="Contacts" description="The people you sell to and work with.">
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/data">
              <Upload className="mr-1.5 h-4 w-4" aria-hidden /> Import
            </Link>
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add contact
          </Button>
        </div>
      </PageBanner>

      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            aria-label="Search contacts"
            placeholder="Search name, email, title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 text-sm"
          />
        </div>
        <Select value={tag ?? ALL_TAGS} onValueChange={(v) => setTag(v === ALL_TAGS ? null : v)}>
          <SelectTrigger className="h-9 w-full text-sm sm:w-40" aria-label="Filter by tag">
            <Tag className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <SelectValue placeholder="All tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TAGS}>All tags</SelectItem>
            {allTags.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <CompanyPicker value={company} onChange={setCompany} allowCreate={false} placeholder="All companies" className="w-full sm:w-56" />
        <Select
          value={`${sort}:${dir}`}
          onValueChange={(v) => {
            const o = SORT_OPTIONS.find((x) => x.value === v);
            if (o) {
              setSort(o.sort);
              setDir(o.dir);
            }
          }}
        >
          <SelectTrigger className="h-9 w-full text-sm sm:hidden" aria-label="Sort contacts">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtersActive && (
          <Button variant="ghost" size="sm" className="h-9 gap-1 self-start sm:self-auto" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" aria-hidden /> Clear filters
          </Button>
        )}
      </div>

      {query.isLoading ? (
        <ListSkeleton rows={8} />
      ) : query.error && !query.data ? (
        <ErrorState title="Couldn't load contacts" error={query.error} onRetry={() => query.refetch()} />
      ) : total === 0 && !filtersActive ? (
        <EmptyState
          icon={Users}
          title="No contacts yet"
          description="Add the people you work with, or bring them in from a CSV file."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add contact
            </Button>
          }
          secondaryAction={
            <Button variant="outline" asChild>
              <Link to="/data">
                <Upload className="mr-1.5 h-4 w-4" aria-hidden /> Import CSV
              </Link>
            </Button>
          }
        />
      ) : total === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No contacts match"
          description="Try a different search or remove a filter."
          action={
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {/* Desktop table */}
          <div className="hidden max-h-[calc(100dvh-17rem)] overflow-auto sm:block">
            <table className="w-full caption-bottom text-sm">
              <caption className="sr-only">Contacts</caption>
              <thead className="sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_hsl(var(--border))]">
                <tr>
                  <th scope="col" className="h-10 w-10 px-3">
                    <Checkbox
                      checked={allOnPage ? true : selectedOnPage > 0 ? "indeterminate" : false}
                      onCheckedChange={toggleAllOnPage}
                      aria-label="Select all contacts on this page"
                    />
                  </th>
                  <SortHeader label="Name" active={sort === "name"} dir={dir} onClick={() => toggleSort("name")} />
                  <SortHeader label="Company" active={sort === "company"} dir={dir} onClick={() => toggleSort("company")} />
                  <Th>Email</Th>
                  <Th className="hidden lg:table-cell">Phone</Th>
                  <Th className="hidden md:table-cell">Tags</Th>
                  <Th className="hidden xl:table-cell">Last activity</Th>
                  <SortHeader label="Added" active={sort === "created"} dir={dir} onClick={() => toggleSort("created")} className="hidden lg:table-cell" />
                </tr>
              </thead>
              <tbody className={cn("transition-opacity duration-150", query.isPlaceholderData && "opacity-60")}>
                {rows.map((c) => {
                  const name = `${c.first_name} ${c.last_name}`.trim();
                  const isSelected = selected.has(c.id);
                  const lastActivity = c.activities?.[0]?.created_at;
                  return (
                    <tr
                      key={c.id}
                      data-state={isSelected ? "selected" : undefined}
                      className="group cursor-pointer border-b border-border/70 transition-colors last:border-0 hover:bg-secondary/40 data-[state=selected]:bg-secondary/60"
                      onClick={() => openContact(c)}
                    >
                      <td className="w-10 px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleOne(c.id)} aria-label={`Select ${name}`} />
                      </td>
                      <td className="max-w-[16rem] px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          <RecordAvatar name={name} />
                          <div className="min-w-0">
                            <button
                              type="button"
                              className="block max-w-full truncate text-left font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                              onClick={(e) => {
                                e.stopPropagation();
                                openContact(c);
                              }}
                            >
                              {name}
                            </button>
                            {c.position && <p className="truncate text-xs text-muted-foreground">{c.position}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="max-w-[12rem] px-3 py-2">
                        {c.companies ? (
                          <button
                            type="button"
                            className="max-w-full truncate text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/companies?open=${c.companies!.id}`);
                            }}
                          >
                            {c.companies.name}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="max-w-[15rem] px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        {c.email ? (
                          <div className="flex items-center gap-1">
                            <a href={sanitizeHref(`mailto:${c.email}`)} className="truncate text-muted-foreground hover:text-foreground hover:underline">
                              {c.email}
                            </a>
                            <CopyButton value={c.email} label="Email" />
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-2 lg:table-cell" onClick={(e) => e.stopPropagation()}>
                        {c.phone ? (
                          <div className="flex items-center gap-1">
                            <a href={sanitizeHref(`tel:${c.phone.replace(/[^\d+]/g, "")}`)} className="tabular-nums text-muted-foreground hover:text-foreground hover:underline">
                              {c.phone}
                            </a>
                            <CopyButton value={c.phone} label="Phone" />
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="hidden max-w-[14rem] px-3 py-2 md:table-cell">
                        {c.tags.length ? (
                          <div className="flex flex-wrap gap-1">
                            {c.tags.slice(0, 3).map((t) => (
                              <Badge key={t} variant="secondary" className="font-normal">
                                {t}
                              </Badge>
                            ))}
                            {c.tags.length > 3 && <span className="text-xs text-muted-foreground">+{c.tags.length - 3}</span>}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-2 text-muted-foreground xl:table-cell">
                        {lastActivity ? <time dateTime={lastActivity}>{formatRelativeDate(lastActivity)}</time> : "—"}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground lg:table-cell">{formatDate(c.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className={cn("divide-y divide-border sm:hidden", query.isPlaceholderData && "opacity-60")}>
            {rows.map((c) => {
              const name = `${c.first_name} ${c.last_name}`.trim();
              return (
                <li key={c.id} className="flex items-start gap-3 px-3 py-3">
                  <Checkbox className="mt-2" checked={selected.has(c.id)} onCheckedChange={() => toggleOne(c.id)} aria-label={`Select ${name}`} />
                  <button type="button" className="flex min-w-0 flex-1 items-start gap-3 text-left" onClick={() => openContact(c)}>
                    <RecordAvatar name={name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{name}</p>
                      <p className="truncate text-xs text-muted-foreground">{[c.position, c.companies?.name].filter(Boolean).join(" · ") || "—"}</p>
                      {c.tags.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {c.tags.slice(0, 3).map((t) => (
                            <Badge key={t} variant="secondary" className="font-normal">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                  <div className="flex shrink-0 gap-1">
                    {c.email && (
                      <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                        <a href={sanitizeHref(`mailto:${c.email}`)} aria-label={`Email ${name}`}>
                          <Mail className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {c.phone && (
                      <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                        <a href={sanitizeHref(`tel:${c.phone.replace(/[^\d+]/g, "")}`)} aria-label={`Call ${name}`}>
                          <Phone className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <PaginationFooter page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} fetching={query.isFetching && !query.isLoading} noun="contacts" />
        </div>
      )}

      <BulkActionBar
        count={selected.size}
        onClear={clearSelection}
        actions={[
          { label: "Add tag", icon: Tags, onClick: () => setTagMode("add"), pending: bulkTag.isPending && tagMode === "add" },
          { label: "Remove tag", icon: Tag, onClick: () => setTagMode("remove"), pending: bulkTag.isPending && tagMode === "remove" },
          ...(hasFeature("csv_export")
            ? [{ label: "Export", icon: Download, onClick: handleExportSelected, pending: exporting, pendingLabel: "Exporting…" }]
            : []),
          { label: "Delete", icon: Trash2, onClick: handleBulkDelete, destructive: true, pending: bulkDelete.isPending, pendingLabel: "Deleting…" },
        ]}
      />

      <BulkTagDialog
        mode={tagMode}
        count={selected.size}
        suggestions={allTags}
        pending={bulkTag.isPending}
        onOpenChange={(o) => !o && setTagMode(null)}
        onSubmit={handleTag}
      />
      <CreateContactDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(c) => setOpenId(c.id)} onOpenExisting={setOpenId} />
      <ContactDetailSheet contactId={openId} initialContact={initialContact} open={!!openId} onOpenChange={(o) => !o && setOpenId(null)} />
    </div>
  );
}
