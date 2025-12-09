import type { LessonActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type LessonCreationData = {
  lessonId: UUIDType;
  actor: CurrentUser;
  createdLesson: LessonActivityLogSnapshot;
};

export class CreateLessonEvent {
  constructor(public readonly lessonCreationData: LessonCreationData) {}
}
