import { AI_CONVERSATION_SOURCES, ASSISTANT_MESSAGE_ROLES, SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const externalConversationSchema = Type.Object({
  integrationId: Type.String({minLength: 1, maxLength: 200}),
  source: Type.Union([Type.Literal(AI_CONVERSATION_SOURCES.SLACK), Type.Literal(AI_CONVERSATION_SOURCES.DISCORD), Type.Literal(AI_CONVERSATION_SOURCES.WHATSAPP)]),
  threadKey: Type.String({ minLength: 1, maxLength: 500 }),
  title: Type.Optional(Type.String({ maxLength: 200 })),
  language: Type.Optional(Type.Enum(SUPPORTED_LANGUAGES)),
  messages: Type.Array(
    Type.Object({
      externalId: Type.String({ minLength: 1, maxLength: 200 }),
      role: Type.Enum(ASSISTANT_MESSAGE_ROLES),
      text: Type.String({ minLength: 1, maxLength: 50000 }),
      participantId: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
      participantName: Type.Optional(Type.String({ maxLength: 200 })),
      createdAt: Type.String({ format: "date-time" }),
    }),
    { minItems: 1, maxItems: 100 },
  ),
});
export const externalConversationResponseSchema = Type.Object({ id: UUIDSchema });
export type ExternalConversationInput = Static<typeof externalConversationSchema>;
export type ExternalConversationResponse = Static<typeof externalConversationResponseSchema>;
