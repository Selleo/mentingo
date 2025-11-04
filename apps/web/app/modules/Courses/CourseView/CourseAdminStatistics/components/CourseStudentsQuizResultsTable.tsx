import { useParams } from "@remix-run/react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCourseStudentsQuizResults } from "~/api/queries/admin/useCourseStudentsQuizResults";
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
import Loader from "~/modules/common/Loader/Loader";

import LessonPreviewDialog from "./LessonPreviewDialog";

import type { ColumnDef, SortingState } from "@tanstack/react-table";
import type { GetCourseResponse, GetCourseStudentsQuizResultsResponse } from "~/api/generated-api";
import type { CourseStudentsQuizResultsQueryParams } from "~/api/queries/admin/useCourseStudentsQuizResults";
import type { ITEMS_PER_PAGE_OPTIONS } from "~/components/Pagination/Pagination";
import type { FilterValue } from "~/modules/common/SearchFilter/SearchFilter";

type CourseStudentsQuizResultsColumn = GetCourseStudentsQuizResultsResponse["data"][number];

interface CourseStudentsQuizResultsTableProps {
  course?: GetCourseResponse["data"];
  searchParams: CourseStudentsQuizResultsQueryParams;
  onFilterChange: (name: string, value: FilterValue) => void;
}

export function CourseStudentsQuizResultsTable({
  course,
  searchParams,
  onFilterChange,
}: CourseStudentsQuizResultsTableProps) {
  const { t } = useTranslation();

  const { id = "" } = useParams();

  const { isAdminLike } = useUserRole();

  const [sorting, setSorting] = useState<SortingState>([]);

  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [previewDialogData, setPreviewDialogData] = useState<{
    lessonId: string;
    userId: string;
  } | null>(null);

  const { data: courseStudentsQuizResults, isLoading } = useCourseStudentsQuizResults({
    id,
    enabled: isAdminLike,
    query: searchParams,
  });

  const columns: ColumnDef<CourseStudentsQuizResultsColumn>[] = [
    {
      accessorKey: "studentName",
      header: ({ column }) => (
        <SortButton<CourseStudentsQuizResultsColumn> column={column}>
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
      accessorKey: "quizName",
      header: ({ column }) => (
        <SortButton<CourseStudentsQuizResultsColumn> column={column}>
          {t("adminCourseView.statistics.field.quizName")}
        </SortButton>
      ),
      cell: ({ row }) => (
        <div className="text-neutral-800 font-semibold">{row.original.quizName}</div>
      ),
    },
    {
      accessorKey: "quizScore",
      header: ({ column }) => (
        <SortButton<CourseStudentsQuizResultsColumn> column={column}>
          {t("adminCourseView.statistics.field.quizScore")}
        </SortButton>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <CircularProgress value={row.original.quizScore} size={32} strokeWidth={2} />
          {row.original.quizScore}%
        </div>
      ),
    },
    {
      accessorKey: "attempts",
      header: ({ column }) => (
        <SortButton<CourseStudentsQuizResultsColumn> column={column}>
          {t("adminCourseView.statistics.field.attempts")}
        </SortButton>
      ),
    },
    {
      accessorKey: "lastAttempt",
      header: ({ column }) => (
        <SortButton<CourseStudentsQuizResultsColumn> column={column}>
          {t("adminCourseView.statistics.field.lastAttempt")}
        </SortButton>
      ),
      cell: ({ row }) =>
        row.original.lastAttempt
          ? format(new Date(row.original.lastAttempt), "MMM dd, yyyy")
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
  ];

  const table = useReactTable({
    getRowId: (row) => row.studentId,
    data: courseStudentsQuizResults?.data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  const handleFilterChange = (name: string, value: FilterValue) => {
    onFilterChange(name, value);
  };

  const { totalItems, perPage, page } = courseStudentsQuizResults?.pagination || {};

  if (isLoading) {
    return (
      <div className="min-h-80 grid place-items-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden border border-neutral-200">
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
