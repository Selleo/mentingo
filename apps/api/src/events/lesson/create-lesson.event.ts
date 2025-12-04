import type { UUIDType } from "src/common";

type LessonCreationData = {
  lessonId: UUIDType;
  createdById: UUIDType;
};

export class CreateLessonEvent {
  constructor(public readonly lessonCreationData: LessonCreationData) {}
}
