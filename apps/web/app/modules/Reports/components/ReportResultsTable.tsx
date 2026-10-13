import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { TableProperties } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Pagination } from "~/components/Pagination/Pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";

import { getReportResultColumns } from "./ReportResultsTable.columns";

import type { RunReportResponse } from "~/api/generated-api";
import type { ITEMS_PER_PAGE_OPTIONS } from "~/components/Pagination/Pagination";
import type { ReportView } from "~/modules/Reports/reports.types";

type ReportResultsTableProps = {
  result: RunReportResponse["data"];
  view: ReportView;
  language: string;
  timezone: string;
  isFetching: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export function ReportResultsTable({
  result,
  view,
  language,
  timezone,
  isFetching,
  onPageChange,
  onPageSizeChange,
}: ReportResultsTableProps) {
  const { t } = useTranslation();
  const columns = useMemo(
    () => getReportResultColumns(t, view, result.rows, language, timezone),
    [t, view, result.rows, language, timezone],
  );
  const table = useReactTable({
    getRowId: (row) => row.id,
    data: result.rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-neutral-200 bg-white",
        isFetching && "shimmer-45",
      )}
    >
      <div className="flex flex-col gap-0.5 border-b border-neutral-200 px-5 py-4">
        <h3 className="body-base-md flex items-center gap-2 text-neutral-950">
          <TableProperties className="size-4 text-neutral-500" aria-hidden="true" />
          {t("reports.results.tableTitle")}
        </h3>
        <p className="details text-neutral-500">
          {t("reports.help.timezone", { timezone })} {t("reports.scope.boundaryNote")}
        </p>
      </div>
      <Table className="bg-neutral-50">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="whitespace-nowrap">
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} className="hover:bg-neutral-100">
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {!result.rows.length && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="py-12 text-center">
                <p className="body-base-md text-neutral-900">{t("reports.results.emptyTitle")}</p>
                <p className="body-sm mt-1 text-neutral-500">
                  {t("reports.results.emptyDescription")}
                </p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {result.total > 0 && (
        <Pagination
          className="bg-white"
          totalItems={result.total}
          itemsPerPage={result.pageSize as (typeof ITEMS_PER_PAGE_OPTIONS)[number]}
          currentPage={result.page}
          onPageChange={onPageChange}
          onItemsPerPageChange={(value) => onPageSizeChange(Number(value))}
        />
      )}
    </section>
  );
}
