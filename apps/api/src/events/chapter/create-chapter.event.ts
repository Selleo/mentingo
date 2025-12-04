import type { Chapter } from "src/chapter/schemas/chapter.schema";
import type { UUIDType } from "src/common";

type ChapterCreationData = {
  chapterId: UUIDType;
  createdById: UUIDType;
  createdChapter: Chapter;
};

export class CreateChapterEvent {
  constructor(public readonly chapterCreationData: ChapterCreationData) {}
}
