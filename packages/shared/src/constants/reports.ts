export const REPORT_SORT_FIELDS = {
  LEARNER: "learner",
  COURSE: "course",
  PATH: "path",
  STATUS: "status",
  PROGRESS: "progress",
  SCORE: "score",
  ATTEMPTS: "attempts",
  LAST_ACTIVITY: "lastActivity",
} as const;

export type ReportSortField = (typeof REPORT_SORT_FIELDS)[keyof typeof REPORT_SORT_FIELDS];

export const REPORT_SORT_DIRECTIONS = {
  ASC: "asc",
  DESC: "desc",
} as const;

export type ReportSortDirection =
  (typeof REPORT_SORT_DIRECTIONS)[keyof typeof REPORT_SORT_DIRECTIONS];

export const DEFAULT_REPORT_SORT = {
  sortBy: REPORT_SORT_FIELDS.LAST_ACTIVITY,
  sortDirection: REPORT_SORT_DIRECTIONS.DESC,
} as const;
