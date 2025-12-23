import { Type } from "@sinclair/typebox";

import type { Static } from "@sinclair/typebox";

export const bunnyWebhookSchema = Type.Object({
  status: Type.Optional(Type.Union([Type.Number(), Type.String()])),
  Status: Type.Optional(Type.Union([Type.Number(), Type.String()])),
  videoId: Type.Optional(Type.String()),
  VideoId: Type.Optional(Type.String()),
  videoGuid: Type.Optional(Type.String()),
  VideoGuid: Type.Optional(Type.String()),
  guid: Type.Optional(Type.String()),
  Guid: Type.Optional(Type.String()),
});

export type BunnyWebhookBody = Static<typeof bunnyWebhookSchema>;
