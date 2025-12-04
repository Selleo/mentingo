import type { LessonActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";

type LessonUpdateData = {
  lessonId: UUIDType;
  updatedById: UUIDType;
  previousLessonData: LessonActivityLogSnapshot | null;
  updatedLessonData: LessonActivityLogSnapshot | null;
};

export class UpdateLessonEvent {
  constructor(public readonly lessonUpdateData: LessonUpdateData) {}
}
