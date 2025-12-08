import type { ChapterActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type ChapterCreationData = {
  chapterId: UUIDType;
  actor: CurrentUser;
  createdChapter: ChapterActivityLogSnapshot;
};

export class CreateChapterEvent {
  constructor(public readonly chapterCreationData: ChapterCreationData) {}
}
