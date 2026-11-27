export type ReportView = "organisation" | "developmentPaths" | "course" | "learner";
export type FilterJoin = "and" | "or";
export type ReportSubjectType = "course" | "path" | "learner";

export type ReportSubject = {
  id: string;
  name: string;
  type: ReportSubjectType;
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
  | "lastActivity"
  | "dueDate";

export type ReportFilterOperator =
  | "eq"
  | "neq"
  | "contains"
  | "notContains"
  | "gte"
  | "lte"
  | "in"
  | "notIn"
  | "between"
  | "notBetween"
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

export type ReportOption = { id: string; label: string };

export type ReportFilterOptions = Partial<Record<ReportFilterField, ReportOption[]>>;

export type ReportInaccessibleReference = {
  subjectId?: string;
  groupIds: string[];
  filters: string;
};
