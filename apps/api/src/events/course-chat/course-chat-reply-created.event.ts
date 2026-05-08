import type { UUIDType } from "src/common";

export type CourseChatReplyCreatedData = {
  courseId: UUIDType;
  actorUserId: UUIDType;
  messageId: UUIDType;
  parentMessageId: UUIDType;
};

export class CourseChatReplyCreatedEvent {
  constructor(public readonly courseChatReplyCreatedData: CourseChatReplyCreatedData) {}
}
