import type { LessonActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";

type LessonCreationData = {
  lessonId: UUIDType;
  createdById: UUIDType;
  createdLesson: LessonActivityLogSnapshot;
};

export class CreateLessonEvent {
  constructor(public readonly lessonCreationData: LessonCreationData) {}
}
