import type {
  ReportFilterField,
  ReportFilterOperator,
  ReportFilterTree,
  ReportView,
} from "./reports.types";
import type { SupportedLanguages } from "@repo/shared";

/** What a report shows: its view, scope and conditions. Saved configurations store only this. */
export type ReportDefinition = {
  view: ReportView;
  timezone: string;
  groupIds: string[];
  subjectId?: string;
  filter?: {
    match: "all" | "any";
    rules: Array<
      | {
          field: ReportFilterField;
          operator: ReportFilterOperator;
          value?: string | number | string[];
        }
      | {
          match: "all" | "any";
          rules: Array<{
            field: ReportFilterField;
            operator: ReportFilterOperator;
            value?: string | number | string[];
          }>;
        }
    >;
  };
};

export type ReportsQuery = ReportDefinition & {
  language: SupportedLanguages;
  page: number;
  pageSize: number;
};

type ReportBuilderState = {
  view: ReportView;
  subject: { id: string; name: string; type: "course" | "path" | "learner" } | null;
  groupIds: string[];
  filters: ReportFilterTree;
};

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
    ...(operator === "between" && secondValue !== undefined
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
): ReportsQuery => ({
  ...toReportDefinition(config, timezone),
  language,
  page,
  pageSize,
});
