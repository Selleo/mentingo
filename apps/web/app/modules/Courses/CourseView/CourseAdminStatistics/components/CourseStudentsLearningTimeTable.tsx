import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCourseLearningTimeStatistics } from "~/api/queries/admin/useCourseLearningTimeStatistics";
import { Pagination } from "~/components/Pagination/Pagination";
import SortButton from "~/components/TableSortButton/TableSortButton";
import { Badge } from "~/components/ui/badge";
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
import { formatLearningTime } from "~/modules/Courses/CourseView/CourseAdminStatistics/CourseAdminStatistics";
import { tanstackSortingToParam } from "~/utils/tanstackSortingToParam";

import type { ColumnDef, SortingState } from "@tanstack/react-table";
import type { GetCourseLearningTimeStatisticsResponse } from "~/api/generated-api";
import type { CourseLearningTimeFilterQuery } from "~/api/queries/admin/useCourseLearningTimeStatistics";
import type { ITEMS_PER_PAGE_OPTIONS } from "~/components/Pagination/Pagination";
import type { FilterValue } from "~/modules/common/SearchFilter/SearchFilter";

type CourseStudentsLearningTimeColumn =
  GetCourseLearningTimeStatisticsResponse["data"]["users"][number];

interface CourseStudentsProgressTableProps {
  courseId: string;
  searchParams: CourseLearningTimeFilterQuery;
  onFilterChange: (name: string, value: FilterValue) => void;
}

export function CourseStudentsLearningTimeTable({
  courseId,
  searchParams,
  onFilterChange,
}: CourseStudentsProgressTableProps) {
  const { t } = useTranslation();

  const { isAdminLike } = useUserRole();

  const [sorting, setSorting] = useState<SortingState>([]);

  const query = useMemo(() => {
    const sort = tanstackSortingToParam(sorting) as CourseLearningTimeFilterQuery["sort"];
    return { ...searchParams, sort };
  }, [searchParams, sorting]);

  const { data: courseLearningTime, isFetching } = useCourseLearningTimeStatistics({
    id: courseId,
    enabled: isAdminLike,
    query,
  });

  const tableData = useMemo(() => {
    return courseLearningTime?.data.users || [];
  }, [courseLearningTime]);

  const columns: ColumnDef<CourseStudentsLearningTimeColumn>[] = useMemo(
    () => [
      {
        accessorKey: "studentName",
        header: ({ column }) => (
          <SortButton<CourseStudentsLearningTimeColumn> column={column}>
            {t("adminCourseView.statistics.field.studentName")}
          </SortButton>
        ),
        cell: ({ row }) => (
          <div className="max-w-md truncate flex items-center gap-2">
            <UserAvatar
              className="size-7"
              userName={row.original.name}
              profilePictureUrl={row.original.studentAvatarUrl}
            />
            {row.original.name}
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
        accessorKey: "totalSeconds",
        header: ({ column }) => (
          <SortButton<CourseStudentsLearningTimeColumn> column={column}>
            {t("adminCourseView.statistics.field.totalTime")}
          </SortButton>
        ),
        cell: ({ row }) => (
          <div className="max-w-md truncate flex items-center gap-2">
            {formatLearningTime(row.original.totalSeconds)}
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
    getRowId: (row) => row.id,
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

  const { totalItems, perPage, page } = courseLearningTime?.pagination || {};

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
              data-course-id={row.original.id}
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
