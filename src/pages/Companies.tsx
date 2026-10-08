import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Building2, Download, Factory, Globe, Plus, Search, SearchX, Trash2, Upload, X } from "lucide-react";
import {
  fetchCompaniesByIds,
  useBulkDeleteCompanies,
  useCompaniesPage,
  useIndustries,
  useOpenDealTotals,
  type CompanyListRow,
  type CompanySort,
} from "@/hooks/useCompanies";
import { useDebounce } from "@/hooks/useDebounce";
import { useRecordPermissions, type RecordOwnership } from "@/hooks/useRecordPermissions";
import { useAuth } from "@/contexts/AuthContext";
import { PageBanner } from "@/components/PageBanner";
import { CreateCompanyDialog } from "@/components/companies/CreateCompanyDialog";
import { CompanyDetailSheet } from "@/components/companies/CompanyDetailSheet";
import { PaginationFooter, RecordAvatar, SortHeader, Th } from "@/components/contacts/list-parts";
import { BulkActionBar } from "@/components/BulkActionBar";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/States";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAGE_SIZE, lastPageIndex } from "@/lib/postgrest";
import { downloadCsv } from "@/lib/csv";
import { COMPANY_EXPORT_HEADERS, companyExportRow } from "@/lib/dataTransfer";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { sanitizeHref } from "@/lib/sanitize";
import { errorMessage } from "@/components/settings/validation";
import { cn } from "@/lib/utils";

const SORT_OPTIONS: { value: string; label: string; sort: CompanySort; dir: "asc" | "desc" }[] = [
  { value: "name:asc", label: "Name A–Z", sort: "name", dir: "asc" },
  { value: "name:desc", label: "Name Z–A", sort: "name", dir: "desc" },
  { value: "created:desc", label: "Newest first", sort: "created", dir: "desc" },
  { value: "created:asc", label: "Oldest first", sort: "created", dir: "asc" },
  { value: "industry:asc", label: "Industry A–Z", sort: "industry", dir: "asc" },
];
const ALL = "__all__";

function domain(url: string) {
  return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
}

export default function Companies() {
  const confirm = useConfirm();
  const { organization, hasFeature } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<CompanySort>("name");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [industry, setIndustry] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const query = useCompaniesPage({ search: debouncedSearch, page, sort, dir, industry });
  const { data: industries = [] } = useIndustries();
  const bulkDelete = useBulkDeleteCompanies();

  const rows = useMemo(() => query.data?.rows ?? [], [query.data]);
  // Who created each row we've shown, so bulk delete can tell a rep which selected companies they can't delete.
  const { partition } = useRecordPermissions();
  const seen = useRef(new Map<string, RecordOwnership>());
  useEffect(() => {
    rows.forEach((r) => seen.current.set(r.id, { created_by: r.created_by }));
  }, [rows]);
  const total = query.data?.total ?? 0;
  const pageIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const totals = useOpenDealTotals(pageIds);
  const filtersActive = !!debouncedSearch.trim() || !!industry;

  useEffect(() => setPage(0), [debouncedSearch, industry, sort, dir]);
  // If the current page emptied (e.g. after deleting), step back to the last page that has rows.
  useEffect(() => {
    if (query.isPlaceholderData || !query.data || query.data.rows.length > 0 || page === 0) return;
    setPage(Math.min(page - 1, lastPageIndex(query.data.total)));
  }, [query.data, query.isPlaceholderData, page]);

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
    setIndustry(null);
  };
  const toggleSort = (column: CompanySort) => {
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
      toast.error(`You can't delete ${ids.length === 1 ? "this company" : "these companies"}`, {
        description: "Sales reps can delete only companies they added. Ask a manager or admin to delete the others.",
      });
      return;
    }
    const noun = allowed.length === 1 ? "company" : "companies";
    const ok = await confirm({
      title: `Delete ${allowed.length} ${noun}?`,
      description: `${
        denied > 0
          ? `${denied} of the selected companies ${denied === 1 ? "was" : "were"} added by teammates and will be kept — only their creator, a manager or an admin can delete them. `
          : ""
      }Their contacts and deals stay in your workspace but will no longer be linked to them. This can't be undone.`,
      confirmLabel: `Delete ${allowed.length} ${noun}`,
    });
    if (!ok) return;
    try {
      const n = await bulkDelete.mutateAsync(allowed);
      if (n < allowed.length) {
        toast.warning(`${n} of ${allowed.length} companies deleted`, {
          description: "The others may already have been deleted, or your role doesn't allow deleting them.",
        });
      } else {
        toast.success(`${n} ${n === 1 ? "company" : "companies"} deleted`);
      }
      clearSelection();
    } catch (err) {
      toast.error("Couldn't delete companies", { description: errorMessage(err) });
    }
  };

  const handleExportSelected = async () => {
    setExporting(true);
    try {
      const data = await fetchCompaniesByIds(ids);
      downloadCsv(`companies-${new Date().toISOString().slice(0, 10)}.csv`, COMPANY_EXPORT_HEADERS, data.map(companyExportRow));
      toast.success(`Exported ${data.length} ${data.length === 1 ? "company" : "companies"}`);
    } catch (err) {
      toast.error("Export failed", { description: errorMessage(err) });
    } finally {
      setExporting(false);
    }
  };

  const openValue = (c: CompanyListRow) => {
    if (totals.isLoading) return <span className="inline-block h-3 w-12 animate-pulse rounded bg-muted" aria-label="Loading" />;
    if (totals.error) return <span title="Couldn't load deal totals">—</span>;
    const t = totals.data?.[c.id];
    if (!t) return <span className="text-muted-foreground">—</span>;
    return (
      <span title={`${t.count} open ${t.count === 1 ? "deal" : "deals"}`}>
        {formatCurrency(t.value, organization?.currency)}
      </span>
    );
  };

  const initialCompany = rows.find((r) => r.id === openId) ?? null;

  return (
    <div className="space-y-6">
      <PageBanner title="Companies" description="The accounts behind your contacts and deals.">
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/data">
              <Upload className="mr-1.5 h-4 w-4" aria-hidden /> Import
            </Link>
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add company
          </Button>
        </div>
      </PageBanner>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            aria-label="Search companies"
            placeholder="Search name, industry, website…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 text-sm"
          />
        </div>
        <Select value={industry ?? ALL} onValueChange={(v) => setIndustry(v === ALL ? null : v)}>
          <SelectTrigger className="h-9 w-full text-sm sm:w-48" aria-label="Filter by industry">
            <Factory className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <SelectValue placeholder="All industries" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All industries</SelectItem>
            {industries.map((i) => (
              <SelectItem key={i} value={i}>
                {i}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          <SelectTrigger className="h-9 w-full text-sm sm:hidden" aria-label="Sort companies">
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
        <ErrorState title="Couldn't load companies" error={query.error} onRetry={() => query.refetch()} />
      ) : total === 0 && !filtersActive ? (
        <EmptyState
          icon={Building2}
          title="No companies yet"
          description="Add the accounts you work with, or bring them in from a CSV file."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add company
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
          title="No companies match"
          description="Try a different search or industry."
          action={
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="hidden max-h-[calc(100dvh-17rem)] overflow-auto sm:block">
            <table className="w-full caption-bottom text-sm">
              <caption className="sr-only">Companies</caption>
              <thead className="sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_hsl(var(--border))]">
                <tr>
                  <th scope="col" className="h-10 w-10 px-3">
                    <Checkbox
                      checked={allOnPage ? true : selectedOnPage > 0 ? "indeterminate" : false}
                      onCheckedChange={toggleAllOnPage}
                      aria-label="Select all companies on this page"
                    />
                  </th>
                  <SortHeader label="Company" active={sort === "name"} dir={dir} onClick={() => toggleSort("name")} />
                  <SortHeader label="Industry" active={sort === "industry"} dir={dir} onClick={() => toggleSort("industry")} className="hidden md:table-cell" />
                  <Th className="text-right">Contacts</Th>
                  <Th className="text-right">Open deals</Th>
                  <SortHeader label="Added" active={sort === "created"} dir={dir} onClick={() => toggleSort("created")} className="hidden lg:table-cell" />
                </tr>
              </thead>
              <tbody className={cn("transition-opacity duration-150", query.isPlaceholderData && "opacity-60")}>
                {rows.map((c) => {
                  const isSelected = selected.has(c.id);
                  const href = c.website ? sanitizeHref(c.website) : "#";
                  return (
                    <tr
                      key={c.id}
                      data-state={isSelected ? "selected" : undefined}
                      className="cursor-pointer border-b border-border/70 transition-colors last:border-0 hover:bg-secondary/40 data-[state=selected]:bg-secondary/60"
                      onClick={() => setOpenId(c.id)}
                    >
                      <td className="w-10 px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleOne(c.id)} aria-label={`Select ${c.name}`} />
                      </td>
                      <td className="max-w-[18rem] px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          <RecordAvatar name={c.name} square />
                          <div className="min-w-0">
                            <button
                              type="button"
                              className="block max-w-full truncate rounded text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenId(c.id);
                              }}
                            >
                              {c.name}
                            </button>
                            {c.website && href !== "#" && (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
                              >
                                <Globe className="h-3 w-3 shrink-0" aria-hidden />
                                {domain(c.website)}
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-3 py-2 md:table-cell">
                        {c.industry ? (
                          <Badge variant="secondary" className="font-normal">
                            {c.industry}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.contact_count}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{openValue(c)}</td>
                      <td className="hidden whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground lg:table-cell">{formatDate(c.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className={cn("divide-y divide-border sm:hidden", query.isPlaceholderData && "opacity-60")}>
            {rows.map((c) => (
              <li key={c.id} className="flex items-start gap-3 px-3 py-3">
                <Checkbox className="mt-2" checked={selected.has(c.id)} onCheckedChange={() => toggleOne(c.id)} aria-label={`Select ${c.name}`} />
                <button type="button" className="flex min-w-0 flex-1 items-start gap-3 text-left" onClick={() => setOpenId(c.id)}>
                  <RecordAvatar name={c.name} square />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{[c.industry, c.website && domain(c.website)].filter(Boolean).join(" · ") || "—"}</p>
                    <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                      {c.contact_count} {c.contact_count === 1 ? "contact" : "contacts"}
                      {totals.data?.[c.id] && <> · {formatCurrency(totals.data[c.id].value, organization?.currency)} open</>}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          <PaginationFooter page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} fetching={query.isFetching && !query.isLoading} noun="companies" />
        </div>
      )}

      <BulkActionBar
        count={selected.size}
        onClear={clearSelection}
        actions={[
          ...(hasFeature("csv_export")
            ? [{ label: "Export", icon: Download, onClick: handleExportSelected, pending: exporting, pendingLabel: "Exporting…" }]
            : []),
          { label: "Delete", icon: Trash2, onClick: handleBulkDelete, destructive: true, pending: bulkDelete.isPending, pendingLabel: "Deleting…" },
        ]}
      />

      <CreateCompanyDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(c) => setOpenId(c.id)} onOpenExisting={setOpenId} />
      <CompanyDetailSheet companyId={openId} initialCompany={initialCompany} open={!!openId} onOpenChange={(o) => !o && setOpenId(null)} />
    </div>
  );
}
