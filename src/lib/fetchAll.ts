/**
 * Pages through a PostgREST query with `.range()` so results are never silently truncated at
 * Supabase's response cap (`max_rows`, 1000 by default but configurable per project).
 *
 *   const rows = await fetchAllRows((from, to) =>
 *     supabase.from("contacts").select("*", from === 0 ? { count: "exact" } : undefined).order("id").range(from, to),
 *   );
 *
 * The builder MUST apply a stable order (e.g. `.order("id")`) or pages can overlap. Ask for the
 * count on the first page only; it's used for progress and to skip the final empty request.
 */
export const FETCH_ALL_PAGE_SIZE = 1000;

type PageResult<T> = { data: T[] | null; error: unknown; count?: number | null };

export interface FetchAllOptions {
  pageSize?: number;
  onProgress?: (loaded: number, total: number | null) => void;
  signal?: AbortSignal;
}

export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<PageResult<T>>,
  options?: FetchAllOptions,
  /** Same as `options.signal`, for callers that only need cancellation. */
  signal?: AbortSignal,
): Promise<T[]> {
  const pageSize = options?.pageSize ?? FETCH_ALL_PAGE_SIZE;
  const abort = signal ?? options?.signal;
  const all: T[] = [];
  let total: number | null = null;
  for (;;) {
    // Same as abort.throwIfAborted(), which older Safari (and jsdom) lack.
    if (abort?.aborted) throw abort.reason ?? new DOMException("The operation was aborted.", "AbortError");
    // Advance by what the server actually returned: a page shorter than pageSize only means the
    // server caps responses lower, not that we're done.
    const from = all.length;
    const { data, error, count } = await build(from, from + pageSize - 1);
    if (error) throw error;
    if (typeof count === "number") total = count;
    const page = data ?? [];
    if (!page.length) break;
    all.push(...page);
    options?.onProgress?.(all.length, total);
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
