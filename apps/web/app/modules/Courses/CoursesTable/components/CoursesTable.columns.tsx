import { COURSE_ORIGIN_TYPES, COURSE_TYPE } from "@repo/shared";
import { format } from "date-fns";
import { BookOpen } from "lucide-react";

import SortButton from "~/components/TableSortButton/TableSortButton";
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import { formatHtmlString } from "~/lib/formatters/formatHtmlString";
import { CourseBulkActions } from "~/modules/Admin/Courses/components/CourseBulkActions";
import {
  getCourseBadgeIcon,
  getCourseBadgeIconClasses,
  getCourseBadgeVariant,
  getCourseStatus,
} from "~/modules/Admin/Courses/utils";
import { formatDuration } from "~/modules/Courses/utils/formatDuration";
import { handleRowSelectionRange } from "~/utils/tableRangeSelection";

import { COURSES_PAGE_HANDLES } from "../../../../../e2e/data/courses/handles";

import type { CourseType } from "@repo/shared";
import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import type { GetAllCategoriesResponse, GetAllCoursesResponse } from "~/api/generated-api";
import type { CourseStatus } from "~/api/queries/useCourses";

export type CoursesTableCourse = GetAllCoursesResponse["data"][number] & {
  courseType?: CourseType;
};

type CoursesTableColumnsOptions = {
  t: TFunction;
  canManageCourses: boolean;
  categories: GetAllCategoriesResponse["data"];
  lastSelectedRowIndex: number;
  setLastSelectedRowIndex: (index: number) => void;
  onDuplicateCourse: (courseId: string) => void;
};

const COURSES_WITH_ORIGIN_BADGE: CoursesTableCourse["originType"][] = [
  COURSE_ORIGIN_TYPES.MASTER,
  COURSE_ORIGIN_TYPES.EXPORTED,
];

const buildTitleColumn = (t: TFunction): ColumnDef<CoursesTableCourse> => ({
  accessorKey: "title",
  header: ({ column }) => (
    <SortButton<CoursesTableCourse> column={column}>{t("adminCoursesView.field.title")}</SortButton>
  ),
  cell: ({ row }) => (
    <div className="flex min-w-0 max-w-md items-center gap-3">
      {row.original.thumbnailUrl ? (
        <img
          src={row.original.thumbnailUrl}
          alt=""
          loading="lazy"
          className="aspect-video h-8 shrink-0 rounded object-cover"
        />
      ) : (
        <span className="flex aspect-video h-8 shrink-0 items-center justify-center rounded bg-primary-50 text-primary-700">
          <BookOpen className="size-4" aria-hidden />
        </span>
      )}
      <span className="truncate font-medium text-neutral-950">
        {formatHtmlString(row.original.title)}
      </span>
    </div>
  ),
});

const buildSortableTextColumn = (
  t: TFunction,
  accessorKey: "author" | "category",
): ColumnDef<CoursesTableCourse> => ({
  accessorKey,
  header: ({ column }) => (
    <SortButton<CoursesTableCourse> column={column}>
      {t(`adminCoursesView.field.${accessorKey}`)}
    </SortButton>
  ),
  cell: ({ row }) => <span className="text-neutral-800">{row.original[accessorKey]}</span>,
});

const buildCourseTypeColumn = (t: TFunction): ColumnDef<CoursesTableCourse> => ({
  accessorKey: "courseType",
  header: t("adminCoursesView.field.type"),
  cell: ({ row }) => {
    const courseType = row.original.courseType ?? COURSE_TYPE.DEFAULT;

    if (courseType !== COURSE_TYPE.SCORM) {
      return (
        <span
          className="text-neutral-500"
          data-testid={COURSES_PAGE_HANDLES.rowTypeBadge(row.original.id)}
        >
          -
        </span>
      );
    }

    return (
      <Badge
        data-testid={COURSES_PAGE_HANDLES.rowTypeBadge(row.original.id)}
        variant="success"
        className="w-max"
      >
        {t("adminCoursesView.field.scorm")}
      </Badge>
    );
  },
});

const buildDurationColumn = (t: TFunction): ColumnDef<CoursesTableCourse> => ({
  accessorKey: "estimatedDurationMinutes",
  header: t("adminCoursesView.field.duration"),
  enableSorting: false,
  cell: ({ row }) => {
    const durationMinutes = row.original.estimatedDurationMinutes;

    return (
      <span className="whitespace-nowrap text-neutral-800">
        {durationMinutes ? formatDuration(durationMinutes * 60, t) : "-"}
      </span>
    );
  },
});

const buildManagementColumns = ({
  t,
  categories,
  lastSelectedRowIndex,
  setLastSelectedRowIndex,
  onDuplicateCourse,
}: CoursesTableColumnsOptions) => {
  const selectColumn: ColumnDef<CoursesTableCourse> = {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
        aria-label="Select all"
      />
    ),
    cell: ({ row, table }) => (
      <Checkbox
        checked={row.getIsSelected()}
        aria-label="Select row"
        data-testid={COURSES_PAGE_HANDLES.rowCheckbox(row.original.id)}
        onClick={(event) => {
          event.stopPropagation();
          handleRowSelectionRange({
            table,
            event,
            id: row.id,
            value: row.getIsSelected(),
            lastSelectedRowIndex,
            setLastSelectedRowIndex,
          });
        }}
      />
    ),
    enableSorting: false,
  };

  const statusColumn: ColumnDef<CoursesTableCourse> = {
    accessorKey: "status",
    header: t("adminCoursesView.field.state"),
    cell: ({ row }) => {
      if (row.original.isArchived) {
        return (
          <Badge
            variant="secondaryWithOutline"
            icon="Archive"
            iconClasses="size-4"
            className="w-max"
          >
            {t("common.other.archived")}
          </Badge>
        );
      }

      const status = row.original.status as CourseStatus;

      return (
        <Badge
          variant={getCourseBadgeVariant(status)}
          icon={getCourseBadgeIcon(status)}
          iconClasses={getCourseBadgeIconClasses(status)}
          className="w-max"
        >
          {getCourseStatus(status, t)}
        </Badge>
      );
    },
  };

  const sharedCourseColumn: ColumnDef<CoursesTableCourse> = {
    accessorKey: "originType",
    header: t("adminCoursesView.field.sharedCourse"),
    cell: ({ row }) =>
      COURSES_WITH_ORIGIN_BADGE.includes(row.original.originType) && (
        <Badge variant="secondaryWithOutline" className="w-max">
          {t("adminCourseView.sharedCourse.badgeExported")}
        </Badge>
      ),
  };

  const createdAtColumn: ColumnDef<CoursesTableCourse> = {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <SortButton<CoursesTableCourse> column={column}>
        {t("adminCoursesView.field.createdAt")}
      </SortButton>
    ),
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-neutral-800">
        {row.original.createdAt && format(new Date(row.original.createdAt), "PP")}
      </span>
    ),
  };

  const actionsColumn: ColumnDef<CoursesTableCourse> = {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <CourseBulkActions
        selectedCourseIds={[row.original.id]}
        selectedArchivedStates={[row.original.isArchived ?? false]}
        categories={categories}
        onBulkActionComplete={() => undefined}
        onDuplicateCourse={onDuplicateCourse}
        rowAction
        triggerTestId={COURSES_PAGE_HANDLES.rowActionsTrigger(row.original.id)}
      />
    ),
    enableSorting: false,
  };

  return [
    selectColumn,
    buildTitleColumn(t),
    buildSortableTextColumn(t, "author"),
    buildSortableTextColumn(t, "category"),
    buildCourseTypeColumn(t),
    buildDurationColumn(t),
    statusColumn,
    sharedCourseColumn,
    createdAtColumn,
    actionsColumn,
  ];
};

/** Managers get selection, status and row actions; learners get a read-only course list. */
export const getCoursesTableColumns = (
  options: CoursesTableColumnsOptions,
): ColumnDef<CoursesTableCourse>[] => {
  if (options.canManageCourses) return buildManagementColumns(options);

  const { t } = options;

  return [
    buildTitleColumn(t),
    buildSortableTextColumn(t, "category"),
    buildSortableTextColumn(t, "author"),
    buildCourseTypeColumn(t),
    buildDurationColumn(t),
  ];
};
