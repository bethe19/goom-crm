import { useQuery, useMutation, useQueryClient, keepPreviousData, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { assertAffected } from "@/components/settings/validation";
import { ilikeAny, PAGE_SIZE, rangeNotSatisfiableTotal } from "@/lib/postgrest";
import { chunk, escapeLike, fetchAllRows } from "@/lib/fetchAll";
import { stageOutcome } from "@/hooks/usePipelineStages";
import { RELATED_ACTIVITY_SELECT, RELATED_DEAL_SELECT, type Contact, type RelatedActivity, type RelatedDeal } from "@/hooks/useContacts";

export interface Company {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** A company row in the paginated list, with embedded contact count. */
export interface CompanyListRow extends Company {
  contact_count: number;
}

export interface CompanyInput {
  name: string;
  website?: string | null;
  industry?: string | null;
}

const SEARCH_COLUMNS = ["name", "industry", "website"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any;

/**
 * Simple list for pickers and lookups (sorted by name, not paginated). Keeps the original call
 * shape `useCompanies()`; optionally searches server-side and caps at `limit` (default 1000).
 */
export function useCompanies(search?: string, options?: { limit?: number; enabled?: boolean }) {
  const limit = options?.limit ?? 1000;
  return useQuery({
    queryKey: ["companies", "list", search ?? "", limit],
    queryFn: async () => {
      let query: AnyQuery = supabase.from("companies").select("*").order("name");
      const f = ilikeAny(["name"], search ?? "");
      if (f) query = query.or(f);
      const { data, error } = await query.limit(limit);
      if (error) throw error;
      return (data ?? []) as Company[];
    },
    enabled: options?.enabled ?? true,
  });
}

export type CompanySort = "name" | "industry" | "created";

export interface CompaniesPageParams {
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: CompanySort;
  dir?: "asc" | "desc";
  industry?: string | null;
}

/** Server-side paginated company list with contact counts. Returns `{ rows, total }`. */
export function useCompaniesPage(params: CompaniesPageParams) {
  const { search = "", page = 0, pageSize = PAGE_SIZE, sort = "name", dir = "asc", industry = null } = params;
  return useQuery({
    queryKey: ["companies", "page", { search, page, pageSize, sort, dir, industry }],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<{ rows: CompanyListRow[]; total: number }> => {
      let query: AnyQuery = supabase.from("companies").select("*, contacts(count)", { count: "exact" });
      const words = search.trim().split(/\s+/).filter(Boolean).slice(0, 5);
      for (const w of words) {
        const f = ilikeAny(SEARCH_COLUMNS, w);
        if (f) query = query.or(f);
      }
      if (industry) query = query.eq("industry", industry);
      const ascending = dir === "asc";
      const column = sort === "created" ? "created_at" : sort;
      query = query
        .order(column, { ascending, nullsFirst: false })
        .order("id", { ascending: true })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      const { data, error, count } = await query;
      if (error) {
        // Offset past the end (e.g. the last page was just deleted): report it as an empty page so the
        // list can step back instead of showing an error.
        const outOfRangeTotal = rangeNotSatisfiableTotal(error);
        if (outOfRangeTotal !== null) return { rows: [], total: outOfRangeTotal };
        throw error;
      }
      const rows = ((data ?? []) as (Company & { contacts?: { count: number }[] })[]).map(({ contacts, ...c }) => ({
        ...c,
        contact_count: contacts?.[0]?.count ?? 0,
      }));
      return { rows, total: count ?? 0 };
    },
  });
}

/**
 * Open (not won/lost) deal value per company for the given company ids.
 * Returns a map id → { value, count }.
 */
export function useOpenDealTotals(companyIds: string[]) {
  const key = [...companyIds].sort().join(",");
  return useQuery({
    queryKey: ["deals", "open-by-company", key],
    enabled: companyIds.length > 0,
    queryFn: async () => {
      const totals: Record<string, { value: number; count: number }> = {};
      for (const part of chunk(companyIds, 100)) {
        const rows = await fetchAllRows<{ company_id: string; value: number | null; pipeline_stages: { is_won?: boolean | null; is_lost?: boolean | null } | null }>(
          (from, to) =>
            (supabase.from("deals").select("id, company_id, value, pipeline_stages(*)") as AnyQuery)
              .in("company_id", part)
              .order("id")
              .range(from, to),
        );
        for (const r of rows) {
          if (stageOutcome(r.pipeline_stages) !== "open") continue;
          const t = (totals[r.company_id] ??= { value: 0, count: 0 });
          t.value += Number(r.value) || 0;
          t.count += 1;
        }
      }
      return totals;
    },
  });
}

/** One company by id (for deep links / detail sheets). Resolves to null when not found. */
export function useCompany(id: string | null | undefined, initialData?: Company | null) {
  return useQuery({
    queryKey: ["companies", "detail", id],
    enabled: !!id,
    placeholderData: initialData ?? undefined,
    queryFn: async (): Promise<Company | null> => {
      const { data, error } = await supabase.from("companies").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return (data as Company | null) ?? null;
    },
  });
}

/** Distinct industries in the workspace (sorted), for filters and suggestions. */
export function useIndustries() {
  return useQuery({
    queryKey: ["companies", "industries"],
    staleTime: 60_000,
    queryFn: async () => {
      const rows = await fetchAllRows<{ industry: string | null }>((from, to) =>
        supabase.from("companies").select("industry").not("industry", "is", null).order("id").range(from, to),
      );
      const set = new Set<string>();
      rows.forEach((r) => r.industry?.trim() && set.add(r.industry.trim()));
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    },
  });
}

/** Returns an existing company with this name (case-insensitive), ignoring `excludeId`. */
export async function findCompanyByName(name: string, excludeId?: string): Promise<Company | null> {
  const n = name.trim();
  if (!n) return null;
  // PostgREST reads `*` in (i)like patterns as `%`, so match it as a single character (`_`) and
  // confirm the exact name below.
  const pattern = escapeLike(n).replace(/\*/g, "_");
  let query: AnyQuery = supabase.from("companies").select("*").ilike("name", pattern);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query.limit(20);
  if (error) throw error;
  const target = n.toLowerCase();
  return ((data as Company[] | null) ?? []).find((c) => c.name.toLowerCase() === target) ?? null;
}

/** Debounce the name yourself; returns an existing company with the same name, if any. */
export function useDuplicateCompanyName(name: string, excludeId?: string) {
  const n = name.trim();
  return useQuery({
    queryKey: ["companies", "duplicate-name", n.toLowerCase(), excludeId ?? null],
    enabled: n.length >= 2,
    staleTime: 30_000,
    queryFn: () => findCompanyByName(n, excludeId),
  });
}

/** Query roots that show company names: lists, pickers and search. */
const COMPANY_DATA_KEYS: QueryKey[] = [["companies"], ["company-options"], ["picker-label", "companies"], ["global-search"]];

/** After a rename or delete, also records that embed the company name (contacts, deals). */
const COMPANY_LINKED_KEYS: QueryKey[] = [...COMPANY_DATA_KEYS, ["contacts"], ["contact-options"], ["deals"], ["deal"]];

function invalidateKeys(queryClient: QueryClient, keys: QueryKey[]) {
  for (const queryKey of keys) queryClient.invalidateQueries({ queryKey });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (company: CompanyInput & { created_by?: string }) => {
      const { data, error } = await supabase.from("companies").insert(company as never).select().single();
      if (error) throw error;
      return data as Company;
    },
    onSuccess: () => invalidateKeys(queryClient, COMPANY_DATA_KEYS),
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; industry?: string | null; website?: string | null }) => {
      const { data, error } = await supabase.from("companies").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data as Company;
    },
    onSuccess: (company) => {
      queryClient.setQueryData(["companies", "detail", company.id], company);
      invalidateKeys(queryClient, COMPANY_LINKED_KEYS);
    },
  });
}

export function useDeleteCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error, count } = await supabase.from("companies").delete({ count: "exact" }).eq("id", id);
      if (error) throw error;
      assertAffected(count);
    },
    onSuccess: () => invalidateKeys(queryClient, COMPANY_LINKED_KEYS),
  });
}

/**
 * Deletes many companies with one `.in()` request per 100 ids. Resolves to the number the server
 * actually deleted (rows the caller may not delete are skipped by RLS). Lists refresh even when a
 * later chunk fails, so rows that were already deleted don't linger on screen.
 */
export function useBulkDeleteCompanies() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      let deleted = 0;
      for (const part of chunk(ids, 100)) {
        const { error, count } = await supabase.from("companies").delete({ count: "exact" }).in("id", part);
        if (error) throw error;
        deleted += count ?? 0;
      }
      return deleted;
    },
    onSettled: () => invalidateKeys(queryClient, COMPANY_LINKED_KEYS),
  });
}

/** Fetches full company rows for the given ids (e.g. to export a selection). */
export async function fetchCompaniesByIds(ids: string[]): Promise<Company[]> {
  const out: Company[] = [];
  for (const part of chunk(ids, 100)) {
    const { data, error } = await supabase.from("companies").select("*").in("id", part);
    if (error) throw error;
    out.push(...((data ?? []) as Company[]));
  }
  return out;
}

// ---------- Related records for the company detail sheet ----------

export function useCompanyContacts(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["contacts", "by-company", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*, companies(id, name)")
        .eq("company_id", companyId!)
        .order("first_name")
        .limit(200);
      if (error) throw error;
      return ((data ?? []) as unknown as Contact[]).map((c) => ({ ...c, tags: c.tags ?? [] }));
    },
  });
}

export function useCompanyDeals(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["deals", "by-company", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select(RELATED_DEAL_SELECT)
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as RelatedDeal[];
    },
  });
}

/** Recent activities logged against this company's contacts or deals. */
export function useCompanyActivities(companyId: string | null | undefined, contactIds: string[], dealIds: string[], limit = 30) {
  const key = `${[...contactIds].sort().join(",")}|${[...dealIds].sort().join(",")}`;
  return useQuery({
    queryKey: ["activities", "by-company", companyId, key, limit],
    enabled: !!companyId && contactIds.length + dealIds.length > 0,
    queryFn: async () => {
      // Ids come from the database (uuids), so they're safe to place in the filter string.
      const parts: string[] = [];
      if (contactIds.length) parts.push(`contact_id.in.(${contactIds.slice(0, 150).join(",")})`);
      if (dealIds.length) parts.push(`deal_id.in.(${dealIds.slice(0, 150).join(",")})`);
      const { data, error } = await supabase
        .from("activities")
        .select(RELATED_ACTIVITY_SELECT)
        .or(parts.join(","))
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as RelatedActivity[];
    },
  });
}
