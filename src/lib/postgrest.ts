/**
 * Builds a PostgREST `.or()` filter that ilike-matches `term` against each column.
 *
 * User input is wrapped in double quotes (with `"` and `\` escaped) so commas, parentheses and
 * dots can't break or alter the filter, and `%`/`_` are escaped so they match literally.
 * Returns null for a blank term so callers can skip the filter.
 *
 *   const f = ilikeAny(["first_name", "email"], search);
 *   if (f) query = query.or(f);
 */
export function ilikeAny(columns: string[], term: string): string | null {
  const t = term.trim();
  if (!t) return null;
  const pattern = `%${t.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const quoted = `"${pattern.replace(/["\\]/g, (c) => `\\${c}`)}"`;
  return columns.map((c) => `${c}.ilike.${quoted}`).join(",");
}

/** Page size used by paginated list queries. Supabase caps un-ranged responses at 1000 rows. */
export const PAGE_SIZE = 50;

/**
 * PostgREST answers 416 / PGRST103 when a `.range()` offset is past the last row (e.g. the last
 * page emptied after a delete). For that error returns the total row count from its details
 * ("…but there are only 12 rows"), or 0 when it can't be read; for anything else returns null.
 */
export function rangeNotSatisfiableTotal(error: unknown): number | null {
  if (!error || typeof error !== "object" || (error as { code?: unknown }).code !== "PGRST103") return null;
  const details = (error as { details?: unknown }).details;
  const match = typeof details === "string" ? details.match(/only (\d+) rows?/i) : null;
  return match ? Number(match[1]) : 0;
}

/** The last page index that holds rows for `total` rows (0 when empty). */
export function lastPageIndex(total: number, pageSize: number = PAGE_SIZE): number {
  return Math.max(0, Math.ceil(total / pageSize) - 1);
}
