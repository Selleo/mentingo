import type { UUIDType } from "src/common";

export type CourseChatMessageCreatedData = {
  courseId: UUIDType;
  actorUserId: UUIDType;
  messageId: UUIDType;
};

export class CourseChatMessageCreatedEvent {
  constructor(public readonly courseChatMessageCreatedData: CourseChatMessageCreatedData) {}
}
