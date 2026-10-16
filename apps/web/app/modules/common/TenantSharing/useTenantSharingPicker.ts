import { useCallback, useEffect, useMemo, useState } from "react";

import { ITEMS_PER_PAGE_OPTIONS } from "~/components/Pagination/Pagination";
import { useDebounce } from "~/hooks/useDebounce";

import type { RowSelectionState } from "@tanstack/react-table";
import type { ExportCandidatesSearchParams } from "~/api/queries/admin/exportCandidates.types";

export const TENANT_SHARING_PAGE_SIZE = ITEMS_PER_PAGE_OPTIONS[0];

/**
 * Holds the search, page, and row selection of a tenant sharing picker for one shared source.
 * Selection is keyed by tenant ID, so it survives paging and searching.
 */
export function useTenantSharingPicker(sourceId: string) {
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const search = useDebounce(searchInput.trim());

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    setSearchInput("");
    setPage(1);
    setRowSelection({});
  }, [sourceId]);

  const searchParams = useMemo<ExportCandidatesSearchParams>(
    () => ({ search: search || undefined, page, perPage: TENANT_SHARING_PAGE_SIZE }),
    [search, page],
  );

  const selectedTenantIds = useMemo(
    () => Object.keys(rowSelection).filter((tenantId) => rowSelection[tenantId]),
    [rowSelection],
  );

  const clearSelection = useCallback(() => setRowSelection({}), []);

  return {
    searchInput,
    setSearchInput,
    search,
    searchParams,
    setPage,
    rowSelection,
    setRowSelection,
    selectedTenantIds,
    clearSelection,
  };
}
