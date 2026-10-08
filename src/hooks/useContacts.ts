import { useQuery, useMutation, useQueryClient, keepPreviousData, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { assertAffected } from "@/components/settings/validation";
import { ilikeAny, PAGE_SIZE, rangeNotSatisfiableTotal } from "@/lib/postgrest";
import { chunk, escapeLike, fetchAllRows } from "@/lib/fetchAll";
import type { Task } from "@/hooks/useTasks";

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  company_id: string | null;
  tags: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  companies?: { id: string; name: string } | null;
  /** Most recent activity (only populated by `useContactsPage`). */
  activities?: { created_at: string }[];
}

export interface ContactInput {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  position?: string | null;
  company_id?: string | null;
  tags?: string[];
}

export const CONTACT_SELECT = "*, companies(id, name)";
const SEARCH_COLUMNS = ["first_name", "last_name", "email", "position", "phone"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any;

/**
 * Applies a search term: every whitespace-separated word must match at least one column,
 * so "jane smith" finds first_name=Jane, last_name=Smith. Input is escaped via ilikeAny.
 */
function applySearch(query: AnyQuery, search: string | undefined): AnyQuery {
  const words = (search ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 5);
  for (const w of words) {
    const f = ilikeAny(SEARCH_COLUMNS, w);
    if (f) query = query.or(f);
  }
  return query;
}

function normalize(row: Record<string, unknown>): Contact {
  return { ...(row as unknown as Contact), tags: (row.tags as string[] | null) ?? [] };
}

/**
 * Simple list for pickers and lookups (not paginated). Keeps the original call shape:
 * `useContacts()` / `useContacts(search)`. Capped at `limit` (default 1000).
 */
export function useContacts(search?: string, options?: { limit?: number; companyId?: string | null; enabled?: boolean }) {
  const limit = options?.limit ?? 1000;
  return useQuery({
    queryKey: ["contacts", "list", search ?? "", limit, options?.companyId ?? null],
    queryFn: async () => {
      let query: AnyQuery = supabase.from("contacts").select(CONTACT_SELECT).order("created_at", { ascending: false });
      query = applySearch(query, search);
      if (options?.companyId) query = query.eq("company_id", options.companyId);
      const { data, error } = await query.limit(limit);
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map(normalize);
    },
    enabled: options?.enabled ?? true,
  });
}

export type ContactSort = "created" | "name" | "company";
export type SortDir = "asc" | "desc";

export interface ContactsPageParams {
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: ContactSort;
  dir?: SortDir;
  tag?: string | null;
  companyId?: string | null;
}

/** Server-side paginated, searchable, sortable contact list. Returns `{ rows, total }`. */
export function useContactsPage(params: ContactsPageParams) {
  const { search = "", page = 0, pageSize = PAGE_SIZE, sort = "created", dir = "desc", tag = null, companyId = null } = params;
  return useQuery({
    queryKey: ["contacts", "page", { search, page, pageSize, sort, dir, tag, companyId }],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<{ rows: Contact[]; total: number }> => {
      let query: AnyQuery = supabase
        .from("contacts")
        .select(`${CONTACT_SELECT}, activities(created_at)`, { count: "exact" });
      query = applySearch(query, search);
      if (tag) query = query.contains("tags", [tag]);
      if (companyId) query = query.eq("company_id", companyId);
      const ascending = dir === "asc";
      if (sort === "name") {
        query = query.order("first_name", { ascending }).order("last_name", { ascending });
      } else if (sort === "company") {
        query = query.order("companies(name)", { ascending, nullsFirst: false });
      } else {
        query = query.order("created_at", { ascending });
      }
      query = query
        .order("id", { ascending: true })
        .order("created_at", { referencedTable: "activities", ascending: false })
        .limit(1, { referencedTable: "activities" })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      const { data, error, count } = await query;
      if (error) {
        // Offset past the end (e.g. the last page was just deleted): report it as an empty page so the
        // list can step back instead of showing an error.
        const outOfRangeTotal = rangeNotSatisfiableTotal(error);
        if (outOfRangeTotal !== null) return { rows: [], total: outOfRangeTotal };
        throw error;
      }
      return { rows: ((data ?? []) as Record<string, unknown>[]).map(normalize), total: count ?? 0 };
    },
  });
}

/** One contact by id (for deep links / detail sheets). Resolves to null when not found. */
export function useContact(id: string | null | undefined, initialData?: Contact | null) {
  return useQuery({
    queryKey: ["contacts", "detail", id],
    enabled: !!id,
    placeholderData: initialData ?? undefined,
    queryFn: async (): Promise<Contact | null> => {
      const { data, error } = await supabase.from("contacts").select(CONTACT_SELECT).eq("id", id!).maybeSingle();
      if (error) throw error;
      return data ? normalize(data as Record<string, unknown>) : null;
    },
  });
}

/** All distinct tags used on contacts in this workspace (sorted). */
export function useContactTags() {
  return useQuery({
    queryKey: ["contacts", "tags"],
    staleTime: 60_000,
    queryFn: async () => {
      const rows = await fetchAllRows<{ tags: string[] | null }>((from, to) =>
        supabase.from("contacts").select("tags").not("tags", "eq", "{}").order("id").range(from, to),
      );
      const set = new Set<string>();
      rows.forEach((r) => r.tags?.forEach((t) => t && set.add(t)));
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    },
  });
}

/** Returns an existing contact with this email (case-insensitive), ignoring `excludeId`. */
export async function findContactByEmail(email: string, excludeId?: string): Promise<Contact | null> {
  const e = email.trim();
  if (!e) return null;
  // PostgREST reads `*` in (i)like patterns as `%`, so match it as a single character (`_`) and
  // confirm the exact value below.
  const pattern = escapeLike(e).replace(/\*/g, "_");
  let query: AnyQuery = supabase.from("contacts").select(CONTACT_SELECT).ilike("email", pattern);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query.limit(20);
  if (error) throw error;
  const target = e.toLowerCase();
  const row = ((data as Record<string, unknown>[] | null) ?? []).find((r) => typeof r.email === "string" && r.email.toLowerCase() === target);
  return row ? normalize(row) : null;
}

/** Debounce the email yourself; returns the duplicate contact (if any) for a create/edit form. */
export function useDuplicateContactEmail(email: string, excludeId?: string) {
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  return useQuery({
    queryKey: ["contacts", "duplicate-email", email.trim().toLowerCase(), excludeId ?? null],
    enabled: valid,
    staleTime: 30_000,
    queryFn: () => findContactByEmail(email, excludeId),
  });
}

/**
 * Query roots that show contact names or details: lists, pickers, embeds on companies/deals, search.
 * Company options too, since the contact form can create a company (resolveCompanyChoice).
 */
const CONTACT_DATA_KEYS: QueryKey[] = [
  ["contacts"],
  ["contact-options"],
  ["picker-label", "contacts"],
  ["companies"],
  ["company-options"],
  ["deals"],
  ["deal"],
  ["global-search"],
];

/** After a delete, also the records that referenced the contacts (now unlinked) and usage counts. */
const CONTACT_DELETE_KEYS: QueryKey[] = [
  ...CONTACT_DATA_KEYS,
  ["deal-options"],
  ["activities"],
  ["activities-feed"],
  ["activity"],
  ["calendar"],
  ["analytics"],
  ["tasks"],
  ["task"],
  ["workspace-usage"],
];

function invalidateKeys(queryClient: QueryClient, keys: QueryKey[]) {
  for (const queryKey of keys) queryClient.invalidateQueries({ queryKey });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (contact: ContactInput & { created_by?: string }) => {
      const { data, error } = await supabase.from("contacts").insert(contact as never).select(CONTACT_SELECT).single();
      if (error) throw error;
      return normalize(data as Record<string, unknown>);
    },
    onSuccess: () => invalidateKeys(queryClient, [...CONTACT_DATA_KEYS, ["workspace-usage"]]),
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<ContactInput> & { [key: string]: any }) => {
      const { data, error } = await supabase.from("contacts").update(updates as never).eq("id", id).select(CONTACT_SELECT).single();
      if (error) throw error;
      return normalize(data as Record<string, unknown>);
    },
    onSuccess: (contact) => {
      queryClient.setQueryData(["contacts", "detail", contact.id], contact);
      invalidateKeys(queryClient, CONTACT_DATA_KEYS);
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error, count } = await supabase.from("contacts").delete({ count: "exact" }).eq("id", id);
      if (error) throw error;
      assertAffected(count);
    },
    onSuccess: () => invalidateKeys(queryClient, CONTACT_DELETE_KEYS),
  });
}

/**
 * Deletes many contacts with one `.in()` request per 100 ids. Resolves to the number the server
 * actually deleted (rows the caller may not delete are skipped by RLS). Lists refresh even when a
 * later chunk fails, so rows that were already deleted don't linger on screen.
 */
export function useBulkDeleteContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      let deleted = 0;
      for (const part of chunk(ids, 100)) {
        const { error, count } = await supabase.from("contacts").delete({ count: "exact" }).in("id", part);
        if (error) throw error;
        deleted += count ?? 0;
      }
      return deleted;
    },
    onSettled: () => invalidateKeys(queryClient, CONTACT_DELETE_KEYS),
  });
}

/** Pure: the tag list after adding/removing `tag` (case-insensitive match, keeps existing casing). */
export function applyTagChange(tags: string[] | null | undefined, tag: string, mode: "add" | "remove"): string[] {
  const current = tags ?? [];
  const t = tag.trim();
  const has = current.some((x) => x.toLowerCase() === t.toLowerCase());
  if (mode === "add") return has || !t ? current : [...current, t];
  return current.filter((x) => x.toLowerCase() !== t.toLowerCase());
}

/**
 * Adds or removes a tag on many contacts. Contacts that end up with identical tag arrays are
 * updated together in a single `.in()` request. Resolves to the number of contacts changed.
 */
export function useBulkTagContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, tag, mode }: { ids: string[]; tag: string; mode: "add" | "remove" }) => {
      const rows: { id: string; tags: string[] | null }[] = [];
      for (const part of chunk(ids, 100)) {
        const { data, error } = await supabase.from("contacts").select("id, tags").in("id", part);
        if (error) throw error;
        rows.push(...((data ?? []) as { id: string; tags: string[] | null }[]));
      }
      const groups = new Map<string, { tags: string[]; ids: string[] }>();
      for (const r of rows) {
        const next = applyTagChange(r.tags, tag, mode);
        if (JSON.stringify(next) === JSON.stringify(r.tags ?? [])) continue;
        const key = JSON.stringify(next);
        const g = groups.get(key) ?? { tags: next, ids: [] };
        g.ids.push(r.id);
        groups.set(key, g);
      }
      let changed = 0;
      for (const g of groups.values()) {
        for (const part of chunk(g.ids, 100)) {
          const { error, count } = await supabase.from("contacts").update({ tags: g.tags }, { count: "exact" }).in("id", part);
          if (error) throw error;
          changed += count ?? 0;
        }
      }
      return changed;
    },
    // Settled, not success: a later chunk can fail after earlier ones were saved.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["contacts"] }),
  });
}

/** Fetches full contact rows for the given ids (e.g. to export a selection). */
export async function fetchContactsByIds(ids: string[]): Promise<Contact[]> {
  const out: Contact[] = [];
  for (const part of chunk(ids, 100)) {
    const { data, error } = await supabase.from("contacts").select(CONTACT_SELECT).in("id", part);
    if (error) throw error;
    out.push(...((data ?? []) as Record<string, unknown>[]).map(normalize));
  }
  return out;
}

// ---------- Related records for the contact detail sheet ----------
// Query keys start with the owning table's key so those hooks' mutations refresh them.

export interface RelatedDeal {
  id: string;
  title: string;
  value: number | null;
  close_date: string | null;
  created_at: string;
  pipeline_stages?: { id: string; name: string; color: string; is_won?: boolean | null; is_lost?: boolean | null } | null;
  companies?: { id: string; name: string } | null;
}

export interface RelatedActivity {
  id: string;
  type: "call" | "email" | "meeting" | "note";
  title: string;
  description: string | null;
  created_at: string;
  deal_id: string | null;
  contact_id: string | null;
  deals?: { id: string; title: string } | null;
  contacts?: { id: string; first_name: string; last_name: string } | null;
}

export const RELATED_DEAL_SELECT = "id, title, value, close_date, created_at, pipeline_stages(*), companies(id, name)";
export const RELATED_ACTIVITY_SELECT = "id, type, title, description, created_at, deal_id, contact_id, deals(id, title), contacts(id, first_name, last_name)";

export function useContactDeals(contactId: string | null | undefined) {
  return useQuery({
    queryKey: ["deals", "by-contact", contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select(RELATED_DEAL_SELECT)
        .eq("contact_id", contactId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as RelatedDeal[];
    },
  });
}

export function useContactActivities(contactId: string | null | undefined, limit = 50) {
  return useQuery({
    queryKey: ["activities", "by-contact", contactId, limit],
    enabled: !!contactId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select(RELATED_ACTIVITY_SELECT)
        .eq("contact_id", contactId!)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as RelatedActivity[];
    },
  });
}

export function useContactTasks(contactId: string | null | undefined) {
  return useQuery({
    queryKey: ["tasks", "by-contact", contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, deals(id, title), contacts(id, first_name, last_name)")
        .eq("contact_id", contactId!)
        .order("completed", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Task[];
    },
  });
}
