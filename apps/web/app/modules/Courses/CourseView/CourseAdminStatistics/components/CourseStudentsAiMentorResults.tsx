import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { format } from "date-fns";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCourseStudentsAiMentorResults } from "~/api/queries/admin/useCourseStudentsAiMentorResults";
import { ArrowRight } from "~/assets/svgs";
import { Pagination } from "~/components/Pagination/Pagination";
import SortButton from "~/components/TableSortButton/TableSortButton";
import { Button } from "~/components/ui/button";
import { CircularProgress } from "~/components/ui/circular-progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { useUserRole } from "~/hooks/useUserRole";
import { cn } from "~/lib/utils";
import { tanstackSortingToParam } from "~/utils/tanstackSortingToParam";

import LessonPreviewDialog from "./LessonPreviewDialog";

import type { ColumnDef, SortingState } from "@tanstack/react-table";
import type {
  GetCourseResponse,
  GetCourseStudentsAiMentorResultsResponse,
} from "~/api/generated-api";
import type { CourseStudentsAiMentorResultsQueryParams } from "~/api/queries/admin/useCourseStudentsAiMentorResults";
import type { ITEMS_PER_PAGE_OPTIONS } from "~/components/Pagination/Pagination";
import type { FilterValue } from "~/modules/common/SearchFilter/SearchFilter";

type CourseStudentsAiMentorResultsColumn = GetCourseStudentsAiMentorResultsResponse["data"][number];

interface CourseStudentsAiMentorResultsTableProps {
  courseId: string;
  searchParams: CourseStudentsAiMentorResultsQueryParams;
  onFilterChange: (name: string, value: FilterValue) => void;
  course?: GetCourseResponse["data"];
}

export function CourseStudentsAiMentorResultsTable({
  courseId,
  searchParams,
  onFilterChange,
  course,
}: CourseStudentsAiMentorResultsTableProps) {
  const { t } = useTranslation();

  const { isAdminLike } = useUserRole();

  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [previewDialogData, setPreviewDialogData] = useState<{
    lessonId: string;
    userId: string;
  } | null>(null);

  const [sorting, setSorting] = useState<SortingState>([]);

  const query = useMemo(() => {
    const sort = tanstackSortingToParam(
      sorting,
    ) as CourseStudentsAiMentorResultsQueryParams["sort"];
    return { ...searchParams, sort };
  }, [searchParams, sorting]);

  const { data: courseStudentsAiMentorResults, isFetching } = useCourseStudentsAiMentorResults({
    id: courseId,
    enabled: isAdminLike,
    query,
  });

  const tableData = useMemo(() => {
    return courseStudentsAiMentorResults?.data || [];
  }, [courseStudentsAiMentorResults]);

  const columns: ColumnDef<CourseStudentsAiMentorResultsColumn>[] = useMemo(
    () => [
      {
        accessorKey: "studentName",
        header: ({ column }) => (
          <SortButton<CourseStudentsAiMentorResultsColumn> column={column}>
            {t("adminCourseView.statistics.field.studentName")}
          </SortButton>
        ),
        cell: ({ row }) => (
          <div className="max-w-md truncate flex items-center gap-2">
            <UserAvatar
              className="size-7"
              userName={row.original.studentName}
              profilePictureUrl={row.original.studentAvatarUrl}
            />
            {row.original.studentName}
          </div>
        ),
      },
      {
        accessorKey: "lessonName",
        header: ({ column }) => (
          <SortButton<CourseStudentsAiMentorResultsColumn> column={column}>
            {t("adminCourseView.statistics.field.lessonName")}
          </SortButton>
        ),
        cell: ({ row }) => (
          <div className="text-neutral-800 font-semibold">{row.original.lessonName}</div>
        ),
      },
      {
        accessorKey: "score",
        header: ({ column }) => (
          <SortButton<CourseStudentsAiMentorResultsColumn> column={column}>
            {t("adminCourseView.statistics.field.score")}
          </SortButton>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <CircularProgress value={row.original.score} size={32} strokeWidth={2} />
            {row.original.score}%
          </div>
        ),
      },
      {
        accessorKey: "lastSession",
        header: ({ column }) => (
          <SortButton<CourseStudentsAiMentorResultsColumn> column={column}>
            {t("adminCourseView.statistics.field.lastSession")}
          </SortButton>
        ),
        cell: ({ row }) =>
          row.original.lastSession
            ? format(new Date(row.original.lastSession), "MMM dd, yyyy")
            : null,
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setPreviewDialogData({
                  lessonId: row.original.lessonId,
                  userId: row.original.studentId,
                });
                setIsPreviewDialogOpen(true);
              }}
            >
              <ArrowRight className="size-4 text-black" />
            </Button>
          </div>
        ),
      },
    ],
    [t],
  );

  const handleSortingChange = useCallback(
    (updaterOrValue: SortingState | ((old: SortingState) => SortingState)) => {
      setSorting(updaterOrValue);
    },
    [],
  );

  const table = useReactTable({
    getRowId: (row) => row.studentId,
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: handleSortingChange,
    manualSorting: true,
    state: {
      sorting,
    },
  });

  const handleFilterChange = (name: string, value: FilterValue) => {
    onFilterChange(name, value);
  };

  const { totalItems, perPage, page } = courseStudentsAiMentorResults?.pagination || {};

  return (
    <div
      className={cn(
        "rounded-lg overflow-hidden border border-neutral-200 relative",
        isFetching && "shimmer-45",
      )}
    >
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="text-neutral-900 body-base-md bg-neutral-50">
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id + row.index}
              data-state={row.getIsSelected() && "selected"}
              className="cursor-pointer hover:bg-neutral-100"
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pagination
        className="border-t"
        totalItems={totalItems}
        itemsPerPage={perPage as (typeof ITEMS_PER_PAGE_OPTIONS)[number]}
        currentPage={page}
        onPageChange={(newPage) => handleFilterChange("page", String(newPage))}
        onItemsPerPageChange={(newPerPage) => {
          handleFilterChange("page", "1");
          handleFilterChange("perPage", newPerPage);
        }}
      />
      {previewDialogData && course && (
        <LessonPreviewDialog
          course={course}
          lessonId={previewDialogData.lessonId}
          userId={previewDialogData.userId}
          isOpen={isPreviewDialogOpen}
          onClose={() => {
            setIsPreviewDialogOpen(false);
            setPreviewDialogData(null);
          }}
        />
      )}
    </div>
  );
}
