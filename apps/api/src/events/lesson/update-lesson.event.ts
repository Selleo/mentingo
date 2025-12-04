import type { ActivityLogUpdateMetadata } from "src/activity-logs/types";
import type { UUIDType } from "src/common";

type LessonUpdateData = {
  lessonId: UUIDType;
  updatedById: UUIDType;
  metadata: ActivityLogUpdateMetadata;
};

export class UpdateLessonEvent {
  constructor(public readonly lessonUpdateData: LessonUpdateData) {}
}
