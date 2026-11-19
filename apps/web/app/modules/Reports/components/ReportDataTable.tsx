import {
  DataTable,
  DataTableCard,
  DataTableEmptyState,
  DataTablePagination,
} from "~/components/DataTable";

import type { Row, Table } from "@tanstack/react-table";
import type { ComponentProps } from "react";

type ReportDataTableProps<TData> = {
  table: Table<TData>;
  title?: string;
  ariaLabel?: string;
  isFetching: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  pagination: ComponentProps<typeof DataTablePagination>;
  onRowClick?: (row: Row<TData>) => void;
  testId?: string;
  getRowTestId?: (row: TData) => string;
};

/** The one table layout every report uses: optional heading, card, rows and pagination. */
export function ReportDataTable<TData>({
  table,
  title,
  ariaLabel,
  isFetching,
  emptyTitle,
  emptyDescription,
  pagination,
  onRowClick,
  testId,
  getRowTestId,
}: ReportDataTableProps<TData>) {
  return (
    <section className="flex flex-col gap-4" aria-label={title ? undefined : ariaLabel}>
      {title && <h2 className="h6 text-neutral-950">{title}</h2>}
      <DataTableCard className="[&>div:first-child]:border-t-0">
        <DataTable
          table={table}
          isRefreshing={isFetching}
          onRowClick={onRowClick}
          testId={testId}
          getRowTestId={getRowTestId}
          emptyState={<DataTableEmptyState title={emptyTitle} description={emptyDescription} />}
        />
        <DataTablePagination {...pagination} />
      </DataTableCard>
    </section>
  );
}
