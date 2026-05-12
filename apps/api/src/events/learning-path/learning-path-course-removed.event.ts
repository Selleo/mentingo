import type { UUIDType } from "src/common";

type LearningPathCourseRemovedData = {
  tenantId: UUIDType;
  learningPathId: UUIDType;
  courseId: UUIDType;
};

export class LearningPathCourseRemovedEvent {
  constructor(public readonly learningPathCourseRemovedData: LearningPathCourseRemovedData) {}
}
