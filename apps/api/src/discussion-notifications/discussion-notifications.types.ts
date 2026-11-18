import type { AnnouncementSourceType, DiscussionScope, SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

export type DiscussionReply = {
  threadId: UUIDType;
  replyId: UUIDType;
  actorUserId: UUIDType;
  mentionedUserIds: UUIDType[];
  content: Record<SupportedLanguages, string>;
  sourceType: AnnouncementSourceType;
  sourceId: UUIDType;
  linkPath: string | null;
};

export type DiscussionRecipientFilter = (userIds: UUIDType[]) => Promise<UUIDType[]>;

export type DiscussionReplyDigest = {
  id: UUIDType;
  userId: UUIDType;
  threadId: UUIDType;
  announcementIds: UUIDType[];
};

export type DiscussionDigestThread = {
  scope: DiscussionScope;
  courseId: UUIDType | null;
  title: string | null;
  firstMessageId: UUIDType;
};

export type DiscussionDigestRecipient = {
  id: UUIDType;
  email: string;
  firstName: string;
  lastName: string;
};
