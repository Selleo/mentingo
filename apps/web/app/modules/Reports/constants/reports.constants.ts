import { BookOpen, Building2, Route, UserRound } from "lucide-react";

import type {
  ReportConfiguration,
  ReportFilterField,
  ReportFilterOperator,
  ReportFilterTree,
  ReportView,
} from "../types/reports.types";
import type { LucideIcon } from "lucide-react";

export const DEFAULT_REPORT_PAGE_SIZE = 10;
export const REPORT_EXPORT_PAGE_SIZE = 100;
export const DEFAULT_ACTIVITY_PERIOD_DAYS = 30;
export const MAX_REPORT_CONDITIONS = 30;
export const MAX_REPORT_GROUP_IDS = 100;
export const MAX_REPORT_TIMEZONE_LENGTH = 100;
export const REPORT_CONFIGURATION_SEARCH_PARAM = "reportConfig";

export const EMPTY_FILTERS: ReportFilterTree = { join: "and", conditions: [], groups: [] };

export const DEFAULT_REPORT_CONFIGURATION: ReportConfiguration = {
  view: "organisation",
  timezone: "UTC",
  subject: null,
  groupIds: [],
  filters: EMPTY_FILTERS,
};

export const REPORT_VIEW_TABS: { view: ReportView; icon: LucideIcon }[] = [
  { view: "organisation", icon: Building2 },
  { view: "developmentPaths", icon: Route },
  { view: "course", icon: BookOpen },
  { view: "learner", icon: UserRound },
];

export const REPORT_VIEWS: ReportView[] = REPORT_VIEW_TABS.map(({ view }) => view);

export const REPORT_FIELD_KEYS: ReportFilterField[] = [
  "groupId",
  "learner",
  "courseId",
  "pathId",
  "status",
  "progress",
  "enrolledAt",
  "completedAt",
  "score",
  "attempts",
  "certificate",
  "lastActivity",
  "dueDate",
];

export const REPORT_OPERATOR_KEYS: ReportFilterOperator[] = [
  "eq",
  "neq",
  "in",
  "notIn",
  "contains",
  "notContains",
  "gte",
  "lte",
  "between",
  "notBetween",
  "isEmpty",
  "isNotEmpty",
];

export const REPORT_RANGE_OPERATORS: ReportFilterOperator[] = ["between", "notBetween"];

export const REPORT_LIST_OPERATORS: ReportFilterOperator[] = ["in", "notIn"];

export const REPORT_TEXT_SEARCH_OPERATORS: ReportFilterOperator[] = ["contains", "notContains"];

export const REPORT_PRESENCE_OPERATORS: ReportFilterOperator[] = ["isEmpty", "isNotEmpty"];

/** Fields whose choices come from a searchable API list rather than fixed values. */
export const REPORT_REMOTE_CHOICE_FIELDS: ReportFilterField[] = [
  "groupId",
  "learner",
  "courseId",
  "pathId",
];

export const REPORT_NUMERIC_FIELDS: ReportFilterField[] = ["progress", "score", "attempts"];

export const REPORT_DATE_FIELDS: ReportFilterField[] = [
  "enrolledAt",
  "completedAt",
  "lastActivity",
  "dueDate",
];

export const REPORT_VIEW_FIELDS: Record<ReportView, ReportFilterField[]> = {
  organisation: REPORT_FIELD_KEYS,
  developmentPaths: REPORT_FIELD_KEYS.filter((field) => field !== "dueDate"),
  course: REPORT_FIELD_KEYS,
  learner: REPORT_FIELD_KEYS.filter((field) => field !== "learner"),
};

/** Every matching operator a field offers comes with its excluding counterpart. */
export const REPORT_FILTER_FIELDS: Record<ReportFilterField, ReportFilterOperator[]> = {
  groupId: ["eq", "neq", "in", "notIn", "isEmpty", "isNotEmpty"],
  learner: ["eq", "neq", "contains", "notContains", "in", "notIn", "isEmpty", "isNotEmpty"],
  courseId: ["eq", "neq", "in", "notIn", "isEmpty", "isNotEmpty"],
  pathId: ["eq", "neq", "in", "notIn", "isEmpty", "isNotEmpty"],
  status: ["eq", "neq", "in", "notIn"],
  progress: ["eq", "neq", "gte", "lte", "between", "notBetween"],
  enrolledAt: ["eq", "neq", "gte", "lte", "between", "notBetween"],
  completedAt: ["eq", "neq", "gte", "lte", "between", "notBetween", "isEmpty", "isNotEmpty"],
  score: ["eq", "neq", "gte", "lte", "between", "notBetween", "isEmpty", "isNotEmpty"],
  attempts: ["eq", "neq", "gte", "lte", "between", "notBetween"],
  certificate: ["eq", "neq", "isEmpty", "isNotEmpty"],
  lastActivity: ["eq", "neq", "gte", "lte", "between", "notBetween", "isEmpty", "isNotEmpty"],
  dueDate: ["eq", "neq", "gte", "lte", "between", "notBetween", "isEmpty", "isNotEmpty"],
};

export const REPORT_FIELD_VALUES: Partial<Record<ReportFilterField, string[]>> = {
  status: ["notStarted", "inProgress", "completed"],
  certificate: ["active", "expired", "revoked", "notEarned"],
};
