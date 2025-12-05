import type { UUIDType } from "src/common";

type DeleteLessonData = {
  lessonId: UUIDType;
  lessonName: string;
  deletedById: UUIDType;
};

export class DeleteLessonEvent {
  constructor(public readonly deleteLessonData: DeleteLessonData) {}
}
