import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type UserChapterFinished = {
  courseId: UUIDType;
  chapterId: UUIDType;
  userId: UUIDType;
  actor: CurrentUser;
};

export class UserChapterFinishedEvent {
  constructor(public readonly chapterFinishedData: UserChapterFinished) {}
}
