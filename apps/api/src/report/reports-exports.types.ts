import type { ReportExportLabels } from "./constants/reports-export-labels.constants";
import type {
  ReportCertificateStatus,
  ReportExportFormat as ExportFormat,
  ReportExportStatus as ExportStatus,
  ReportStatus,
} from "./constants/reports.constants";
import type { ReportExportRecord } from "./repositories/reports-exports.repository";
import type { ReportsResult } from "./schemas/reports.schema";
import type { Readable } from "node:stream";

export type ReportExportFormat = ExportFormat;
export type ReportExportStatus = ExportStatus;

/** Human-readable names for everything a report query refers to by id. */
export interface ReportExportScope {
  groups: string[];
  subject: string | null;
  recordLabels: Record<string, string>;
}

export interface ReportExportDownload {
  stream: Readable;
  fileName: string;
  contentType: string;
}

export interface ReportExportClaim {
  record: ReportExportRecord;
  token: string;
}

export type ReportExportColumnKey =
  | "learner"
  | "email"
  | "course"
  | "path"
  | "status"
  | "progress"
  | "score"
  | "attempts"
  | "certificate"
  | "certificateIssuedAt"
  | "enrolledAt"
  | "completedAt"
  | "lastActivityAt"
  | "pathCourses";

export interface ReportExportColumn {
  key: ReportExportColumnKey;
  label: string;
}

/** One learning record, with values ready to display. Dates are calendar days in the report timezone. */
export interface ReportExportRow {
  learnerName: string;
  learnerEmail: string;
  course: string | null;
  path: string | null;
  status: ReportStatus;
  statusLabel: string;
  progress: number | null;
  score: number | null;
  attempts: number;
  certificateStatus: ReportCertificateStatus;
  certificateLabel: string;
  certificateIssuedAt: Date | null;
  enrolledAt: Date | null;
  completedAt: Date | null;
  lastActivityAt: Date | null;
  pathCourses: string[];
}

export interface ReportExportDetail {
  label: string;
  value: string;
}

export type ReportExportMetricKey = keyof ReportsResult["metrics"];

export interface ReportExportMetric {
  label: string;
  value: number | null;
  unit: "count" | "percent";
}

export interface ReportExportConditions {
  heading: string;
  lines: string[];
}

export interface ReportExportDocument {
  language: string;
  labels: ReportExportLabels;
  title: string;
  generatedAt: string;
  metrics: Record<ReportExportMetricKey, ReportExportMetric>;
  filters: ReportExportDetail[];
  conditions: ReportExportConditions;
  columns: ReportExportColumn[];
  rows: ReportExportRow[];
  recordCount: string;
}

export type ReportResultRow = ReportsResult["rows"][number];

export interface ReportExportFormatter {
  dateTime: (value: Date) => string;
  /** The calendar day in the report timezone, as a UTC-midnight date that spreadsheets show as-is. */
  calendarDay: (value: string | null) => Date | null;
  conditionDate: (value: string) => string;
}
