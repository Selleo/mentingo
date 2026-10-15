import type { ReportConfigurationResponse } from "./schemas/reports-configurations.schema";

export type ReportConfigurationAvailability = Pick<
  ReportConfigurationResponse,
  "isAvailable" | "failureCode"
>;
export type ReportConfigurationView = Omit<
  ReportConfigurationResponse,
  "isAvailable" | "failureCode"
> &
  ReportConfigurationAvailability;
