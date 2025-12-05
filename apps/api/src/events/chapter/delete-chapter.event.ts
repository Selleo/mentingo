import type { UUIDType } from "src/common";

type DeleteChapterData = {
  chapterId: UUIDType;
  chapterName: string;
  deletedById: UUIDType;
};

export class DeleteChapterEvent {
  constructor(public readonly deleteChapterData: DeleteChapterData) {}
}
