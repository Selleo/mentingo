import type { LessonActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type LessonUpdateData = {
  lessonId: UUIDType;
  actor: ActorUserType;
  previousLessonData: LessonActivityLogSnapshot | null;
  updatedLessonData: LessonActivityLogSnapshot | null;
};

export class UpdateLessonEvent {
  constructor(public readonly lessonUpdateData: LessonUpdateData) {}
}
