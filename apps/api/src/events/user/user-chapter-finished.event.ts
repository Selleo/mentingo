import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type UserChapterFinished = {
  courseId: UUIDType;
  chapterId: UUIDType;
  userId: UUIDType;
  actor: ActorUserType;
};

export class UserChapterFinishedEvent {
  constructor(public readonly chapterFinishedData: UserChapterFinished) {}
}
