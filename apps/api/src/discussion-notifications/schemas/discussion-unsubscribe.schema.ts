import { DISCUSSION_UNSUBSCRIBE_TYPES } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
import { DISCUSSION_UNSUBSCRIBE_TOKEN_PURPOSE } from "src/discussion-notifications/discussion-notifications.constants";

import type { Static } from "@sinclair/typebox";

export const discussionUnsubscribeBodySchema = Type.Object({
  token: Type.String({ minLength: 1, maxLength: 2048 }),
});

export const discussionUnsubscribeResponseSchema = Type.Object({
  type: Type.Enum(DISCUSSION_UNSUBSCRIBE_TYPES),
});

export const discussionUnsubscribeClaimsSchema = Type.Object({
  purpose: Type.Literal(DISCUSSION_UNSUBSCRIBE_TOKEN_PURPOSE),
  tenantId: UUIDSchema,
  userId: UUIDSchema,
  type: Type.Enum(DISCUSSION_UNSUBSCRIBE_TYPES),
  threadId: Type.Optional(UUIDSchema),
});

export type DiscussionUnsubscribeBody = Static<typeof discussionUnsubscribeBodySchema>;
export type DiscussionUnsubscribeResponse = Static<typeof discussionUnsubscribeResponseSchema>;
export type DiscussionUnsubscribeClaims = Static<typeof discussionUnsubscribeClaimsSchema>;
