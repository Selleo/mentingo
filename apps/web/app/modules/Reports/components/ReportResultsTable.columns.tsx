import { match } from "ts-pattern";

import { Badge } from "~/components/ui/badge";

import { formatReportDate, formatReportPercent } from "../utils/reports.utils";

import {
  ReportNumberCell,
  ReportPercentCell,
  ReportProgressCell,
  reportSortableHeader,
  ReportTextCell,
} from "./ReportTableCells";

import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import type { RunReportResponse } from "~/api/generated-api";
import type { ReportView } from "~/modules/Reports/types/reports.types";

export type ReportRow = RunReportResponse["data"]["rows"][number];
type PathCourse = ReportRow["pathCourses"][number];

const sortableHeader = (label: string) => reportSortableHeader<ReportRow>(label);

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
  enableSorting: false,
  header: () => (
    <span
      className="block max-w-48 truncate"
      title={`${course.courseTitle} · ${t("reports.table.pathCourseStatus")}`}
    >
      {course.courseTitle}
    </span>
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

type ReportResultColumnsOptions = {
  view: ReportView;
  rows: ReportRow[];
  language: string;
  timezone: string;
  hasSubject: boolean;
  groupLabels: Map<string, string>;
};

const getGroupColumn = (t: TFunction, groupLabels: Map<string, string>): ColumnDef<ReportRow> => ({
  id: "groups",
  header: t("reports.table.group"),
  cell: ({ row }) => {
    const labels = row.original.groupIds.flatMap((groupId) => groupLabels.get(groupId) ?? []);
    return (
      <span title={labels.join(", ")}>
        <ReportTextCell>{labels.join(", ") || "—"}</ReportTextCell>
      </span>
    );
  },
});

export const getReportResultColumns = (
  t: TFunction,
  { view, rows, language, timezone, hasSubject, groupLabels }: ReportResultColumnsOptions,
): ColumnDef<ReportRow>[] => {
  const columns: ColumnDef<ReportRow>[] = [];
  const isSingleLearner = view === "learner" && hasSubject;

  if (!isSingleLearner) {
    columns.push({
      id: "learner",
      header: sortableHeader(t("reports.table.learner")),
      cell: ({ row }) => <ReportTextCell>{row.original.learner.name}</ReportTextCell>,
    });
  }
  if (view === "learner" && !hasSubject) columns.push(getGroupColumn(t, groupLabels));
  if (view !== "course") {
    columns.push({
      id: "course",
      header: sortableHeader(t("reports.table.course")),
      cell: ({ row }) => <ReportTextCell>{row.original.course?.title ?? "—"}</ReportTextCell>,
    });
  }
  if (view !== "developmentPaths") {
    columns.push({
      id: "path",
      header: sortableHeader(t("reports.table.path")),
      cell: ({ row }) => <ReportTextCell>{row.original.path?.title ?? "—"}</ReportTextCell>,
    });
  }

  columns.push(
    {
      id: "status",
      header: sortableHeader(t("reports.table.status")),
      cell: ({ row }) => (
        <Badge variant={statusVariant(row.original.status)} className="w-max">
          {t(`reports.values.${row.original.status}`)}
        </Badge>
      ),
    },
    {
      id: "progress",
      header: sortableHeader(t("reports.table.progress")),
      cell: ({ row }) => <ReportProgressCell value={row.original.progress} />,
    },
    {
      id: "score",
      header: sortableHeader(t("reports.table.averageQuizScore")),
      cell: ({ row }) => <ReportPercentCell value={row.original.score} />,
    },
    {
      id: "attempts",
      header: sortableHeader(t("reports.table.attempts")),
      cell: ({ row }) => <ReportNumberCell>{row.original.attempts}</ReportNumberCell>,
    },
    {
      id: "lastActivity",
      header: sortableHeader(t("reports.table.lastActivity")),
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
