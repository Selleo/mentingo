import type { LessonActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type LessonCreationData = {
  lessonId: UUIDType;
  actor: ActorUserType;
  createdLesson: LessonActivityLogSnapshot;
};

export class CreateLessonEvent {
  constructor(public readonly lessonCreationData: LessonCreationData) {}
}
