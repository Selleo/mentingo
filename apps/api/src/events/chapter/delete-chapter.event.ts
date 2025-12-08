import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type DeleteChapterData = {
  chapterId: UUIDType;
  chapterName: string;
  actor: CurrentUser;
};

export class DeleteChapterEvent {
  constructor(public readonly deleteChapterData: DeleteChapterData) {}
}
