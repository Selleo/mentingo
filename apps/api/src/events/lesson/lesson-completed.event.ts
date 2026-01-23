import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type LessonCompletedData = {
  userId: UUIDType;
  courseId: UUIDType;
  lessonId: UUIDType;
  actor: ActorUserType;
};

export class LessonCompletedEvent {
  constructor(public readonly lessonCompletionData: LessonCompletedData) {}
}
