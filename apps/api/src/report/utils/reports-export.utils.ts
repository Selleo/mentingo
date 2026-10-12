import { match, P } from "ts-pattern";

import { REPORT_EXPORT_LABELS } from "../constants/reports-export-labels.constants";
import { REPORT_EXPORT_EMPTY_VALUE } from "../constants/reports-exports.constants";
import { REPORT_CALENDAR_DATE_PATTERN } from "../constants/reports-filter.constants";
import {
  REPORT_CERTIFICATE_STATUS,
  REPORT_FILTER_FIELDS as FIELD,
  REPORT_FILTER_MATCH,
  REPORT_FILTER_OPERATORS as OPERATOR,
  REPORT_STATUS,
  REPORT_VIEWS,
} from "../constants/reports.constants";

import type { ReportExportLabels } from "../constants/reports-export-labels.constants";
import type {
  ReportExportColumn,
  ReportExportColumnKey,
  ReportExportConditions,
  ReportExportDetail,
  ReportExportDocument,
  ReportExportFormatter,
  ReportExportMetric,
  ReportExportRow,
  ReportExportScope,
  ReportResultRow,
} from "../reports-exports.types";
import type { ReportFilterCondition, ReportsQuery, ReportsResult } from "../schemas/reports.schema";

/** Turns a report result into the readable document both export formats render. */
export function buildReportExportDocument(
  result: ReportsResult,
  query: ReportsQuery,
  generatedAt: Date,
  scope: ReportExportScope,
): ReportExportDocument {
  const labels = REPORT_EXPORT_LABELS[query.language];
  const formatter = createExportFormatter(query.language, query.timezone);
  const viewLabel = getViewLabel(query.view, labels);
  return {
    language: query.language,
    labels,
    title: labels.title,
    subtitle: scope.subject ? `${viewLabel} · ${scope.subject}` : viewLabel,
    generatedAt: formatter.dateTime(generatedAt),
    performance: getPerformanceMetrics(result, labels),
    activity: getActivityMetrics(result, labels),
    filters: getFilters(scope, labels),
    conditions: describeConditions(query, scope, labels, formatter),
    columns: getColumns(query.view, labels),
    rows: result.rows.map((row) => toExportRow(row, labels, formatter)),
    recordCount: labels.recordCount.replace("{{count}}", String(result.rows.length)),
  };
}

function getFilters(scope: ReportExportScope, labels: ReportExportLabels): ReportExportDetail[] {
  return [
    {
      label: labels.groups,
      value: scope.groups.length ? scope.groups.join(", ") : labels.allGroups,
    },
    ...(scope.subject ? [{ label: labels.subject, value: scope.subject }] : []),
  ];
}

/** The six numbers a reader should see first. */
function getPerformanceMetrics(
  { metrics }: ReportsResult,
  labels: ReportExportLabels,
): ReportExportMetric[] {
  return [
    countMetric(labels.learners, metrics.learners),
    percentMetric(labels.rate, metrics.courseCompletionRate),
    percentMetric(labels.avgProgress, metrics.averageProgress),
    percentMetric(labels.avgScore, metrics.averageScore),
    countMetric(labels.certs, metrics.certificatesIssued),
    countMetric(labels.active, metrics.activeLearners30d),
  ];
}

/** Supporting volumes behind the performance overview. */
function getActivityMetrics(
  { metrics }: ReportsResult,
  labels: ReportExportLabels,
): ReportExportMetric[] {
  return [
    countMetric(labels.platformCourses, metrics.platformCourses),
    countMetric(labels.enrollments, metrics.courseEnrollments),
    countMetric(labels.completions, metrics.courseCompletions),
    countMetric(labels.activeCertificates, metrics.activeCertificates),
    countMetric(labels.paths, metrics.developmentPathsCompleted),
  ];
}

function countMetric(label: string, value: number): ReportExportMetric {
  return { label, value, unit: "count" };
}

function percentMetric(label: string, value: number | null): ReportExportMetric {
  return { label, value, unit: "percent" };
}

/** The same columns as the report table: the column naming the report subject is left out. */
function getColumns(view: ReportsQuery["view"], labels: ReportExportLabels): ReportExportColumn[] {
  const isHidden = (key: ReportExportColumnKey) =>
    match({ view, key })
      .with({ view: REPORT_VIEWS.LEARNER, key: P.union("learner", "email") }, () => true)
      .with({ view: REPORT_VIEWS.COURSE, key: "course" }, () => true)
      .with({ view: REPORT_VIEWS.DEVELOPMENT_PATHS, key: "path" }, () => true)
      .with({ key: "pathCourses" }, () => view !== REPORT_VIEWS.DEVELOPMENT_PATHS)
      .otherwise(() => false);
  const columnLabels: Record<ReportExportColumnKey, string> = {
    learner: labels.learner,
    email: labels.email,
    course: labels.course,
    path: labels.path,
    status: labels.status,
    progress: labels.progress,
    score: labels.score,
    attempts: labels.attempts,
    certificate: labels.certificate,
    certificateIssuedAt: labels.certificateIssuedAt,
    enrolledAt: labels.enrolled,
    completedAt: labels.completed,
    lastActivityAt: labels.lastActivity,
    pathCourses: labels.pathCourses,
  };

  return (Object.keys(columnLabels) as ReportExportColumnKey[])
    .filter((key) => !isHidden(key))
    .map((key) => ({ key, label: columnLabels[key] }));
}

function toExportRow(
  row: ReportResultRow,
  labels: ReportExportLabels,
  formatter: ReportExportFormatter,
): ReportExportRow {
  return {
    learnerName: row.learner.name,
    learnerEmail: row.learner.email,
    course: row.course?.title ?? null,
    path: row.path?.title ?? null,
    status: row.status,
    statusLabel: getStatusLabel(row.status, labels),
    progress: row.progress,
    score: row.score,
    attempts: row.attempts,
    certificateStatus: row.certificate.status,
    certificateLabel: getCertificateLabel(row.certificate.status, labels),
    certificateIssuedAt: formatter.calendarDay(row.certificate.issuedAt),
    enrolledAt: formatter.calendarDay(row.enrolledAt),
    completedAt: formatter.calendarDay(row.completedAt),
    lastActivityAt: formatter.calendarDay(row.lastActivityAt),
    pathCourses: row.pathCourses.map(
      (course) =>
        `${course.courseTitle}: ${getStatusLabel(course.status, labels)} (${formatPercent(
          course.progress,
        )})`,
    ),
  };
}

/** The applied filter as readable sentences, e.g. "Completion status is Completed". */
function describeConditions(
  query: ReportsQuery,
  scope: ReportExportScope,
  labels: ReportExportLabels,
  formatter: ReportExportFormatter,
): ReportExportConditions {
  const rules = query.filter?.rules ?? [];
  if (!rules.length) return { heading: labels.conditions, lines: [labels.noConditions] };

  const describe = (condition: ReportFilterCondition) =>
    describeCondition(condition, scope, labels, formatter);
  const ruleLines = rules.map((rule) =>
    "field" in rule
      ? describe(rule)
      : `${getGroupMatchLabel(rule.match, labels)}: ${rule.rules.map(describe).join("; ")}`,
  );
  const heading = match({ count: rules.length, filterMatch: query.filter?.match })
    .with({ count: 1 }, () => labels.conditions)
    .with({ filterMatch: REPORT_FILTER_MATCH.ANY }, () => labels.conditionsAny)
    .otherwise(() => labels.conditionsAll);

  return { heading, lines: ruleLines };
}

function describeCondition(
  condition: ReportFilterCondition,
  scope: ReportExportScope,
  labels: ReportExportLabels,
  formatter: ReportExportFormatter,
): string {
  const field = getFieldLabel(condition.field, labels);
  const operator = getOperatorLabel(condition.operator, labels);
  const values = Array.isArray(condition.value) ? condition.value : [condition.value];
  const describeValue = (value: string | number | undefined) =>
    describeConditionValue(condition.field, value, scope, labels, formatter);

  return match(condition.operator)
    .with(P.union(OPERATOR.IS_EMPTY, OPERATOR.IS_NOT_EMPTY), () => `${field} ${operator}`)
    .with(
      OPERATOR.BETWEEN,
      () =>
        `${field} ${operator} ${describeValue(values[0])} ${labels.rangeAnd} ${describeValue(
          values[1],
        )}`,
    )
    .otherwise(() => `${field} ${operator} ${values.map(describeValue).join(", ")}`);
}

function describeConditionValue(
  field: ReportFilterCondition["field"],
  value: string | number | undefined,
  scope: ReportExportScope,
  labels: ReportExportLabels,
  formatter: ReportExportFormatter,
): string {
  if (value === undefined) return REPORT_EXPORT_EMPTY_VALUE;
  const text = String(value);

  return match(field)
    .with(FIELD.STATUS, () => getStatusLabel(text as ReportResultRow["status"], labels))
    .with(FIELD.CERTIFICATE, () =>
      getCertificateLabel(text as ReportResultRow["certificate"]["status"], labels),
    )
    .with(P.union(FIELD.PROGRESS, FIELD.SCORE), () => formatPercent(Number(value)))
    .with(P.union(FIELD.ENROLLED_AT, FIELD.COMPLETED_AT, FIELD.LAST_ACTIVITY), () =>
      formatter.conditionDate(text),
    )
    .with(
      P.union(FIELD.GROUP_ID, FIELD.COURSE_ID, FIELD.PATH_ID, FIELD.LEARNER),
      () => scope.recordLabels[text] ?? text,
    )
    .otherwise(() => text);
}

function getViewLabel(view: ReportsQuery["view"], labels: ReportExportLabels): string {
  return match(view)
    .with(REPORT_VIEWS.ORGANISATION, () => labels.viewOrganisation)
    .with(REPORT_VIEWS.DEVELOPMENT_PATHS, () => labels.viewDevelopmentPaths)
    .with(REPORT_VIEWS.COURSE, () => labels.viewCourse)
    .with(REPORT_VIEWS.LEARNER, () => labels.viewLearner)
    .exhaustive();
}

function getFieldLabel(field: ReportFilterCondition["field"], labels: ReportExportLabels): string {
  return match(field)
    .with(FIELD.GROUP_ID, () => labels.fieldGroupId)
    .with(FIELD.LEARNER, () => labels.fieldLearner)
    .with(FIELD.COURSE_ID, () => labels.course)
    .with(FIELD.PATH_ID, () => labels.path)
    .with(FIELD.STATUS, () => labels.fieldStatus)
    .with(FIELD.PROGRESS, () => labels.fieldProgress)
    .with(FIELD.ENROLLED_AT, () => labels.fieldEnrolledAt)
    .with(FIELD.COMPLETED_AT, () => labels.fieldCompletedAt)
    .with(FIELD.SCORE, () => labels.score)
    .with(FIELD.ATTEMPTS, () => labels.attempts)
    .with(FIELD.CERTIFICATE, () => labels.certificate)
    .with(FIELD.LAST_ACTIVITY, () => labels.lastActivity)
    .exhaustive();
}

function getOperatorLabel(
  operator: ReportFilterCondition["operator"],
  labels: ReportExportLabels,
): string {
  return match(operator)
    .with(OPERATOR.EQ, () => labels.opEq)
    .with(OPERATOR.NEQ, () => labels.opNeq)
    .with(OPERATOR.IN, () => labels.opIn)
    .with(OPERATOR.CONTAINS, () => labels.opContains)
    .with(OPERATOR.GTE, () => labels.opGte)
    .with(OPERATOR.LTE, () => labels.opLte)
    .with(OPERATOR.BETWEEN, () => labels.opBetween)
    .with(OPERATOR.IS_EMPTY, () => labels.opIsEmpty)
    .with(OPERATOR.IS_NOT_EMPTY, () => labels.opIsNotEmpty)
    .exhaustive();
}

function getGroupMatchLabel(groupMatch: string, labels: ReportExportLabels): string {
  const label = groupMatch === REPORT_FILTER_MATCH.ANY ? labels.groupAny : labels.groupAll;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getStatusLabel(status: ReportResultRow["status"], labels: ReportExportLabels): string {
  return match(status)
    .with(REPORT_STATUS.NOT_STARTED, () => labels.notStarted)
    .with(REPORT_STATUS.IN_PROGRESS, () => labels.inProgress)
    .otherwise(() => labels.complete);
}

function getCertificateLabel(
  status: ReportResultRow["certificate"]["status"],
  labels: ReportExportLabels,
): string {
  return match(status)
    .with(REPORT_CERTIFICATE_STATUS.ACTIVE, () => labels.certificateActive)
    .with(REPORT_CERTIFICATE_STATUS.EXPIRED, () => labels.certificateExpired)
    .with(REPORT_CERTIFICATE_STATUS.REVOKED, () => labels.certificateRevoked)
    .otherwise(() => labels.noCertificate);
}

export function formatPercent(value: number | null): string {
  return value === null || Number.isNaN(value)
    ? REPORT_EXPORT_EMPTY_VALUE
    : `${Math.round(value)}%`;
}

/** Date formatting in the report's language and timezone. */
function createExportFormatter(language: string, timezone: string): ReportExportFormatter {
  const dateTimeFormat = new Intl.DateTimeFormat(language, {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: timezone,
  });
  const dayFormat = new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone: "UTC" });
  const dayParts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  });

  return {
    dateTime: (value) => dateTimeFormat.format(value),
    calendarDay: (value) =>
      value ? new Date(`${dayParts.format(new Date(value))}T00:00:00.000Z`) : null,
    conditionDate: (value) =>
      REPORT_CALENDAR_DATE_PATTERN.test(value)
        ? dayFormat.format(new Date(`${value}T00:00:00.000Z`))
        : dateTimeFormat.format(new Date(value)),
  };
}

/** Formats a calendar day produced by the export document for display. */
export function formatExportDay(value: Date | null, language: string): string {
  if (!value) return REPORT_EXPORT_EMPTY_VALUE;
  return new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone: "UTC" }).format(value);
}
