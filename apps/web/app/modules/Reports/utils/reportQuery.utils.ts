import { DEFAULT_REPORT_SORT } from "@repo/shared";

import { REPORT_RANGE_OPERATORS } from "../constants/reports.constants";

import type { ReportDefinition, ReportSort, ReportsQuery } from "../types/reports-api.types";
import type { ReportConfiguration, ReportFilterTree } from "../types/reports.types";
import type { SupportedLanguages } from "@repo/shared";

type ReportBuilderState = Omit<ReportConfiguration, "timezone">;

export const toReportDefinition = (
  config: ReportBuilderState,
  timezone: string,
): ReportDefinition => {
  const toRule = ({
    field,
    operator,
    value,
    secondValue,
  }: ReportFilterTree["conditions"][number]) => ({
    field,
    operator,
    ...(value === undefined ? {} : { value }),
    ...(REPORT_RANGE_OPERATORS.includes(operator) && secondValue !== undefined
      ? { value: [String(value), String(secondValue)] }
      : {}),
  });

  const rules: NonNullable<ReportDefinition["filter"]>["rules"] = [
    ...config.filters.conditions.map(toRule),
    ...config.filters.groups.map((group) => ({
      match: group.join === "and" ? ("all" as const) : ("any" as const),
      rules: group.conditions.map(toRule),
    })),
  ];

  return {
    view: config.view,
    timezone,
    groupIds: config.groupIds,
    ...(config.subject?.id ? { subjectId: config.subject.id } : {}),
    ...(rules.length
      ? { filter: { match: config.filters.join === "and" ? "all" : "any", rules } }
      : {}),
  };
};

export const toReportsQuery = (
  config: ReportBuilderState,
  language: SupportedLanguages,
  timezone: string,
  page = 1,
  pageSize = 25,
  sort: ReportSort = DEFAULT_REPORT_SORT,
): ReportsQuery => ({
  ...toReportDefinition(config, timezone),
  ...sort,
  language,
  page,
  pageSize,
});
