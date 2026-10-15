import { match } from "ts-pattern";

import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";

import { formatReportDate, formatReportPercent } from "../reports.utils";

import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import type { RunReportResponse } from "~/api/generated-api";
import type { ReportView } from "~/modules/Reports/reports.types";

export type ReportRow = RunReportResponse["data"]["rows"][number];
type PathCourse = ReportRow["pathCourses"][number];

const statusVariant = (status: string) =>
  match(status)
    .with("completed", () => "successFilled" as const)
    .with("inProgress", () => "inProgress" as const)
    .otherwise(() => "notStarted" as const);

const getPathCourseColumns = (rows: ReportRow[]) =>
  Array.from(
    new Map(
      rows.flatMap((row) => row.pathCourses).map((course) => [course.courseId, course]),
    ).values(),
  );

const getPathCourseColumn = (t: TFunction, course: PathCourse): ColumnDef<ReportRow> => ({
  id: `pathCourse-${course.courseId}`,
  header: () => (
    <div className="max-w-48">
      <span className="block truncate">{course.courseTitle}</span>
      <span className="details block font-normal text-neutral-500">
        {t("reports.table.pathCourseStatus")}
      </span>
    </div>
  ),
  cell: ({ row }) => {
    const courseState = row.original.pathCourses.find(
      ({ courseId }) => courseId === course.courseId,
    );
    if (!courseState) return <span className="text-neutral-500">—</span>;
    return (
      <span className="whitespace-nowrap">
        {t(`reports.values.${courseState.status}`)} · {formatReportPercent(courseState.progress)}
      </span>
    );
  },
});

export const getReportResultColumns = (
  t: TFunction,
  view: ReportView,
  rows: ReportRow[],
  language: string,
  timezone: string,
): ColumnDef<ReportRow>[] => {
  const columns: ColumnDef<ReportRow>[] = [];

  if (view !== "learner") {
    columns.push({
      id: "learner",
      header: t("reports.table.learner"),
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="body-sm-md truncate text-neutral-950">{row.original.learner.name}</p>
          <p className="details truncate text-neutral-500">{row.original.learner.email}</p>
        </div>
      ),
    });
  }
  if (view !== "course") {
    columns.push({
      id: "course",
      header: t("reports.table.course"),
      cell: ({ row }) => row.original.course?.title ?? "—",
    });
  }
  if (view !== "developmentPaths") {
    columns.push({
      id: "path",
      header: t("reports.table.path"),
      cell: ({ row }) => row.original.path?.title ?? "—",
    });
  }

  columns.push(
    {
      id: "status",
      header: t("reports.table.status"),
      cell: ({ row }) => (
        <Badge variant={statusVariant(row.original.status)} className="w-max">
          {t(`reports.values.${row.original.status}`)}
        </Badge>
      ),
    },
    {
      id: "progress",
      header: t("reports.table.progress"),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Progress
            value={row.original.progress ?? 0}
            aria-hidden
            className="h-1.5 w-20 bg-neutral-200"
            indicatorClassName="bg-primary-600"
          />
          <span className="tabular-nums">{formatReportPercent(row.original.progress)}</span>
        </div>
      ),
    },
    {
      id: "score",
      header: t("reports.table.averageQuizScore"),
      cell: ({ row }) => (
        <span className="tabular-nums">{formatReportPercent(row.original.score)}</span>
      ),
    },
    {
      id: "attempts",
      header: t("reports.table.attempts"),
      cell: ({ row }) => <span className="tabular-nums">{row.original.attempts}</span>,
    },
    {
      id: "lastActivity",
      header: t("reports.table.lastActivity"),
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {formatReportDate(row.original.lastActivityAt, language, timezone)}
        </span>
      ),
    },
  );

  if (view === "developmentPaths") {
    columns.push(...getPathCourseColumns(rows).map((course) => getPathCourseColumn(t, course)));
  }

  return columns;
};
