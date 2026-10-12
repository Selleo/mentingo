/** TypeBox contracts for authoring sessions, commands, durable replay and export preparation. */
import {
  ReasoningEffort,
  TaskKind,
  TurnPartKind,
  TurnPartStatus,
  TurnStatus,
} from "@mentingo/luma-sdk";
import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema, paginatedResponse } from "src/common";

import { authoringOperationSchema } from "./course-authoring-operations.schema";

const strict = { additionalProperties: false };
const nullableString = Type.Union([Type.String(), Type.Null()]);
export const authoringTaskFailureSchema = Type.Object(
  {
    code: Type.String(),
    category: Type.Union(
      ["generation", "evidence", "author_decision", "provider", "configuration", "internal"].map(
        (value) => Type.Literal(value),
      ),
    ),
    stage: Type.String(),
    recoveryAction: Type.Union(
      ["retry_failed_parts", "answer_question", "retry_provider", "service_fix"].map((value) =>
        Type.Literal(value),
      ),
    ),
    retryable: Type.Boolean(),
    affectedChapterIds: Type.Array(UUIDSchema),
    affectedLessonIds: Type.Array(UUIDSchema),
    correlationId: nullableString,
    detailKey: nullableString,
    generationRevision: Type.Integer({ minimum: 0 }),
  },
  strict,
);
const taskKind = Type.Optional(Type.Union([Type.Enum(TaskKind), Type.Null()]));
const sourcePolicy = Type.Object(
  {
    sourceVersionIds: Type.Array(UUIDSchema),
    webEnabled: Type.Boolean(),
    generalKnowledgeEnabled: Type.Boolean(),
    researchDepth: Type.Union([Type.Literal("standard"), Type.Literal("deep")]),
    requiredSectionIds: Type.Array(UUIDSchema),
    excludedSectionIds: Type.Array(UUIDSchema),
  },
  strict,
);
const target = Type.Object(
  {
    targetId: UUIDSchema,
    kind: Type.Union([
      Type.Literal("course"),
      Type.Literal("chapter"),
      Type.Literal("lesson"),
      Type.Literal("block"),
      Type.Literal("question"),
    ]),
    language: Type.Enum(SUPPORTED_LANGUAGES),
    baselineHash: nullableString,
    blockIds: Type.Array(Type.String()),
    questionIds: Type.Optional(Type.Array(UUIDSchema)),
    allowedFields: Type.Array(Type.String()),
  },
  strict,
);
const outline = Type.Array(
  Type.Object(
    {
      id: UUIDSchema,
      title: Type.String(),
      lessons: Type.Array(
        Type.Object(
          {
            id: UUIDSchema,
            title: Type.String(),
            lessonType: Type.Union([
              Type.Literal("content"),
              Type.Literal("quiz"),
              Type.Literal("ai_mentor"),
            ]),
            objectives: Type.Array(Type.String()),
            sourceVersionIds: Type.Optional(Type.Union([Type.Array(UUIDSchema), Type.Null()])),
            coverageNotes: Type.Optional(nullableString),
            requiredSectionIds: Type.Optional(Type.Array(UUIDSchema)),
          },
          strict,
        ),
      ),
    },
    strict,
  ),
);
const request = Type.Object(
  {
    instruction: Type.String({ minLength: 1, maxLength: 20000 }),
    reasoningEffort: Type.Optional(Type.Enum(ReasoningEffort)),
    targets: Type.Array(target),
    sourcePolicy,
    attachedSourceVersionIds: Type.Optional(Type.Array(UUIDSchema)),
    exactOutline: Type.Optional(Type.Union([outline, Type.Null()])),
  },
  strict,
);
export const createAuthoringSessionSchema = Type.Object(
  { commandId: UUIDSchema, language: Type.Enum(SUPPORTED_LANGUAGES) },
  strict,
);
const proposalReviewDecisionSchema = Type.Object(
  {
    proposalId: UUIDSchema,
    expectedRevision: Type.Integer({ minimum: 1 }),
    accepted: Type.Boolean(),
    acceptQualityConcerns: Type.Optional(Type.Boolean()),
  },
  strict,
);
const proposalRegenerationSchema = Type.Object(
  {
    targetId: UUIDSchema,
    expectedRevision: Type.Integer({ minimum: 1 }),
    feedback: Type.String({ minLength: 1, maxLength: 2000 }),
  },
  strict,
);
const commandFields = {
  schemaVersion: Type.Literal(1),
  commandId: UUIDSchema,
  request: Type.Optional(request),
  targetId: Type.Optional(UUIDSchema),
  replacementSourceVersionId: Type.Optional(UUIDSchema),
  expectedRevision: Type.Optional(Type.Integer({ minimum: 0 })),
  answer: Type.Optional(Type.String()),
  acceptQualityConcerns: Type.Optional(Type.Boolean()),
  operations: Type.Optional(Type.Array(authoringOperationSchema)),
  sourcePolicy: Type.Optional(sourcePolicy),
};
const nonBatchCommandActions = [
  "request.create",
  "session.pause",
  "session.resume",
  "session.stop",
  "request.stop",
  "request.discard",
  "task.retry",
  "question.answer",
  "proposal.accept",
  "proposal.reject",
  "draft.edit",
  "draft.discard",
  "sources.select",
  "asset.retry_submission",
] as const;
export const authoringCommandBodySchema = Type.Union([
  Type.Object(
    {
      ...commandFields,
      action: Type.Literal("source.refresh"),
      selectedTaskIds: Type.Optional(
        Type.Array(UUIDSchema, { minItems: 1, maxItems: 100, uniqueItems: true }),
      ),
    },
    strict,
  ),
  Type.Object(
    {
      ...commandFields,
      action: Type.Literal("proposal.regenerate"),
      feedback: Type.Optional(Type.String({ minLength: 1, maxLength: 2000 })),
    },
    strict,
  ),
  Type.Object(
    {
      ...commandFields,
      action: Type.Union(nonBatchCommandActions.map((action) => Type.Literal(action))),
    },
    strict,
  ),
  Type.Object(
    {
      schemaVersion: Type.Literal(1),
      commandId: UUIDSchema,
      action: Type.Literal("proposal.review"),
      reviews: Type.Array(proposalReviewDecisionSchema, { minItems: 1, maxItems: 100 }),
      requestId: Type.Optional(UUIDSchema),
    },
    strict,
  ),
  Type.Object(
    {
      schemaVersion: Type.Literal(1),
      commandId: UUIDSchema,
      action: Type.Literal("proposal.regenerate.batch"),
      regenerations: Type.Array(proposalRegenerationSchema, { minItems: 1, maxItems: 100 }),
    },
    strict,
  ),
]);
export const prepareAuthoringExportSchema = Type.Object(
  {
    commandId: UUIDSchema,
    proposalIds: Type.Array(UUIDSchema, { minItems: 1 }),
    omitOptionalAssetIds: Type.Optional(Type.Array(UUIDSchema)),
    acknowledgeAssessmentChanges: Type.Optional(Type.Boolean()),
  },
  strict,
);

const record = Type.Object({
  id: UUIDSchema,
  kind: Type.String(),
  payload: Type.Record(Type.String(), Type.Unknown()),
});
const turnToolResult = Type.Object(
  {
    query: Type.Optional(Type.Union([Type.String({ maxLength: 12000 }), Type.Null()])),
    queries: Type.Optional(Type.Union([Type.Array(Type.String(), { maxItems: 64 }), Type.Null()])),
    sources: Type.Optional(
      Type.Union([
        Type.Array(
          Type.Object(
            {
              url: Type.String({ minLength: 1, maxLength: 2048 }),
              title: Type.Optional(Type.Union([Type.String({ maxLength: 600 }), Type.Null()])),
            },
            strict,
          ),
          { maxItems: 64 },
        ),
        Type.Null(),
      ]),
    ),
    sourceCount: Type.Optional(Type.Union([Type.Integer({ minimum: 0 }), Type.Null()])),
    findingCount: Type.Optional(Type.Union([Type.Integer({ minimum: 0 }), Type.Null()])),
  },
  strict,
);
const turnTool = Type.Object(
  {
    toolCallId: Type.String(),
    toolName: Type.String(),
    display: Type.String(),
    status: Type.Union([
      Type.Literal("started"),
      Type.Literal("completed"),
      Type.Literal("failed"),
      Type.Literal("stopped"),
    ]),
    result: Type.Optional(Type.Union([turnToolResult, Type.Null()])),
  },
  strict,
);
const turnArtifact = Type.Object(
  {
    artifactKind: Type.Union([Type.Literal("proposal"), Type.Literal("question")]),
    artifactId: Type.String(),
  },
  strict,
);
export const authoringTurnPartSchema = Type.Object(
  {
    requestId: UUIDSchema,
    messageId: Type.String(),
    partId: Type.String(),
    partKind: Type.Enum(TurnPartKind),
    taskId: Type.Optional(Type.Union([UUIDSchema, Type.Null()])),
    status: Type.Enum(TurnPartStatus),
    firstSequence: Type.Integer({ minimum: 1 }),
    updatedSequence: Type.Integer({ minimum: 1 }),
    text: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    planSteps: Type.Optional(Type.Array(Type.String(), { maxItems: 6 })),
    answer: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    tool: Type.Optional(Type.Union([turnTool, Type.Null()])),
    artifact: Type.Optional(Type.Union([turnArtifact, Type.Null()])),
  },
  strict,
);
const authoringTurn = Type.Object(
  {
    requestId: UUIDSchema,
    messageId: Type.String(),
    status: Type.Enum(TurnStatus),
    taskIds: Type.Array(UUIDSchema),
    parts: Type.Array(authoringTurnPartSchema),
    firstSequence: Type.Integer({ minimum: 1 }),
    updatedSequence: Type.Integer({ minimum: 0 }),
  },
  strict,
);
export const authoringSessionSchema = Type.Object(
  {
    reasoningControlAvailable: Type.Optional(Type.Boolean()),
    applicationDelta: Type.Optional(
      Type.Object(
        {
          appliedOperationIds: Type.Array(UUIDSchema),
          idMappings: Type.Record(Type.String(), UUIDSchema),
        },
        strict,
      ),
    ),
    schemaVersion: Type.Literal(1),
    sessionId: UUIDSchema,
    courseId: UUIDSchema,
    language: Type.Enum(SUPPORTED_LANGUAGES),
    status: Type.Union([
      Type.Literal("active"),
      Type.Literal("paused"),
      Type.Literal("stopped"),
      Type.Literal("discarded"),
    ]),
    snapshotSequence: Type.Integer(),
    workspaceRevision: Type.Integer(),
    records: Type.Array(record),
    turns: Type.Optional(Type.Array(authoringTurn)),
    hasMoreTurns: Type.Optional(Type.Boolean()),
    nextBeforeRequestId: Type.Optional(Type.Union([UUIDSchema, Type.Null()])),
    tasks: Type.Array(
      Type.Object({
        taskId: UUIDSchema,
        requestId: UUIDSchema,
        kind: taskKind,
        status: Type.String(),
        errorCode: nullableString,
        failure: Type.Optional(Type.Union([authoringTaskFailureSchema, Type.Null()])),
        outputId: Type.Union([UUIDSchema, Type.Null()]),
      }),
    ),
  },
  strict,
);
export const authoringSessionResponseSchema = Type.Object({ data: authoringSessionSchema });
export const authoringTurnHistorySchema = Type.Object({
  courseId: UUIDSchema,
  turns: Type.Array(authoringTurn),
  records: Type.Array(record),
  hasMore: Type.Boolean(),
  nextBeforeRequestId: Type.Union([UUIDSchema, Type.Null()]),
});
export const authoringTurnHistoryResponseSchema = Type.Object({ data: authoringTurnHistorySchema });
export const authoringSessionSummarySchema = Type.Object(
  {
    sessionId: UUIDSchema,
    courseId: UUIDSchema,
    language: Type.Enum(SUPPORTED_LANGUAGES),
    status: Type.Union([
      Type.Literal("active"),
      Type.Literal("paused"),
      Type.Literal("stopped"),
      Type.Literal("discarded"),
    ]),
    title: Type.String({ minLength: 1, maxLength: 96 }),
    createdAt: Type.String({ format: "date-time" }),
    lastActivityAt: Type.String({ format: "date-time" }),
  },
  strict,
);
/** Validates the raw, offset-paginated page shape returned by the Luma authoring producer. */
export const authoringSessionPageSchema = Type.Object({
  sessions: Type.Array(authoringSessionSummarySchema),
  total: Type.Integer(),
  page: Type.Integer(),
  perPage: Type.Integer(),
  hasMore: Type.Boolean(),
});
export const authoringSessionListResponseSchema = paginatedResponse(
  Type.Array(authoringSessionSummarySchema),
);
export const authoringSessionListQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1 })),
  perPage: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
  keyword: Type.Optional(Type.String()),
});
export const authoringCommandReceiptSchema = Type.Object({
  data: Type.Object({
    commandId: UUIDSchema,
    hash: Type.String(),
    acceptedSequence: Type.Integer(),
    workspaceRevision: Type.Integer(),
    requestId: Type.Union([UUIDSchema, Type.Null()]),
    taskIds: Type.Union([Type.Array(UUIDSchema), Type.Null()]),
    refreshId: Type.Optional(Type.Union([UUIDSchema, Type.Null()])),
    refreshStatus: Type.Optional(
      Type.Union([Type.Literal("refreshed"), Type.Literal("needs_mapping"), Type.Null()]),
    ),
  }),
});
export const authoringEventsSchema = Type.Object({
  data: Type.Object({
    events: Type.Array(
      Type.Object({
        schemaVersion: Type.Literal(1),
        eventId: UUIDSchema,
        sessionId: UUIDSchema,
        sequence: Type.Integer(),
        occurredAt: Type.String(),
        type: Type.String(),
        payload: Type.Record(Type.String(), Type.Unknown()),
      }),
    ),
    nextSequence: Type.Integer(),
    hasMore: Type.Boolean(),
  }),
});
export type CreateAuthoringSessionBody = Static<typeof createAuthoringSessionSchema>;
export type AuthoringCommandBody = Static<typeof authoringCommandBodySchema>;
export type PrepareAuthoringExportBody = Static<typeof prepareAuthoringExportSchema>;
export type AuthoringSession = Static<typeof authoringSessionSchema>;
export type AuthoringTurnHistory = Static<typeof authoringTurnHistorySchema>;
export type AuthoringSessionSummary = Static<typeof authoringSessionSummarySchema>;
export type AuthoringSessionListQuery = Static<typeof authoringSessionListQuerySchema>;
export type AuthoringCommandReceiptResponse = Static<typeof authoringCommandReceiptSchema>["data"];
export type AuthoringEventsResponse = Static<typeof authoringEventsSchema>["data"];
