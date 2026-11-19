import type { ReportActivityPeriod } from "../schemas/reports.schema";
import type { SQL } from "drizzle-orm";

export type CourseActivityContext = {
  period: ReportActivityPeriod;
  timezone: string;
  tenantId: string;
  courseCandidates: SQL;
  pathView: boolean;
};
