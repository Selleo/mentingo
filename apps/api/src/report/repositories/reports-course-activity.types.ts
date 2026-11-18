import type { SQL } from "drizzle-orm";

export type CourseActivityContext = {
  period: { from: string; to: string };
  timezone: string;
  tenantId: string;
  courseCandidates: SQL;
  pathView: boolean;
};
