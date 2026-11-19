import { match } from "ts-pattern";

import { EMPTY_FILTERS, REPORT_RANGE_OPERATORS } from "../constants/reports.constants";

import { createReportItemId, incompatibleConditions } from "./reportFilters.utils";

import type { ReportOptions, ReportSavedConfiguration } from "../types/reports-api.types";
import type {
  ReportCondition,
  ReportConfiguration,
  ReportFilterField,
  ReportFilterOperator,
  ReportSubject,
  ReportSubjectType,
  ReportView,
} from "../types/reports.types";

type SavedReportRule = {
  field: string;
  operator: string;
  value?: string | number | (string | number)[];
};

export const getSubjectTypeForView = (view: ReportView): ReportSubjectType | null =>
  match(view)
    .with("course", () => "course" as const)
    .with("developmentPaths", () => "path" as const)
    .with("learner", () => "learner" as const)
    .with("organisation", () => null)
    .exhaustive();

export const getSubjectOptions = (
  options: ReportOptions | undefined,
  subjectType: ReportSubjectType | null,
) =>
  match(subjectType)
    .with("course", () => options?.courses)
    .with("path", () => options?.paths)
    .with("learner", () => options?.learners)
    .with(null, () => undefined)
    .exhaustive();

/** Clears everything that narrows the report (subject, groups, conditions), keeping the tab and timezone. */
export const resetReportConfiguration = (
  configuration: ReportConfiguration,
): ReportConfiguration => ({
  ...configuration,
  subject: null,
  groupIds: [],
  filters: EMPTY_FILTERS,
});

export const switchReportView = (configuration: ReportConfiguration, view: ReportView) => {
  const requiredSubjectType = getSubjectTypeForView(view);
  const subject =
    requiredSubjectType && configuration.subject?.type === requiredSubjectType
      ? configuration.subject
      : null;
  return {
    configuration: { ...configuration, view, subject },
    incompatible: incompatibleConditions(configuration.filters, view),
  };
};

const restoreCondition = (rule: SavedReportRule): ReportCondition => {
  const rangeValues =
    REPORT_RANGE_OPERATORS.includes(rule.operator as ReportFilterOperator) &&
    Array.isArray(rule.value)
      ? rule.value
      : undefined;
  return {
    id: createReportItemId(),
    field: rule.field as ReportFilterField,
    operator: rule.operator as ReportCondition["operator"],
    value: rangeValues ? rangeValues[0] : (rule.value as ReportCondition["value"]),
    secondValue: rangeValues ? rangeValues[1] : undefined,
  };
};

/** Rebuilds an editable configuration from a saved definition; unknown subjects keep a placeholder name. */
export const restoreSavedConfiguration = (
  saved: ReportSavedConfiguration,
  options: ReportOptions | undefined,
  inaccessibleSubjectName: string,
): ReportConfiguration => {
  const { query } = saved;
  const subjectType = getSubjectTypeForView(query.view);
  const subjectOption = getSubjectOptions(options, subjectType)?.find(
    ({ id }) => id === query.subjectId,
  );
  const queryRules = query.filter?.rules ?? [];
  const subject: ReportSubject =
    subjectType && query.subjectId
      ? {
          id: query.subjectId,
          type: subjectType,
          name: subjectOption?.label ?? inaccessibleSubjectName,
        }
      : null;

  return {
    view: query.view,
    timezone: query.timezone,
    subject,
    groupIds: query.groupIds,
    filters: {
      join: query.filter?.match === "any" ? "or" : "and",
      conditions: queryRules.flatMap((rule) => ("field" in rule ? [restoreCondition(rule)] : [])),
      groups: queryRules.flatMap((rule) =>
        "match" in rule
          ? [
              {
                id: createReportItemId(),
                join: rule.match === "any" ? ("or" as const) : ("and" as const),
                conditions: rule.rules.map(restoreCondition),
              },
            ]
          : [],
      ),
    },
  };
};
