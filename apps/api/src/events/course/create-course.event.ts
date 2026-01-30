import type { CourseActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type CourseCreationData = {
  courseId: UUIDType;
  actor: ActorUserType;
  createdCourse: CourseActivityLogSnapshot;
};

export class CreateCourseEvent {
  constructor(public readonly courseCreationData: CourseCreationData) {}
}
