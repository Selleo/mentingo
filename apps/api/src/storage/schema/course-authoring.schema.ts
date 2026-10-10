/** Persistence result types for the idempotent native course-authoring application record. */
export type CourseAuthoringApplicationResult = {
  applicationId: string;
  exportHash: string;
  status: "applied" | "failed" | "conflict";
  reason?: string | null;
  exportId: string;
  courseId: string;
  sessionId: string;
  appliedOperationIds: string[];
  entityMappings: Record<string, string>;
  assetMappings: Record<string, string>;
};
