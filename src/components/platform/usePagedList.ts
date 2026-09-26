import { useEffect, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { PAGE_SIZE } from "@/lib/postgrest";
import { lastPage } from "./platformUtils";

/** Page + debounced search state for a paginated list; changing the search resets to the first page. */
export function usePagedList() {
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounce(searchInput, 250).trim();
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [search]);

  return { searchInput, setSearchInput, search, page, setPage };
}

/** Moves back into range when a page comes back empty (e.g. the total shrank after a refetch). */
export function useClampPage(page: number, setPage: (page: number) => void, data: { rows: unknown[]; total: number } | undefined) {
  useEffect(() => {
    if (!data || page === 0 || data.rows.length > 0) return;
    setPage(Math.min(page - 1, lastPage(data.total, PAGE_SIZE)));
  }, [data, page, setPage]);
}
