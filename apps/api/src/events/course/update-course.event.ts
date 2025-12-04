import type { ActivityLogUpdateMetadata } from "src/activity-logs/types";
import type { UUIDType } from "src/common";

type CourseUpdateData = {
  courseId: UUIDType;
  updatedById: UUIDType;
  metadata: ActivityLogUpdateMetadata;
};

export class UpdateCourseEvent {
  constructor(public readonly courseUpdateData: CourseUpdateData) {}
}
