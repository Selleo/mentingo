export type ReportView = "organisation" | "developmentPaths" | "course" | "learner";
export type FilterJoin = "and" | "or";
export type ReportSubject = {
  id: string;
  name: string;
  type: "course" | "path" | "learner";
} | null;

export type ReportFilterField =
  | "groupId"
  | "learner"
  | "courseId"
  | "pathId"
  | "status"
  | "progress"
  | "enrolledAt"
  | "completedAt"
  | "score"
  | "attempts"
  | "certificate"
  | "lastActivity";

export type ReportFilterOperator =
  | "eq"
  | "neq"
  | "contains"
  | "gte"
  | "lte"
  | "in"
  | "between"
  | "isEmpty"
  | "isNotEmpty";

export type ReportCondition = {
  id: string;
  field: ReportFilterField;
  operator: ReportFilterOperator;
  value?: string | number | string[];
  secondValue?: string | number;
};

export type ReportConditionGroup = {
  id: string;
  join: FilterJoin;
  conditions: ReportCondition[];
};

export type ReportFilterTree = {
  join: FilterJoin;
  conditions: ReportCondition[];
  groups: ReportConditionGroup[];
};

export type ReportConfiguration = {
  view: ReportView;
  timezone: string;
  subject: ReportSubject;
  groupIds: string[];
  filters: ReportFilterTree;
};

export const EMPTY_FILTERS: ReportFilterTree = { join: "and", conditions: [], groups: [] };
export const MAX_REPORT_CONDITIONS = 30;

const VIEW_FIELDS: Record<ReportView, ReportFilterField[]> = {
  organisation: [
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
  ],
  developmentPaths: [
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
  ],
  course: [
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
  ],
  learner: [
    "groupId",
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
  ],
};

export const REPORT_FILTER_FIELDS: Record<ReportFilterField, ReportFilterOperator[]> = {
  groupId: ["eq", "neq", "in", "isEmpty", "isNotEmpty"],
  learner: ["eq", "neq", "contains", "in", "isEmpty", "isNotEmpty"],
  courseId: ["eq", "neq", "in", "isEmpty", "isNotEmpty"],
  pathId: ["eq", "neq", "in", "isEmpty", "isNotEmpty"],
  status: ["eq", "neq", "in"],
  progress: ["eq", "neq", "gte", "lte", "between"],
  enrolledAt: ["eq", "gte", "lte", "between"],
  completedAt: ["eq", "gte", "lte", "between", "isEmpty", "isNotEmpty"],
  score: ["eq", "neq", "gte", "lte", "between", "isEmpty", "isNotEmpty"],
  attempts: ["eq", "neq", "gte", "lte", "between"],
  certificate: ["eq", "neq", "isEmpty", "isNotEmpty"],
  lastActivity: ["eq", "gte", "lte", "between", "isEmpty", "isNotEmpty"],
};

export const REPORT_FIELD_VALUES: Partial<Record<ReportFilterField, string[]>> = {
  status: ["notStarted", "inProgress", "completed"],
  certificate: ["active", "expired", "revoked", "notEarned"],
};

export const incompatibleConditions = (filters: ReportFilterTree, view: ReportView) => {
  const available = new Set(VIEW_FIELDS[view]);
  return [
    ...filters.conditions.filter(({ field }) => !available.has(field)),
    ...filters.groups.flatMap(({ conditions }) =>
      conditions.filter(({ field }) => !available.has(field)),
    ),
  ];
};

export const countConditions = (filters: ReportFilterTree) =>
  filters.conditions.length +
  filters.groups.reduce((total, group) => total + group.conditions.length, 0);

export const addCondition = (filters: ReportFilterTree, condition: ReportCondition) => {
  if (countConditions(filters) >= MAX_REPORT_CONDITIONS) return filters;
  return { ...filters, conditions: [...filters.conditions, condition] };
};

export const addNestedGroup = (filters: ReportFilterTree, group: ReportConditionGroup) => {
  if (filters.groups.length > 0 || countConditions(filters) >= MAX_REPORT_CONDITIONS)
    return filters;
  return { ...filters, groups: [...filters.groups, group] };
};

export const resetReportConfiguration = (
  configuration: ReportConfiguration,
): ReportConfiguration => ({
  ...configuration,
  groupIds: [],
  filters: EMPTY_FILTERS,
});

export const switchReportView = (configuration: ReportConfiguration, view: ReportView) => {
  let requiredSubjectType: "course" | "path" | "learner" | null = null;
  if (view === "course") requiredSubjectType = "course";
  if (view === "developmentPaths") requiredSubjectType = "path";
  if (view === "learner") requiredSubjectType = "learner";
  const subject =
    requiredSubjectType && configuration.subject?.type === requiredSubjectType
      ? configuration.subject
      : null;
  return {
    configuration: { ...configuration, view, subject },
    incompatible: incompatibleConditions(configuration.filters, view),
  };
};
