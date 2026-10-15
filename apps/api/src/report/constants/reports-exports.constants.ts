import type { ReportExportColumnKey, ReportExportMetricKey } from "../reports-exports.types";

export const REPORT_EXPORT_RETENTION_MS = 24 * 60 * 60 * 1000;
export const REPORT_EXPORT_PROCESSING_LEASE_MS = 2 * 60 * 1000;
export const REPORT_EXPORT_PROCESSING_HEARTBEAT_MS = 30 * 1000;
export const REPORT_EXPORT_CLEANUP_BATCH_SIZE = 100;
export const REPORT_EXPORT_CLAIM_RETRY_DELAY_MS = 5000;
export const REPORT_EXPORT_CONTENT_TYPES = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
} as const;

/**
 * How records sheet columns are sized, in characters: wide enough for the longest value,
 * capped at `max`, but never narrower than the column's label so headers do not wrap.
 */
export const REPORT_EXPORT_RECORDS_COLUMN_FIT = {
  min: 8,
  max: 45,
  /** Covers the one-character indent on each side of a cell plus some breathing room. */
  padding: 4,
  /** Header labels are bold, so they need a little more room than plain text. */
  headerScale: 1.15,
} as const;

export const REPORT_EXPORT_RIGHT_ALIGNED_COLUMNS = new Set<ReportExportColumnKey>([
  "progress",
  "score",
  "attempts",
  "certificateIssuedAt",
  "enrolledAt",
  "completedAt",
  "lastActivityAt",
]);

/** Characters a date takes in the records sheet ("20 Aug 2026"). */
export const REPORT_EXPORT_DATE_DISPLAY_LENGTH = 11;

export const REPORT_EXPORT_PERFORMANCE_METRICS: ReportExportMetricKey[] = [
  "learners",
  "courseCompletionRate",
  "averageProgress",
  "averageScore",
  "certificatesIssued",
  "activeLearners30d",
];

export const REPORT_EXPORT_ACTIVITY_METRICS: ReportExportMetricKey[] = [
  "platformCourses",
  "courseEnrollments",
  "courseCompletions",
  "activeCertificates",
  "developmentPathsCompleted",
];

export const REPORT_EXPORT_EMPTY_VALUE = "-";

export const REPORT_EXPORT_LIST_MARKER = "-";

export const REPORT_EXPORT_COLORS = {
  primary: "#3F58B6",
  primaryDark: "#384995",
  primaryLight: "#F2F5FC",
  border: "#E5E5E5",
  muted: "#64748B",
  text: "#363636",
  card: "#F3F5F9",
  rowStripe: "#F7F9FC",
  white: "#FFFFFF",
  success: "#116B51",
  warning: "#88510B",
} as const;

export const REPORT_EXPORT_XLSX_FORMATS = {
  percent: "0%",
  count: "#,##0",
  date: "d mmm yyyy",
} as const;

/**
 * The summary sheet grid, in characters: narrow gutters around three card columns,
 * each card spanning a wide label column and a narrower value column.
 */
export const REPORT_EXPORT_SUMMARY_COLUMN_WIDTHS = [2, 24, 12, 2, 24, 12, 2, 24, 12, 2] as const;

/** Summary sheet columns where each of the three cards in a row starts. */
export const REPORT_EXPORT_SUMMARY_CARD_COLUMNS = [1, 4, 7] as const;

/** Height of the summary's first row, left empty because the workbook freezes every sheet's first row. */
export const REPORT_EXPORT_SUMMARY_SPACER_HEIGHT = 8;

/** Summary sheet cells that a full-width row spans: everything between the outer gutters. */
export const REPORT_EXPORT_SUMMARY_CONTENT_SPAN = 8;

/** Summary sheet columns between an activity label and its value, ruled to join them visually. */
export const REPORT_EXPORT_SUMMARY_RULE_COLUMNS = [2, 3, 4, 5, 6, 7] as const;

export const REPORT_EXPORT_STRONG_RESULT_PERCENT = 80;
