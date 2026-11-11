import { REPORT_SORT_FIELDS } from "@repo/shared";

export const REPORT_SORT_COLUMN_SCENARIOS = [
  { sortBy: REPORT_SORT_FIELDS.LEARNER, sortColumn: "learner_name" },
  { sortBy: REPORT_SORT_FIELDS.COURSE, sortColumn: "course_title" },
  { sortBy: REPORT_SORT_FIELDS.PATH, sortColumn: "path_title" },
  {
    sortBy: REPORT_SORT_FIELDS.STATUS,
    sortColumn: "CASE status WHEN ? THEN 0 WHEN ? THEN 1 WHEN ? THEN 2 END",
  },
  { sortBy: REPORT_SORT_FIELDS.PROGRESS, sortColumn: "progress" },
  { sortBy: REPORT_SORT_FIELDS.SCORE, sortColumn: "score" },
  { sortBy: REPORT_SORT_FIELDS.ATTEMPTS, sortColumn: "attempts" },
  { sortBy: REPORT_SORT_FIELDS.LAST_ACTIVITY, sortColumn: "last_activity_at" },
] as const;

export const REPORT_ROW_TIE_BREAKERS =
  "learner_id ASC, course_id ASC NULLS LAST, path_id ASC NULLS LAST";
