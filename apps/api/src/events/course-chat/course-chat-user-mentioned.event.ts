import type { UUIDType } from "src/common";

export type CourseChatUserMentionedData = {
  tenantId: UUIDType;
  courseId: UUIDType;
  actorUserId: UUIDType;
  messageId: UUIDType;
  mentionedUserIds: UUIDType[];
};

export class CourseChatUserMentionedEvent {
  constructor(public readonly courseChatUserMentionedData: CourseChatUserMentionedData) {}
}
