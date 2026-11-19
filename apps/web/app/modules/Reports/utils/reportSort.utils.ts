import { REPORT_SORT_DIRECTIONS, REPORT_SORT_FIELDS } from "@repo/shared";

import type { ReportSort } from "../types/reports-api.types";
import type { ReportSortField } from "@repo/shared";
import type { SortingState } from "@tanstack/react-table";

const REPORT_SORT_FIELD_VALUES: readonly string[] = Object.values(REPORT_SORT_FIELDS);

export const isReportSortField = (columnId: string): columnId is ReportSortField =>
  REPORT_SORT_FIELD_VALUES.includes(columnId);

export const toTableSorting = ({ sortBy, sortDirection }: ReportSort): SortingState => [
  { id: sortBy, desc: sortDirection === REPORT_SORT_DIRECTIONS.DESC },
];

export const toReportSort = (sorting: SortingState): ReportSort | null => {
  const [columnSort] = sorting;
  if (!columnSort || !isReportSortField(columnSort.id)) return null;
  return {
    sortBy: columnSort.id,
    sortDirection: columnSort.desc ? REPORT_SORT_DIRECTIONS.DESC : REPORT_SORT_DIRECTIONS.ASC,
  };
};
