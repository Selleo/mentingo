import type { ChapterActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type ChapterCreationData = {
  chapterId: UUIDType;
  actor: ActorUserType;
  createdChapter: ChapterActivityLogSnapshot;
};

export class CreateChapterEvent {
  constructor(public readonly chapterCreationData: ChapterCreationData) {}
}
