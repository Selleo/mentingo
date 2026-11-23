import { useNavigate } from "@remix-run/react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  COURSE_OVERVIEW_TAB_SEARCH_PARAM,
  COURSE_OVERVIEW_TABS,
} from "~/modules/Courses/CourseView/TableOfContent/CourseOverviewTabs";

import { DEFAULT_REPORT_PAGE_SIZE } from "../constants/reports.constants";

import { ReportDataTable } from "./ReportDataTable";
import {
  ReportNumberCell,
  ReportPercentCell,
  ReportProgressCell,
  reportSortableHeader,
  ReportTextCell,
} from "./ReportTableCells";

import type { ReportBreakdownItem } from "../types/reportCharts.types";
import type { ColumnDef, PaginationState, SortingState } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import type { ItemsPerPageOption } from "~/components/Pagination/Pagination";

type ReportCourseResultsTableProps = {
  courses: ReportBreakdownItem[];
  isFetching: boolean;
};

const sortableHeader = (label: string) => reportSortableHeader<ReportBreakdownItem>(label);

const getCourseResultColumns = (t: TFunction): ColumnDef<ReportBreakdownItem>[] => [
  {
    id: "course",
    accessorFn: (course) => course.label,
    header: sortableHeader(t("reports.courseResults.course")),
    cell: ({ row }) => <ReportTextCell>{row.original.label}</ReportTextCell>,
  },
  {
    id: "enrolled",
    accessorFn: (course) => course.courseEnrollments,
    header: sortableHeader(t("reports.courseResults.enrolled")),
    cell: ({ row }) => <ReportNumberCell>{row.original.courseEnrollments}</ReportNumberCell>,
  },
  {
    id: "completionRate",
    accessorFn: (course) => course.completionRate ?? undefined,
    sortUndefined: "last",
    header: sortableHeader(t("reports.courseResults.completionRate")),
    cell: ({ row }) => <ReportPercentCell value={row.original.completionRate} />,
  },
  {
    id: "averageProgress",
    accessorFn: (course) => course.averageProgress ?? undefined,
    sortUndefined: "last",
    header: sortableHeader(t("reports.courseResults.averageProgress")),
    cell: ({ row }) => <ReportProgressCell value={row.original.averageProgress} />,
  },
  {
    id: "averageQuizScore",
    accessorFn: (course) => course.averageScore ?? undefined,
    sortUndefined: "last",
    header: sortableHeader(t("reports.courseResults.averageQuizScore")),
    cell: ({ row }) => <ReportPercentCell value={row.original.averageScore} />,
  },
];

export function ReportCourseResultsTable({ courses, isFetching }: ReportCourseResultsTableProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const columns = useMemo(() => getCourseResultColumns(t), [t]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_REPORT_PAGE_SIZE,
  });
  const table = useReactTable({
    getRowId: (course) => course.id,
    data: courses,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableMultiSort: false,
    sortDescFirst: false,
    autoResetPageIndex: true,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    state: { sorting, pagination },
  });

  return (
    <ReportDataTable
      table={table}
      ariaLabel={t("reports.views.course")}
      isFetching={isFetching}
      emptyTitle={t("reports.courseResults.empty")}
      pagination={{
        totalItems: courses.length,
        itemsPerPage: pagination.pageSize as ItemsPerPageOption,
        currentPage: pagination.pageIndex + 1,
        onPageChange: (page) => table.setPageIndex(page - 1),
        onItemsPerPageChange: (pageSize) => table.setPageSize(Number(pageSize)),
      }}
      onRowClick={(row) =>
        navigate(
          `/course/${row.original.id}?${COURSE_OVERVIEW_TAB_SEARCH_PARAM}=${COURSE_OVERVIEW_TABS.STATISTICS}`,
        )
      }
    />
  );
}
