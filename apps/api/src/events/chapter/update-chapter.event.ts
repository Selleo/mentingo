import type { ChapterActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type ChapterUpdateData = {
  chapterId: UUIDType;
  actor: CurrentUser;
  previousChapterData: ChapterActivityLogSnapshot | null;
  updatedChapterData: ChapterActivityLogSnapshot | null;
};

export class UpdateChapterEvent {
  constructor(public readonly chapterUpdateData: ChapterUpdateData) {}
}
