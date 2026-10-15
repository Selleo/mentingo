import type { ReportFilter } from "./schemas/reports.schema";

export type ReportFilterRule = ReportFilter["rules"][number];

export type ReportFilterValue = string | number;

export type ReportFilterCompilerContext = {
  timezone: string;
  pathView: boolean;
  authorizedGroupIds: readonly string[];
};
