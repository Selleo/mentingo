import type { UUIDType } from "src/common";

type ChapterUpdateData = {
  chapterId: UUIDType;
  updatedById: UUIDType;
  previousChapterData: Record<string, unknown> | null;
  updatedChapterData: Record<string, unknown> | null;
};

export class UpdateChapterEvent {
  constructor(public readonly chapterUpdateData: ChapterUpdateData) {}
}
