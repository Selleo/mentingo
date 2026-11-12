import { useEffect, useState } from "react";

import type { RowSelectionState } from "@tanstack/react-table";

/**
 * Row selection that keeps only the rows still listed. Filtering, paging or deleting drops rows
 * that leave the table, while rows ticked as new results load stay selected.
 */
export function useListedRowSelection(listedRowIds: string[]) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const listedRowIdsKey = listedRowIds.join(",");

  useEffect(() => {
    const listedIds = new Set(listedRowIds);

    setRowSelection((currentSelection) => {
      const selectedIds = Object.keys(currentSelection);
      const listedSelectedIds = selectedIds.filter((rowId) => listedIds.has(rowId));
      if (listedSelectedIds.length === selectedIds.length) return currentSelection;

      return Object.fromEntries(listedSelectedIds.map((rowId) => [rowId, currentSelection[rowId]]));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listedRowIdsKey]);

  return [rowSelection, setRowSelection] as const;
}
