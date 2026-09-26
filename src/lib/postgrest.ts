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
