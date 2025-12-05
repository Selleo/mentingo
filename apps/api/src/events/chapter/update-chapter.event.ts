import type { ChapterActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";

type ChapterUpdateData = {
  chapterId: UUIDType;
  updatedById: UUIDType;
  previousChapterData: ChapterActivityLogSnapshot | null;
  updatedChapterData: ChapterActivityLogSnapshot | null;
};

export class UpdateChapterEvent {
  constructor(public readonly chapterUpdateData: ChapterUpdateData) {}
}
