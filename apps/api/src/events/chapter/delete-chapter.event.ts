import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type DeleteChapterData = {
  chapterId: UUIDType;
  chapterName: string;
  actor: ActorUserType;
};

export class DeleteChapterEvent {
  constructor(public readonly deleteChapterData: DeleteChapterData) {}
}
