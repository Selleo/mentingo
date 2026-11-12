import { useMemo, useRef } from "react";

import { Checkbox } from "~/components/ui/checkbox";
import { handleRowSelectionRange } from "~/utils/tableRangeSelection";

import type { ColumnDef, Row, Table } from "@tanstack/react-table";
import type { MouseEvent } from "react";

export const SELECT_COLUMN_ID = "select";

/**
 * Remembers the last toggled row so shift-click can select a range. The returned object stays the
 * same between renders, so memoized table columns keep their cells mounted.
 */
export function useRowRangeSelection() {
  const lastSelectedRowIndex = useRef(0);

  return useMemo(
    () => ({
      toggleRowSelection: <TData,>(
        table: Table<TData>,
        row: Row<TData>,
        event: MouseEvent<HTMLElement>,
      ) =>
        handleRowSelectionRange({
          table,
          event,
          id: row.id,
          value: row.getIsSelected(),
          lastSelectedRowIndex: lastSelectedRowIndex.current,
          setLastSelectedRowIndex: (rowIndex) => {
            lastSelectedRowIndex.current = rowIndex;
          },
        }),
    }),
    [],
  );
}

export type RowRangeSelection = ReturnType<typeof useRowRangeSelection>;

type SelectColumnOptions<TData> = {
  rowRangeSelection: RowRangeSelection;
  getCheckboxTestId?: (row: TData) => string;
  selectAllTestId?: string;
  selectAllLabel: string;
  selectRowLabel: string;
};

export const createSelectColumn = <TData,>({
  rowRangeSelection,
  getCheckboxTestId,
  selectAllTestId,
  selectAllLabel,
  selectRowLabel,
}: SelectColumnOptions<TData>): ColumnDef<TData> => ({
  id: SELECT_COLUMN_ID,
  header: ({ table }) => (
    <Checkbox
      data-testid={selectAllTestId}
      checked={table.getIsAllPageRowsSelected()}
      onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
      aria-label={selectAllLabel}
    />
  ),
  cell: ({ row, table }) => (
    <Checkbox
      checked={row.getIsSelected()}
      aria-label={selectRowLabel}
      data-testid={getCheckboxTestId?.(row.original)}
      onClick={(event) => {
        event.stopPropagation();
        rowRangeSelection.toggleRowSelection(table, row, event);
      }}
    />
  ),
  enableSorting: false,
});
