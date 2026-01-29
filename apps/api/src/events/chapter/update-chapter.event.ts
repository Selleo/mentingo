import type { ChapterActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type ChapterUpdateData = {
  chapterId: UUIDType;
  actor: ActorUserType;
  previousChapterData: ChapterActivityLogSnapshot | null;
  updatedChapterData: ChapterActivityLogSnapshot | null;
};

export class UpdateChapterEvent {
  constructor(public readonly chapterUpdateData: ChapterUpdateData) {}
}
