import {
  ASSISTANT_RUN_ACTIVITIES,
  ASSISTANT_SOURCE_TYPES,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { baseResponse, UUIDSchema } from "src/common";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

export const assistantSourceSchema = Type.Object({
  title: Type.String(),
  url: Type.String(),
  entityType: Type.Optional(Type.Enum(ASSISTANT_SOURCE_TYPES)),
  description: Type.Optional(Type.String({ maxLength: 300 })),
});
export const assistantRunSchema = Type.Object({
  id: UUIDSchema,
  threadId: UUIDSchema,
  status: Type.Union([
    Type.Literal("pending"),
    Type.Literal("running"),
    Type.Literal("completed"),
    Type.Literal("failed"),
    Type.Literal("cancelled"),
  ]),
  activity: Type.Optional(Type.Union([Type.Enum(ASSISTANT_RUN_ACTIVITIES), Type.Null()])),
  workflowRunId: Type.Union([Type.String(), Type.Null()]),
  errorCode: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});
export const assistantThreadSchema = Type.Object({
  id: UUIDSchema,
  title: Type.String(),
  language: supportedLanguagesSchema,
  archived: Type.Boolean(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
  latestRun: Type.Optional(Type.Union([assistantRunSchema, Type.Null()])),
});
export const assistantMessageSchema = Type.Object({
  id: UUIDSchema,
  clientMessageId: Type.Optional(Type.Union([UUIDSchema, Type.Null()])),
  threadId: UUIDSchema,
  role: Type.Union([Type.Literal("user"), Type.Literal("assistant")]),
  text: Type.String(),
  status: Type.Union([
    Type.Literal("pending"),
    Type.Literal("running"),
    Type.Literal("complete"),
    Type.Literal("failed"),
    Type.Literal("cancelled"),
  ]),
  sources: Type.Array(assistantSourceSchema),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});
export const assistantPageQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, maximum: 10000 })),
  perPage: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
});
export const assistantThreadListQuerySchema = Type.Intersect([
  assistantPageQuerySchema,
  Type.Object({
    archived: Type.Optional(Type.Boolean()),
    query: Type.Optional(Type.String({ maxLength: 200 })),
  }),
]);
export const createAssistantThreadSchema = Type.Object(
  {
    title: Type.Optional(Type.String({ minLength: 1, maxLength: 200, pattern: "\\S" })),
    language: Type.Optional(supportedLanguagesSchema),
  },
  { additionalProperties: false },
);
export const updateAssistantThreadSchema = Type.Object(
  {
    title: Type.Optional(Type.String({ minLength: 1, maxLength: 200, pattern: "\\S" })),
    archived: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);
export const sendAssistantMessageSchema = Type.Object(
  {
    clientMessageId: UUIDSchema,
    text: Type.String({ minLength: 1, maxLength: 8000, pattern: "\\S" }),
    language: supportedLanguagesSchema,
  },
  { additionalProperties: false },
);
const pageFields = { page: Type.Number(), perPage: Type.Number(), totalItems: Type.Number() };
export const assistantAvailabilitySchema = Type.Object({
  available: Type.Boolean(),
  reason: Type.Union([Type.String(), Type.Null()]),
});
export const assistantThreadPageSchema = Type.Object({
  items: Type.Array(assistantThreadSchema),
  ...pageFields,
});
export const assistantMessagePageSchema = Type.Object({
  items: Type.Array(assistantMessageSchema),
  ...pageFields,
  latestRun: Type.Union([assistantRunSchema, Type.Null()]),
});
export const assistantSendSchema = Type.Object({
  userMessage: assistantMessageSchema,
  assistantMessage: assistantMessageSchema,
  run: assistantRunSchema,
});
export const assistantAvailabilityResponseSchema = baseResponse(assistantAvailabilitySchema);
export const assistantThreadResponseSchema = baseResponse(assistantThreadSchema);
export const assistantThreadPageResponseSchema = baseResponse(assistantThreadPageSchema);
export const assistantMessagePageResponseSchema = baseResponse(assistantMessagePageSchema);
export const assistantSendResponseSchema = baseResponse(assistantSendSchema);
export const assistantRunResponseSchema = baseResponse(assistantRunSchema);
export type AssistantAvailabilityResponse = Static<typeof assistantAvailabilitySchema>;
export type AssistantThreadResponse = Static<typeof assistantThreadSchema>;
export type AssistantThreadPageResponse = Static<typeof assistantThreadPageSchema>;
export type AssistantMessagePageResponse = Static<typeof assistantMessagePageSchema>;
export type AssistantSendResponse = Static<typeof assistantSendSchema>;
export type AssistantRunResponse = Static<typeof assistantRunSchema>;
export type CreateAssistantThread = Static<typeof createAssistantThreadSchema>;
export type UpdateAssistantThread = Static<typeof updateAssistantThreadSchema>;
export type SendAssistantMessage = Static<typeof sendAssistantMessageSchema>;
export type AssistantThreadListQuery = Static<typeof assistantThreadListQuerySchema>;
export type AssistantPageQuery = Static<typeof assistantPageQuerySchema>;
export const DEFAULT_ASSISTANT_LANGUAGE = SUPPORTED_LANGUAGES.EN;
