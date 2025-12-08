import type { CourseActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type CourseCreationData = {
  courseId: UUIDType;
  actor: CurrentUser;
  createdCourse: CourseActivityLogSnapshot;
};

export class CreateCourseEvent {
  constructor(public readonly courseCreationData: CourseCreationData) {}
}
