import type { UUIDType } from "src/common";

type LearningPathCourseSyncData = {
  tenantId: UUIDType;
  learningPathId: UUIDType;
};

export class LearningPathCourseSyncEvent {
  constructor(public readonly learningPathCourseSyncData: LearningPathCourseSyncData) {}
}
