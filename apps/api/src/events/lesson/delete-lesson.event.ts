import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type DeleteLessonData = {
  lessonId: UUIDType;
  courseId: UUIDType;
  lessonName: string;
  actor: ActorUserType;
};

export class DeleteLessonEvent {
  constructor(public readonly deleteLessonData: DeleteLessonData) {}
}
