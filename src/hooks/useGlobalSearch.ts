import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Pure helpers for the command palette (kept out of the component so they're unit-testable). */

export type SearchKind = "deal" | "contact" | "company" | "activity" | "task";

export interface SearchHit {
  kind: SearchKind;
  id: string;
  label: string;
  /** Secondary text (email, industry, activity type…). */
  sub?: string | null;
  /** Deal value, formatted by the caller with the workspace currency. */
  value?: number | null;
}

export const ROUTE_BY_KIND: Record<SearchKind, string> = {
  deal: "/pipeline",
  contact: "/contacts",
  company: "/companies",
  activity: "/activities",
  task: "/tasks",
};

export function hitHref(hit: Pick<SearchHit, "kind" | "id">): string {
  return `${ROUTE_BY_KIND[hit.kind]}?open=${encodeURIComponent(hit.id)}`;
}

type Row = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const rows = (v: unknown): Row[] => (Array.isArray(v) ? (v.filter((r) => r && typeof r === "object") as Row[]) : []);

/**
 * Normalises the `global_search` RPC payload
 * (`{ deals: [{id,title,value}], contacts: [{id,first_name,last_name,email}], companies: [{id,name,industry}],
 *    activities: [{id,title,type}], tasks: [{id,title,priority,completed}] }`) into flat hits.
 * Unknown/missing sections are ignored so a server-side shape change degrades gracefully.
 */
export function parseSearchResults(payload: unknown): SearchHit[] {
  if (!payload || typeof payload !== "object") return [];
  const p = payload as Record<string, unknown>;
  const hits: SearchHit[] = [];

  for (const r of rows(p.deals)) {
    const id = str(r.id);
    if (!id) continue;
    hits.push({ kind: "deal", id, label: str(r.title) ?? "Untitled deal", value: typeof r.value === "number" ? r.value : r.value != null ? Number(r.value) || null : null });
  }
  for (const r of rows(p.contacts)) {
    const id = str(r.id);
    if (!id) continue;
    const name = [str(r.first_name), str(r.last_name)].filter(Boolean).join(" ");
    hits.push({ kind: "contact", id, label: name || str(r.email) || "Unnamed contact", sub: name ? str(r.email) : null });
  }
  for (const r of rows(p.companies)) {
    const id = str(r.id);
    if (!id) continue;
    hits.push({ kind: "company", id, label: str(r.name) ?? "Unnamed company", sub: str(r.industry) });
  }
  for (const r of rows(p.activities)) {
    const id = str(r.id);
    if (!id) continue;
    hits.push({ kind: "activity", id, label: str(r.title) ?? "Untitled activity", sub: str(r.type) });
  }
  for (const r of rows(p.tasks)) {
    const id = str(r.id);
    if (!id) continue;
    hits.push({ kind: "task", id, label: str(r.title) ?? "Untitled task", sub: r.completed === true ? "Completed" : str(r.priority) });
  }
  return hits;
}

/**
 * localStorage key for a user's recently opened records in one workspace (records from another
 * workspace would be dead links), or null until both are known.
 */
export function recentRecordsKey(userId: string | undefined, orgId: string | undefined): string | null {
  return userId && orgId ? `goom:recent-records:${userId}:${orgId}` : null;
}

/** Most-recent-first, de-duplicated, capped list of recently opened records. */
export function pushRecent(list: SearchHit[], hit: SearchHit, max = 6): SearchHit[] {
  const { kind, id, label, sub } = hit;
  return [{ kind, id, label, sub: sub ?? null }, ...list.filter((h) => !(h.kind === kind && h.id === id))].slice(0, max);
}

/** Case-insensitive match of a command against the query (label + keywords). */
export function matchesCommand(query: string, label: string, keywords: string[] = []): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [label, ...keywords].some((s) => s.toLowerCase().includes(q));
}

/* ---------------------------------------------------------------------------------------------- */

const SEARCH_LIMIT = 8;
export const MIN_SEARCH_LENGTH = 2;

/**
 * Workspace-wide search via the `global_search` RPC (RLS/workspace scoped server-side).
 * Pass an already-debounced term.
 */
export function useGlobalSearch(term: string) {
  const q = term.trim();
  return useQuery({
    queryKey: ["global-search", q],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("global_search", { search_term: q, max_results: SEARCH_LIMIT });
      if (error) throw error;
      return parseSearchResults(data);
    },
    enabled: q.length >= MIN_SEARCH_LENGTH,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
}
