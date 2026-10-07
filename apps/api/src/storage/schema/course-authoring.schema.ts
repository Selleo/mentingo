/** Persistence result types for the idempotent native course-authoring application record. */
export type CourseAuthoringApplicationResult = {
  applicationId: string;
  exportHash: string;
  status: "applied";
  exportId: string;
  courseId: string;
  sessionId: string;
  appliedOperationIds: string[];
  entityMappings: Record<string, string>;
  assetMappings: Record<string, string>;
};
