import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type LessonCompletedData = {
  userId: UUIDType;
  courseId: UUIDType;
  lessonId: UUIDType;
  actor: CurrentUser;
};

export class LessonCompletedEvent {
  constructor(public readonly lessonCompletionData: LessonCompletedData) {}
}
