import type { CourseActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";

type CourseCreationData = {
  courseId: UUIDType;
  createdById: UUIDType;
  createdCourse: CourseActivityLogSnapshot;
};

export class CreateCourseEvent {
  constructor(public readonly courseCreationData: CourseCreationData) {}
}
