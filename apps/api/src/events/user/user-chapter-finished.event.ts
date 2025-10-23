import type { UUIDType } from "src/common";

type UserChapterFinished = {
  courseId: UUIDType;
  chapterId: UUIDType;
  userId: UUIDType;
};

export class UserChapterFinishedEvent {
  constructor(public readonly chapterFinishedData: UserChapterFinished) {}
}
