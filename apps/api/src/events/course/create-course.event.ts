import type { UUIDType } from "src/common";

type CourseCreationData = {
  courseId: UUIDType;
  createdById: UUIDType;
};

export class CreateCourseEvent {
  constructor(public readonly courseCreationData: CourseCreationData) {}
}
