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

export type DiscussionReplyDigestEntry = { replyId: UUIDType; announcementId: UUIDType | null };

export type DiscussionReplyPreferences = {
  userId: UUIDType;
  inAppEnabled: boolean;
  emailsEnabled: boolean;
};

export type DiscussionReplyDigest = {
  id: UUIDType;
  userId: UUIDType;
  threadId: UUIDType;
  replies: DiscussionReplyDigestEntry[];
};

export type DiscussionDigestThread = {
  scope: DiscussionScope;
  courseId: UUIDType | null;
  title: string | null;
  firstMessageId: UUIDType;
};

export type DiscussionDigestReply = { authorFullName: string; content: string };
