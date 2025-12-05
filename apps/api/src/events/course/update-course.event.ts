import type { CourseActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";

type CourseUpdateData = {
  courseId: UUIDType;
  updatedById: UUIDType;
  previousCourseData: CourseActivityLogSnapshot | null;
  updatedCourseData: CourseActivityLogSnapshot | null;
};

export class UpdateCourseEvent {
  constructor(public readonly courseUpdateData: CourseUpdateData) {}
}
