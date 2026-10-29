import { ASSISTANT_MESSAGE_ROLES, SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const slackConversationSchema = Type.Object({
  threadKey: Type.String({ minLength: 1, maxLength: 500 }),
  title: Type.Optional(Type.String({ maxLength: 200 })),
  language: Type.Optional(Type.Enum(SUPPORTED_LANGUAGES)),
  messages: Type.Array(
    Type.Object({
      externalId: Type.String({ minLength: 1, maxLength: 200 }),
      role: Type.Enum(ASSISTANT_MESSAGE_ROLES),
      text: Type.String({ minLength: 1, maxLength: 50000 }),
      slackUserId: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
      slackUserName: Type.Optional(Type.String({ maxLength: 200 })),
      createdAt: Type.String({ format: "date-time" }),
    }),
    { minItems: 1, maxItems: 100 },
  ),
});
export const slackConversationResponseSchema = Type.Object({ id: UUIDSchema });
export type SlackConversationInput = Static<typeof slackConversationSchema>;
export type SlackConversationResponse = Static<typeof slackConversationResponseSchema>;
