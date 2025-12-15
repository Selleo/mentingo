import type { LessonActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type LessonUpdateData = {
  lessonId: UUIDType;
  actor: CurrentUser;
  previousLessonData: LessonActivityLogSnapshot | null;
  updatedLessonData: LessonActivityLogSnapshot | null;
};

export class UpdateLessonEvent {
  constructor(public readonly lessonUpdateData: LessonUpdateData) {}
}
