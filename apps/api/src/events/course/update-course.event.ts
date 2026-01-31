import type { CourseActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type CourseUpdateData = {
  courseId: UUIDType;
  actor: ActorUserType;
  previousCourseData: CourseActivityLogSnapshot | null;
  updatedCourseData: CourseActivityLogSnapshot | null;
};

export class UpdateCourseEvent {
  constructor(public readonly courseUpdateData: CourseUpdateData) {}
}
