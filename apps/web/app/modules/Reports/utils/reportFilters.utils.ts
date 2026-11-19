import { MAX_REPORT_CONDITIONS, REPORT_VIEW_FIELDS } from "../constants/reports.constants";

import type {
  ReportCondition,
  ReportConditionGroup,
  ReportFilterTree,
  ReportView,
} from "../types/reports.types";

export const createReportItemId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

export const createDefaultCondition = (): ReportCondition => ({
  id: createReportItemId(),
  field: "status",
  operator: "eq",
  value: "completed",
});

export const createDefaultConditionGroup = (): ReportConditionGroup => ({
  id: createReportItemId(),
  join: "and",
  conditions: [createDefaultCondition()],
});

export const incompatibleConditions = (filters: ReportFilterTree, view: ReportView) => {
  const available = new Set(REPORT_VIEW_FIELDS[view]);
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
