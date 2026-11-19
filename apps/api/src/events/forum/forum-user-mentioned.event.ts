import type { UUIDType } from "src/common";

export type ForumUserMentionedData = {
  tenantId: UUIDType;
  topicId: UUIDType;
  postId: UUIDType;
  actorUserId: UUIDType;
  mentionedUserIds: UUIDType[];
};

export class ForumUserMentionedEvent {
  constructor(public readonly forumUserMentionedData: ForumUserMentionedData) {}
}
