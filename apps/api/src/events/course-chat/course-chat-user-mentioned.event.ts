import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

export type CourseChatUserMentionedData = {
  tenantId: UUIDType;
  courseId: UUIDType;
  currentUser: CurrentUserType;
  messageId: UUIDType;
  mentionedUserIds: UUIDType[];
};

export class CourseChatUserMentionedEvent {
  constructor(public readonly courseChatUserMentionedData: CourseChatUserMentionedData) {}
}
