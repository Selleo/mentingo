import type { AnnouncementSourceType, SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

export type DiscussionReply = {
  threadId: UUIDType;
  actorUserId: UUIDType;
  mentionedUserIds: UUIDType[];
  content: Record<SupportedLanguages, string>;
  sourceType: AnnouncementSourceType;
  sourceId: UUIDType;
  linkPath: string | null;
};

export type DiscussionRecipientFilter = (userIds: UUIDType[]) => Promise<UUIDType[]>;
