import { useParams } from "@remix-run/react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCourseStudentsProgress } from "~/api/queries/admin/useCourseStudentsProgress";
import { Pagination } from "~/components/Pagination/Pagination";
import SortButton from "~/components/TableSortButton/TableSortButton";
import { Progress } from "~/components/ui/progress";
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
import {
  SearchFilter,
  type FilterConfig,
  type FilterValue,
} from "~/modules/common/SearchFilter/SearchFilter";

import type { ColumnDef, SortingState } from "@tanstack/react-table";
import type { GetCourseStudentsProgressResponse } from "~/api/generated-api";
import type { CourseStudentsProgressQueryParams } from "~/api/queries/admin/useCourseStudentsProgress";
import type { ITEMS_PER_PAGE_OPTIONS } from "~/components/Pagination/Pagination";

type CourseStundentsProgressColumn = GetCourseStudentsProgressResponse["data"][number];

interface CourseStudentsProgressTableProps {
  lessonCount: number;
}

export function CourseStudentsProgressTable({ lessonCount }: CourseStudentsProgressTableProps) {
  const { t } = useTranslation();

  const { id = "" } = useParams();

  const { isAdminLike } = useUserRole();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchParams, setSearchParams] = useState<CourseStudentsProgressQueryParams>({});

  const [isPending, startTransition] = React.useTransition();

  const { data: courseStudentsProgress } = useCourseStudentsProgress({
    id,
    enabled: isAdminLike,
    query: searchParams,
  });

  const filterConfig: FilterConfig[] = [
    {
      name: "search",
      type: "text",
    },
  ];

  const columns: ColumnDef<CourseStundentsProgressColumn>[] = [
    {
      accessorKey: "studentName",
      header: ({ column }) => (
        <SortButton<CourseStundentsProgressColumn> column={column}>
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
      accessorKey: "groupName",
      header: ({ column }) => (
        <SortButton<CourseStundentsProgressColumn> column={column}>
          {t("adminCourseView.statistics.field.groupName")}
        </SortButton>
      ),
      cell: ({ row }) => (
        <div className="text-neutral-800 font-semibold">{row.original.groupName}</div>
      ),
    },
    {
      accessorKey: "completedLessonsCount",
      header: ({ column }) => (
        <SortButton<CourseStundentsProgressColumn> column={column}>
          {t("adminCourseView.statistics.field.completedLessonsCount")}
        </SortButton>
      ),
      cell: ({ row }) => {
        const progressValue = (row.original.completedLessonsCount / lessonCount) * 100;

        return (
          <div className="flex items-center gap-2">
            <Progress
              className="h-2 w-4/5"
              indicatorClassName={cn({
                "bg-success-500": progressValue === 100,
              })}
              value={progressValue}
            />
            {row.original.completedLessonsCount}/{lessonCount}
          </div>
        );
      },
    },
    {
      accessorKey: "lastActivity",
      header: ({ column }) => (
        <SortButton<CourseStundentsProgressColumn> column={column}>
          {t("adminCourseView.statistics.field.lastActivity")}
        </SortButton>
      ),
      cell: ({ row }) =>
        row.original.lastActivity
          ? format(new Date(row.original.lastActivity), "MMM dd, yyyy")
          : null,
    },
  ];

  const table = useReactTable({
    getRowId: (row) => row.studentId,
    data: courseStudentsProgress?.data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  const handleFilterChange = (name: string, value: FilterValue) => {
    startTransition(() => {
      setSearchParams((prev) => ({
        ...prev,
        [name]: value,
      }));
    });
  };

  const { totalItems, perPage, page } = courseStudentsProgress?.pagination || {};

  return (
    <div className="rounded-sm flex flex-col justify-center">
      <div className="flex items-center justify-between">
        <h6 className="h6 grow">{t("adminCourseView.statistics.details")}</h6>
        <SearchFilter
          filters={filterConfig}
          values={{ search: searchParams.search }}
          onChange={handleFilterChange}
          isLoading={isPending}
        />
      </div>
      <div className="rounded-lg overflow-hidden border border-neutral-200">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="text-neutral-900 body-base-md bg-neutral-50"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-course-id={row.original.studentId}
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
      </div>
    </div>
  );
}
