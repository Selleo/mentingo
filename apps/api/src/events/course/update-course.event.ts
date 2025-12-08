import type { CourseActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type CourseUpdateData = {
  courseId: UUIDType;
  actor: CurrentUser;
  previousCourseData: CourseActivityLogSnapshot | null;
  updatedCourseData: CourseActivityLogSnapshot | null;
};

export class UpdateCourseEvent {
  constructor(public readonly courseUpdateData: CourseUpdateData) {}
}
