import type { UUIDType } from "src/common";

export type ForumTopicCreatedData = {
  topicId: UUIDType;
  postId: UUIDType;
  actorUserId: UUIDType;
};

export class ForumTopicCreatedEvent {
  constructor(public readonly forumTopicCreatedData: ForumTopicCreatedData) {}
}
