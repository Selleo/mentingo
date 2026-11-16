import type { UUIDType } from "src/common";

export type ForumReplyCreatedData = {
  topicId: UUIDType;
  postId: UUIDType;
  firstPostId: UUIDType;
  actorUserId: UUIDType;
};

export class ForumReplyCreatedEvent {
  constructor(public readonly forumReplyCreatedData: ForumReplyCreatedData) {}
}
