import type { ChapterActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";

type ChapterCreationData = {
  chapterId: UUIDType;
  createdById: UUIDType;
  createdChapter: ChapterActivityLogSnapshot;
};

export class CreateChapterEvent {
  constructor(public readonly chapterCreationData: ChapterCreationData) {}
}
