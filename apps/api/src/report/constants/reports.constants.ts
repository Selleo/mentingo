import { REPORT_ERRORS } from "./reports.errors";

export const REPORT_VIEWS = {
  ORGANISATION: "organisation",
  DEVELOPMENT_PATHS: "developmentPaths",
  COURSE: "course",
  LEARNER: "learner",
} as const;

export const REPORT_FILTER_FIELDS = {
  GROUP_ID: "groupId",
  LEARNER: "learner",
  COURSE_ID: "courseId",
  PATH_ID: "pathId",
  STATUS: "status",
  PROGRESS: "progress",
  ENROLLED_AT: "enrolledAt",
  COMPLETED_AT: "completedAt",
  SCORE: "score",
  ATTEMPTS: "attempts",
  CERTIFICATE: "certificate",
  LAST_ACTIVITY: "lastActivity",
} as const;

export const REPORT_FILTER_OPERATORS = {
  EQ: "eq",
  NEQ: "neq",
  IN: "in",
  CONTAINS: "contains",
  GTE: "gte",
  LTE: "lte",
  BETWEEN: "between",
  IS_EMPTY: "isEmpty",
  IS_NOT_EMPTY: "isNotEmpty",
} as const;

export const REPORT_FILTER_MATCH = {
  ALL: "all",
  ANY: "any",
} as const;

export const REPORT_CONFIGURATION_VISIBILITY = {
  PERSONAL: "personal",
  SHARED: "shared",
} as const;

export const REPORT_EXPORT_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export const REPORT_EXPORT_FORMAT = {
  XLSX: "xlsx",
  PDF: "pdf",
} as const;

export const REPORT_EXPORT_ACTION = {
  GENERATE: "generate",
  EXPIRE: "expire",
} as const;

export const REPORT_SCOPE = {
  ORGANISATION: "organisation",
  MANAGED_GROUPS: "managedGroups",
  OWN_COURSES: "ownCourses",
} as const;

export const REPORT_STATUS = {
  NOT_STARTED: "notStarted",
  IN_PROGRESS: "inProgress",
  COMPLETED: "completed",
} as const;

export const REPORT_CERTIFICATE_STATUS = {
  ACTIVE: "active",
  EXPIRED: "expired",
  REVOKED: "revoked",
  NOT_EARNED: "notEarned",
} as const;

export const REPORT_FAILURE_CODE = {
  INACCESSIBLE_REFERENCE: REPORT_ERRORS.SCOPE_DENIED,
  QUEUE_UNAVAILABLE: REPORT_ERRORS.EXPORT_QUEUE_UNAVAILABLE,
  EXPORT_FAILED: REPORT_ERRORS.EXPORT_GENERATION_FAILED,
} as const;

export const REPORT_LIMITS = { CONDITIONS: 30, SELECTOR_OPTIONS: 100, PAGE_SIZE: 100 } as const;

export type ReportConfigurationVisibility =
  (typeof REPORT_CONFIGURATION_VISIBILITY)[keyof typeof REPORT_CONFIGURATION_VISIBILITY];
export type ReportFilterMatch = (typeof REPORT_FILTER_MATCH)[keyof typeof REPORT_FILTER_MATCH];
export type ReportExportStatus = (typeof REPORT_EXPORT_STATUS)[keyof typeof REPORT_EXPORT_STATUS];
export type ReportExportFormat = (typeof REPORT_EXPORT_FORMAT)[keyof typeof REPORT_EXPORT_FORMAT];
export type ReportExportAction = (typeof REPORT_EXPORT_ACTION)[keyof typeof REPORT_EXPORT_ACTION];
export type ReportScope = (typeof REPORT_SCOPE)[keyof typeof REPORT_SCOPE];
export type ReportStatus = (typeof REPORT_STATUS)[keyof typeof REPORT_STATUS];
export type ReportCertificateStatus =
  (typeof REPORT_CERTIFICATE_STATUS)[keyof typeof REPORT_CERTIFICATE_STATUS];
