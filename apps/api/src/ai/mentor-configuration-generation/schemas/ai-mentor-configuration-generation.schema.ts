import {
  AI_MENTOR_CONFIGURATION_DRAFT_CHANGE_TYPE,
  AI_MENTOR_CONFIGURATION_FIELD,
  AI_MENTOR_CONFIGURATION_GENERATION_MAX_ATTEMPTS,
  AI_MENTOR_CONFIGURATION_GENERATION_MODE,
  AI_MENTOR_CONFIGURATION_GENERATION_STATUS,
  AI_MENTOR_CONFIGURATION_VALIDATION_SEVERITY,
  AI_MENTOR_ROLEPLAY_DIFFICULTY,
  AI_MENTOR_TEACHING_STYLE,
  AI_MENTOR_TYPE,
} from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
import { aiMentorConfigurationContentSchema } from "src/lesson/ai-mentor-configuration/schemas/ai-mentor-configuration.schema";

import { AI_MENTOR_CONFIGURATION_VALIDATOR_MAX_ISSUES } from "../ai-mentor-configuration-generation.constants";

import type { Static } from "@sinclair/typebox";

const nonEmptyTextSchema = Type.String({ minLength: 1 });
const draftTextSchema = Type.Optional(Type.Union([Type.String(), Type.Null()]));
const attemptSchema = Type.Integer({
  minimum: 1,
  maximum: AI_MENTOR_CONFIGURATION_GENERATION_MAX_ATTEMPTS,
});
export const aiMentorGeneratedConfigurationTypeSchema = Type.Union([
  Type.Literal(AI_MENTOR_TYPE.TEACHER),
  Type.Literal(AI_MENTOR_TYPE.ROLEPLAY),
]);

const commonDraftProperties = {
  openingInstruction: draftTextSchema,
  additionalInstructions: draftTextSchema,
};

export const aiMentorTeacherConfigurationDraftSchema = Type.Object(
  {
    type: Type.Literal(AI_MENTOR_TYPE.TEACHER),
    taskGoal: draftTextSchema,
    expertise: draftTextSchema,
    contentScope: draftTextSchema,
    teachingStyle: draftTextSchema,
    feedbackGuidance: draftTextSchema,
    ...commonDraftProperties,
  },
  { additionalProperties: false },
);

export const aiMentorRoleplayConfigurationDraftSchema = Type.Object(
  {
    type: Type.Literal(AI_MENTOR_TYPE.ROLEPLAY),
    scenario: draftTextSchema,
    aiRole: draftTextSchema,
    learnerRole: draftTextSchema,
    characterGoal: draftTextSchema,
    difficulty: draftTextSchema,
    factsAndConstraints: draftTextSchema,
    ...commonDraftProperties,
  },
  { additionalProperties: false },
);

export const aiMentorConfigurationDraftSchema = Type.Union([
  aiMentorTeacherConfigurationDraftSchema,
  aiMentorRoleplayConfigurationDraftSchema,
]);

const generatedOptionalTextSchema = Type.Union([Type.String(), Type.Null()]);

export const generatedAiMentorTeacherConfigurationFieldsSchema = Type.Object(
  {
    taskGoal: nonEmptyTextSchema,
    expertise: nonEmptyTextSchema,
    contentScope: nonEmptyTextSchema,
    teachingStyle: Type.Enum(AI_MENTOR_TEACHING_STYLE),
    feedbackGuidance: generatedOptionalTextSchema,
    openingInstruction: generatedOptionalTextSchema,
    additionalInstructions: generatedOptionalTextSchema,
  },
  { additionalProperties: false },
);

export const generatedAiMentorRoleplayConfigurationFieldsSchema = Type.Object(
  {
    scenario: nonEmptyTextSchema,
    aiRole: nonEmptyTextSchema,
    learnerRole: nonEmptyTextSchema,
    characterGoal: nonEmptyTextSchema,
    difficulty: Type.Enum(AI_MENTOR_ROLEPLAY_DIFFICULTY),
    factsAndConstraints: generatedOptionalTextSchema,
    openingInstruction: generatedOptionalTextSchema,
    additionalInstructions: generatedOptionalTextSchema,
  },
  { additionalProperties: false },
);

export const aiMentorGenerationLessonContextSchema = Type.Object(
  {
    title: Type.Optional(Type.String()),
    taskDescription: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

const generationContextProperties = {
  courseId: UUIDSchema,
  lessonId: Type.Optional(UUIDSchema),
  lessonContext: aiMentorGenerationLessonContextSchema,
};

export const aiMentorConfigurationValidationIssueSchema = Type.Object(
  {
    code: nonEmptyTextSchema,
    severity: Type.Enum(AI_MENTOR_CONFIGURATION_VALIDATION_SEVERITY),
    target: Type.Object(
      { field: Type.Enum(AI_MENTOR_CONFIGURATION_FIELD) },
      { additionalProperties: false },
    ),
    message: nonEmptyTextSchema,
    correction: nonEmptyTextSchema,
  },
  { additionalProperties: false },
);

export const aiMentorConfigurationValidatorModelResultSchema = Type.Object(
  {
    summary: Type.String({ minLength: 1, maxLength: 180 }),
    issues: Type.Array(aiMentorConfigurationValidationIssueSchema, {
      maxItems: AI_MENTOR_CONFIGURATION_VALIDATOR_MAX_ISSUES,
    }),
  },
  { additionalProperties: false },
);

export const aiMentorConfigurationValidationResultSchema = Type.Object(
  {
    passed: Type.Boolean(),
    ...aiMentorConfigurationValidatorModelResultSchema.properties,
  },
  { additionalProperties: false },
);

export const generateAiMentorConfigurationInputSchema = Type.Union([
  Type.Object(
    {
      ...generationContextProperties,
      mode: Type.Literal(AI_MENTOR_CONFIGURATION_GENERATION_MODE.CREATE),
      configurationType: aiMentorGeneratedConfigurationTypeSchema,
      brief: nonEmptyTextSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...generationContextProperties,
      mode: Type.Literal(AI_MENTOR_CONFIGURATION_GENERATION_MODE.IMPROVE),
      instruction: nonEmptyTextSchema,
      brief: Type.Optional(nonEmptyTextSchema),
      currentConfiguration: aiMentorConfigurationDraftSchema,
      latestValidation: Type.Optional(aiMentorConfigurationValidationResultSchema),
    },
    { additionalProperties: false },
  ),
]);

export const validateAiMentorConfigurationInputSchema = Type.Object(
  {
    ...generationContextProperties,
    brief: Type.Optional(nonEmptyTextSchema),
    configuration: aiMentorConfigurationDraftSchema,
  },
  { additionalProperties: false },
);

const draftChangeValueSchema = Type.Union([Type.String(), Type.Null()]);

export const aiMentorConfigurationDraftChangeSchema = Type.Object(
  {
    type: Type.Enum(AI_MENTOR_CONFIGURATION_DRAFT_CHANGE_TYPE),
    field: Type.Enum(AI_MENTOR_CONFIGURATION_FIELD),
    before: Type.Optional(draftChangeValueSchema),
    after: Type.Optional(draftChangeValueSchema),
  },
  { additionalProperties: false },
);

export const aiMentorConfigurationGenerationAttemptSchema = Type.Object(
  {
    attempt: attemptSchema,
    changes: Type.Array(aiMentorConfigurationDraftChangeSchema),
    validation: aiMentorConfigurationValidationResultSchema,
  },
  { additionalProperties: false },
);

const attemptHistoryProperties = {
  attemptHistory: Type.Array(aiMentorConfigurationGenerationAttemptSchema),
};

const changesProperties = {
  changes: Type.Optional(Type.Array(aiMentorConfigurationDraftChangeSchema)),
};

const draftingEventSchema = Type.Object(
  {
    status: Type.Literal(AI_MENTOR_CONFIGURATION_GENERATION_STATUS.DRAFTING),
    attempt: attemptSchema,
    ...attemptHistoryProperties,
  },
  { additionalProperties: false },
);

const evaluatingEventSchema = Type.Object(
  {
    status: Type.Literal(AI_MENTOR_CONFIGURATION_GENERATION_STATUS.EVALUATING),
    attempt: attemptSchema,
    draft: aiMentorConfigurationContentSchema,
    ...attemptHistoryProperties,
    ...changesProperties,
  },
  { additionalProperties: false },
);

const revisingEventSchema = Type.Object(
  {
    status: Type.Literal(AI_MENTOR_CONFIGURATION_GENERATION_STATUS.REVISING),
    attempt: attemptSchema,
    draft: aiMentorConfigurationContentSchema,
    validation: aiMentorConfigurationValidationResultSchema,
    ...attemptHistoryProperties,
    ...changesProperties,
  },
  { additionalProperties: false },
);

const awaitingRevisionEventSchema = Type.Object(
  {
    status: Type.Literal(AI_MENTOR_CONFIGURATION_GENERATION_STATUS.AWAITING_REVISION),
    attempt: attemptSchema,
    configuration: aiMentorConfigurationContentSchema,
    validation: aiMentorConfigurationValidationResultSchema,
    ...attemptHistoryProperties,
    ...changesProperties,
  },
  { additionalProperties: false },
);

const completedEventSchema = Type.Object(
  {
    status: Type.Literal(AI_MENTOR_CONFIGURATION_GENERATION_STATUS.COMPLETED),
    attempt: attemptSchema,
    configuration: aiMentorConfigurationContentSchema,
    validation: aiMentorConfigurationValidationResultSchema,
    ...attemptHistoryProperties,
    ...changesProperties,
  },
  { additionalProperties: false },
);

const requiresReviewEventSchema = Type.Object(
  {
    status: Type.Literal(AI_MENTOR_CONFIGURATION_GENERATION_STATUS.REQUIRES_REVIEW),
    attempt: Type.Literal(AI_MENTOR_CONFIGURATION_GENERATION_MAX_ATTEMPTS),
    configuration: aiMentorConfigurationContentSchema,
    validation: aiMentorConfigurationValidationResultSchema,
    ...attemptHistoryProperties,
    ...changesProperties,
  },
  { additionalProperties: false },
);

const failedEventSchema = Type.Object(
  {
    status: Type.Literal(AI_MENTOR_CONFIGURATION_GENERATION_STATUS.FAILED),
    attempt: attemptSchema,
    message: nonEmptyTextSchema,
    configuration: Type.Optional(aiMentorConfigurationContentSchema),
    ...attemptHistoryProperties,
  },
  { additionalProperties: false },
);

const cancelledEventSchema = Type.Object(
  {
    status: Type.Literal(AI_MENTOR_CONFIGURATION_GENERATION_STATUS.CANCELLED),
    attempt: attemptSchema,
    configuration: Type.Optional(aiMentorConfigurationContentSchema),
    ...attemptHistoryProperties,
  },
  { additionalProperties: false },
);

export const aiMentorConfigurationGenerationProgressEventSchema = Type.Union([
  draftingEventSchema,
  evaluatingEventSchema,
  revisingEventSchema,
  awaitingRevisionEventSchema,
  completedEventSchema,
  requiresReviewEventSchema,
  failedEventSchema,
  cancelledEventSchema,
]);

export const aiMentorConfigurationGenerationResultSchema = Type.Union([
  awaitingRevisionEventSchema,
  completedEventSchema,
  requiresReviewEventSchema,
  failedEventSchema,
  cancelledEventSchema,
]);

export const aiMentorConfigurationGenerationSnapshotSchema = Type.Object(
  {
    generationId: UUIDSchema,
    progress: aiMentorConfigurationGenerationProgressEventSchema,
  },
  { additionalProperties: false },
);

export const startAiMentorConfigurationGenerationResponseSchema = Type.Object(
  { generationId: UUIDSchema },
  { additionalProperties: false },
);

export const cancelAiMentorConfigurationGenerationResponseSchema = Type.Object(
  {
    generationId: UUIDSchema,
    cancellationRequested: Type.Literal(true),
  },
  { additionalProperties: false },
);

export type AiMentorTeacherConfigurationDraft = Static<
  typeof aiMentorTeacherConfigurationDraftSchema
>;
export type AiMentorRoleplayConfigurationDraft = Static<
  typeof aiMentorRoleplayConfigurationDraftSchema
>;
export type AiMentorConfigurationDraft = Static<typeof aiMentorConfigurationDraftSchema>;
export type GeneratedAiMentorTeacherConfigurationFields = Static<
  typeof generatedAiMentorTeacherConfigurationFieldsSchema
>;
export type GeneratedAiMentorRoleplayConfigurationFields = Static<
  typeof generatedAiMentorRoleplayConfigurationFieldsSchema
>;
export type GeneratedAiMentorConfigurationFields =
  | GeneratedAiMentorTeacherConfigurationFields
  | GeneratedAiMentorRoleplayConfigurationFields;
export type AiMentorGenerationLessonContext = Static<typeof aiMentorGenerationLessonContextSchema>;
export type AiMentorConfigurationValidationIssue = Static<
  typeof aiMentorConfigurationValidationIssueSchema
>;
export type AiMentorConfigurationValidatorModelResult = Static<
  typeof aiMentorConfigurationValidatorModelResultSchema
>;
export type AiMentorConfigurationValidationResult = Static<
  typeof aiMentorConfigurationValidationResultSchema
>;
export type GenerateAiMentorConfigurationInput = Static<
  typeof generateAiMentorConfigurationInputSchema
>;
export type ValidateAiMentorConfigurationInput = Static<
  typeof validateAiMentorConfigurationInputSchema
>;
export type AiMentorConfigurationDraftChange = Static<
  typeof aiMentorConfigurationDraftChangeSchema
>;
export type AiMentorConfigurationGenerationAttempt = Static<
  typeof aiMentorConfigurationGenerationAttemptSchema
>;
export type AiMentorConfigurationGenerationProgressEvent = Static<
  typeof aiMentorConfigurationGenerationProgressEventSchema
>;
export type AiMentorConfigurationGenerationResult = Static<
  typeof aiMentorConfigurationGenerationResultSchema
>;
export type AiMentorConfigurationGenerationSnapshot = Static<
  typeof aiMentorConfigurationGenerationSnapshotSchema
>;
export type StartAiMentorConfigurationGenerationResponse = Static<
  typeof startAiMentorConfigurationGenerationResponseSchema
>;
export type CancelAiMentorConfigurationGenerationResponse = Static<
  typeof cancelAiMentorConfigurationGenerationResponseSchema
>;
