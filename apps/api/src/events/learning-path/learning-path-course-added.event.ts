import type { UUIDType } from "src/common";

type LearningPathCourseAddedData = {
  tenantId: UUIDType;
  learningPathId: UUIDType;
  courseId: UUIDType;
};

export class LearningPathCourseAddedEvent {
  constructor(public readonly learningPathCourseAddedData: LearningPathCourseAddedData) {}
}
