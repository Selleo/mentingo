import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { format } from "date-fns";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCourseStudentsProgress } from "~/api/queries/admin/useCourseStudentsProgress";
import { Pagination } from "~/components/Pagination/Pagination";
import SortButton from "~/components/TableSortButton/TableSortButton";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { useUserRole } from "~/hooks/useUserRole";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { tanstackSortingToParam } from "~/utils/tanstackSortingToParam";

import type { ColumnDef, SortingState } from "@tanstack/react-table";
import type { GetCourseStudentsProgressResponse } from "~/api/generated-api";
import type { CourseStudentsProgressQueryParams } from "~/api/queries/admin/useCourseStudentsProgress";
import type { ITEMS_PER_PAGE_OPTIONS } from "~/components/Pagination/Pagination";
import type { FilterValue } from "~/modules/common/SearchFilter/SearchFilter";

type CourseStudentsProgressColumn = GetCourseStudentsProgressResponse["data"][number];

interface CourseStudentsProgressTableProps {
  courseId: string;
  lessonCount: number;
  searchParams: CourseStudentsProgressQueryParams;
  onFilterChange: (name: string, value: FilterValue) => void;
}

export function CourseStudentsProgressTable({
  courseId,
  lessonCount,
  searchParams,
  onFilterChange,
}: CourseStudentsProgressTableProps) {
  const { t } = useTranslation();

  const { isAdminLike } = useUserRole();
  const { language } = useLanguageStore();

  const [sorting, setSorting] = useState<SortingState>([]);

  const query = useMemo(() => {
    const sort = tanstackSortingToParam(sorting) as CourseStudentsProgressQueryParams["sort"];
    return { ...searchParams, sort, language };
  }, [searchParams, sorting, language]);

  const { data: courseStudentsProgress, isFetching } = useCourseStudentsProgress({
    id: courseId,
    enabled: isAdminLike,
    query,
  });

  const tableData = useMemo(() => {
    return courseStudentsProgress?.data || [];
  }, [courseStudentsProgress]);

  const columns: ColumnDef<CourseStudentsProgressColumn>[] = useMemo(
    () => [
      {
        accessorKey: "studentName",
        header: ({ column }) => (
          <SortButton<CourseStudentsProgressColumn> column={column}>
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
        accessorKey: "groups",
        header: () => (
          <span className="body-sm whitespace-nowrap">
            {t("adminCourseView.statistics.field.groupName")}
          </span>
        ),
        cell: ({ row }) => {
          const groups = row.original.groups;

          if (!groups || !groups.length) {
            return (
              <span className="text-muted-foreground whitespace-nowrap">
                {t("adminCourseView.statistics.empty.noGroups")}
              </span>
            );
          }

          const visibleGroups = groups.slice(0, 1);
          const remainingCount = groups.length - visibleGroups.length;

          return (
            <div className="flex w-max gap-1 whitespace-nowrap">
              {visibleGroups.map((group) => (
                <Badge key={group.id} variant="secondary">
                  {group.name}
                </Badge>
              ))}
              {remainingCount > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="default" className="cursor-help">
                        +{remainingCount}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="p-2 rounded-lg">
                      <div className="flex flex-col gap-1 !px-0">
                        {groups.slice(1).map((group) => (
                          <Badge key={group.id} variant="secondary">
                            {group.name}
                          </Badge>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "completedLessonsCount",
        header: ({ column }) => (
          <SortButton<CourseStudentsProgressColumn> column={column}>
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
          <SortButton<CourseStudentsProgressColumn> column={column}>
            {t("adminCourseView.statistics.field.lastActivity")}
          </SortButton>
        ),
        cell: ({ row }) =>
          row.original.lastActivity
            ? format(new Date(row.original.lastActivity), "MMM dd, yyyy")
            : null,
      },
      {
        accessorKey: "lastCompletedLessonName",
        header: ({ column }) => (
          <SortButton<CourseStudentsProgressColumn> column={column}>
            {t("adminCourseView.statistics.field.lastCompletedLesson")}
          </SortButton>
        ),
        cell: ({ row }) => {
          const lastCompletedLessonName = row.original.lastCompletedLessonName;

          return lastCompletedLessonName ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <div className="max-w-xs truncate cursor-help">{lastCompletedLessonName}</div>
                </TooltipTrigger>
                <TooltipContent>{lastCompletedLessonName}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null;
        },
      },
    ],
    [t, lessonCount],
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

  const { totalItems, perPage, page } = courseStudentsProgress?.pagination || {};

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
  );
}
