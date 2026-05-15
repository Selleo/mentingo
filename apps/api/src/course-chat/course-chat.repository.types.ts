import type { UUIDType } from "src/common";

export type CourseChatUserProfileRow = {
  id: UUIDType;
  firstName: string;
  lastName: string;
  avatarReference: string | null;
};

export type CourseChatMessageRow = {
  id: UUIDType;
  threadId: UUIDType;
  courseId: UUIDType;
  userId: UUIDType;
  content: string;
  parentMessageId: UUIDType | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  userIdForProfile: UUIDType;
  userFirstName: string;
  userLastName: string;
  userAvatarReference: string | null;
};

export type CourseChatMessageReactionSummaryRow = {
  messageId: UUIDType;
  reaction: string;
  count: number;
  reactedByCurrentUser: boolean;
};

export type CourseChatReplySummaryRow = {
  parentMessageId: UUIDType;
  replyCount: number;
  latestReply: CourseChatMessageRow | null;
};

export type CourseChatReplyParticipantRow = CourseChatUserProfileRow & {
  parentMessageId: UUIDType;
};

export type CourseChatMentionEmailRecipient = {
  id: UUIDType;
  email: string;
  firstName: string;
  tenantId: UUIDType;
};

export type CourseChatEmailContext = {
  title: string;
};

export type CourseChatMessageContext = {
  id: UUIDType;
  threadId: UUIDType;
  courseId: UUIDType;
  userId?: UUIDType;
  parentMessageId: UUIDType | null;
  deletedAt?: string | null;
};
