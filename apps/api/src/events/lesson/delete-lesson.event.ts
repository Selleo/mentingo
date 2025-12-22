import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type DeleteLessonData = {
  lessonId: UUIDType;
  lessonName: string;
  chapterId: UUIDType;
  courseId: UUIDType;
  actor: CurrentUser;
};

export class DeleteLessonEvent {
  constructor(public readonly deleteLessonData: DeleteLessonData) {}
}
