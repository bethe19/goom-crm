/**
 * Pages through a PostgREST query with `.range()` so results are never silently truncated at
 * Supabase's 1000-row response cap.
 *
 *   const rows = await fetchAllRows((from, to) =>
 *     supabase.from("contacts").select("*", { count: "exact" }).order("id").range(from, to),
 *   );
 *
 * The builder MUST apply a stable order (e.g. `.order("id")`) or pages can overlap.
 */
export const FETCH_ALL_PAGE_SIZE = 1000;

type PageResult<T> = { data: T[] | null; error: unknown; count?: number | null };

export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<PageResult<T>>,
  options?: { pageSize?: number; onProgress?: (loaded: number, total: number | null) => void; signal?: AbortSignal },
): Promise<T[]> {
  const pageSize = options?.pageSize ?? FETCH_ALL_PAGE_SIZE;
  const all: T[] = [];
  let total: number | null = null;
  for (let from = 0; ; from += pageSize) {
    if (options?.signal?.aborted) throw new Error("Cancelled");
    const { data, error, count } = await build(from, from + pageSize - 1);
    if (error) throw error;
    if (typeof count === "number") total = count;
    const page = data ?? [];
    all.push(...page);
    options?.onProgress?.(all.length, total);
    if (page.length < pageSize) break;
    if (total !== null && all.length >= total) break;
  }
  return all;
}

/** Splits `items` into arrays of at most `size` (for `.in()` filters that must keep URLs short). */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Escapes `%`, `_` and `\` so a value can be used in `.ilike()` as a case-insensitive equality match. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
