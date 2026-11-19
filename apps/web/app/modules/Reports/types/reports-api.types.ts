import type { ReportFilterField, ReportFilterOperator, ReportView } from "./reports.types";
import type { ReportSortDirection, ReportSortField, SupportedLanguages } from "@repo/shared";
import type {
  GetReportOptionsResponse,
  ListReportConfigurationsResponse,
  RunReportBody,
  RunReportResponse,
} from "~/api/generated-api";

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

export type ReportSort = {
  sortBy: ReportSortField;
  sortDirection: ReportSortDirection;
};

export type ReportActivityPeriod = NonNullable<RunReportBody["activityPeriod"]>;

export type ReportCourseActivity = NonNullable<RunReportResponse["data"]["courseActivity"]>;

export type ReportsQuery = ReportDefinition &
  Partial<ReportSort> & {
    activityPeriod?: ReportActivityPeriod;
    language: SupportedLanguages;
    page: number;
    pageSize: number;
  };

export type ReportOptions = GetReportOptionsResponse["data"];

export type ReportSavedConfiguration = ListReportConfigurationsResponse["data"][number];

export type ReportResult = RunReportResponse["data"];

export type ReportExportFormat = "xlsx" | "pdf";

export type ReportConfigurationVisibility = ReportSavedConfiguration["visibility"];
