import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { REPORTS_HANDLES } from "../../../../e2e/data/reports/handles";
import { toReportSort, toTableSorting } from "../utils/reportSort.utils";

import { ReportDataTable } from "./ReportDataTable";
import { getReportResultColumns } from "./ReportResultsTable.columns";

import type { ReportResult, ReportSort } from "../types/reports-api.types";
import type { ReportView } from "../types/reports.types";
import type { SortingState, Updater } from "@tanstack/react-table";
import type { ItemsPerPageOption } from "~/components/Pagination/Pagination";

type ReportResultsTableProps = {
  title?: string;
  hasSubject: boolean;
  groupLabels: Map<string, string>;
  result: ReportResult;
  view: ReportView;
  language: string;
  timezone: string;
  isFetching: boolean;
  sort: ReportSort;
  onSortChange: (sort: ReportSort) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export function ReportResultsTable({
  title,
  hasSubject,
  groupLabels,
  result,
  view,
  language,
  timezone,
  isFetching,
  sort,
  onSortChange,
  onPageChange,
  onPageSizeChange,
}: ReportResultsTableProps) {
  const { t } = useTranslation();
  const columns = useMemo(
    () =>
      getReportResultColumns(t, {
        view,
        rows: result.rows,
        language,
        timezone,
        hasSubject,
        groupLabels,
      }),
    [t, view, result.rows, language, timezone, hasSubject, groupLabels],
  );
  const sorting = useMemo(() => toTableSorting(sort), [sort]);

  const changeSorting = (updater: Updater<SortingState>) => {
    const nextSort = toReportSort(typeof updater === "function" ? updater(sorting) : updater);
    if (nextSort) onSortChange(nextSort);
  };

  const table = useReactTable({
    getRowId: (row) => row.id,
    data: result.rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    enableMultiSort: false,
    sortDescFirst: false,
    onSortingChange: changeSorting,
    state: { sorting },
  });

  return (
    <ReportDataTable
      table={table}
      title={title}
      ariaLabel={t("reports.results.tableTitle")}
      isFetching={isFetching}
      testId={REPORTS_HANDLES.RESULTS_TABLE}
      getRowTestId={(row) => REPORTS_HANDLES.resultRow(row.id)}
      emptyTitle={t("reports.results.emptyTitle")}
      emptyDescription={t("reports.results.emptyDescription")}
      pagination={{
        totalItems: result.total,
        itemsPerPage: result.pageSize as ItemsPerPageOption,
        currentPage: result.page,
        onPageChange,
        onItemsPerPageChange: (pageSize) => onPageSizeChange(Number(pageSize)),
      }}
    />
  );
}
