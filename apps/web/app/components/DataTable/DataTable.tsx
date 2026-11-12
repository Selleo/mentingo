import { flexRender } from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";

import { type RowRangeSelection, SELECT_COLUMN_ID } from "./dataTableSelection";

import type { Row, Table as TableInstance } from "@tanstack/react-table";
import type { MouseEvent, ReactNode } from "react";

type DataTableProps<TData> = {
  table: TableInstance<TData>;
  /** Fades the rows while data for new filters loads. */
  isRefreshing?: boolean;
  onRowClick?: (row: Row<TData>) => void;
  /** Lets the whole selection cell toggle its row, with shift-click ranges. */
  rowRangeSelection?: RowRangeSelection;
  emptyState?: ReactNode;
  testId?: string;
  bodyTestId?: string;
  getRowTestId?: (row: TData) => string;
  /** Extra `data-*` attributes per row, e.g. for selectors in end-to-end tests. */
  getRowAttributes?: (row: TData) => Record<`data-${string}`, string>;
};

const INTERACTIVE_ROW_TARGET =
  "a, button, input, label, select, textarea, [role=checkbox], [role=menuitem], [data-row-action]";

/**
 * Clicks on controls inside a row, or on portalled dialogs and menus opened from it, must not
 * trigger the row's own click.
 */
const isRowOwnClick = (event: MouseEvent<HTMLTableRowElement>) =>
  event.target instanceof Element &&
  event.currentTarget.contains(event.target) &&
  !event.target.closest(INTERACTIVE_ROW_TARGET);

export function DataTable<TData>({
  table,
  isRefreshing = false,
  onRowClick,
  rowRangeSelection,
  emptyState,
  testId,
  bodyTestId,
  getRowTestId,
  getRowAttributes,
}: DataTableProps<TData>) {
  const rows = table.getRowModel().rows;
  const columnCount = table.getVisibleLeafColumns().length;

  return (
    <div
      aria-busy={isRefreshing}
      className={cn("border-t border-neutral-200 transition-opacity", isRefreshing && "opacity-60")}
    >
      <Table data-testid={testId}>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn({ "size-12": header.column.id === SELECT_COLUMN_ID })}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody data-testid={bodyTestId}>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              {...getRowAttributes?.(row.original)}
              data-testid={getRowTestId?.(row.original)}
              data-state={row.getIsSelected() && "selected"}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={(event) => {
                if (onRowClick && isRowOwnClick(event)) onRowClick(row);
              }}
              onKeyDown={(event) => {
                if (onRowClick && event.target === event.currentTarget && event.key === "Enter") {
                  onRowClick(row);
                }
              }}
              className={cn(
                "hover:bg-neutral-50",
                onRowClick &&
                  "cursor-pointer focus-visible:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500",
              )}
            >
              {row.getVisibleCells().map((cell) => {
                const isSelectCell = cell.column.id === SELECT_COLUMN_ID;

                return (
                  <TableCell
                    key={cell.id}
                    className={cn("py-2", { "size-12": isSelectCell })}
                    onClick={(event) => {
                      if (!isSelectCell || !rowRangeSelection) return;

                      event.stopPropagation();
                      rowRangeSelection.toggleRowSelection(table, row, event);
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
          {rows.length === 0 && emptyState && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columnCount}>{emptyState}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
