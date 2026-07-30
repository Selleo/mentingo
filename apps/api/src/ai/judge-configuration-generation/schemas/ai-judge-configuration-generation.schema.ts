import { AI_MENTOR_TYPE } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
import {
  aiJudgeBlockingErrorContentSchema,
  aiJudgeConfigurationContentSchema,
  aiJudgeConfigurationInputSchema,
  aiJudgeCriterionContentSchema,
  aiJudgeScoreGuidanceContentSchema,
} from "src/lesson/ai-judge-configuration/ai-judge-configuration.schema";

import {
  AI_JUDGE_BLOCKING_ERROR_REF_PATTERN,
  AI_JUDGE_CONFIGURATION_VALIDATOR_MAX_ISSUES,
  AI_JUDGE_CRITERION_REF_PATTERN,
} from "../ai-judge-configuration-generation.constants";
import {
  AI_JUDGE_DRAFT_CHANGE_TYPE,
  AI_JUDGE_DRAFT_CHANGE_FIELD,
  AI_JUDGE_GENERATION_MAX_ATTEMPTS,
  AI_JUDGE_GENERATION_MODE,
  AI_JUDGE_GENERATION_STATUS,
  AI_JUDGE_VALIDATION_SEVERITY,
  AI_JUDGE_VALIDATION_TARGET,
} from "../ai-judge-configuration-generation.types";

import type { Static } from "@sinclair/typebox";

const nonEmptyTextSchema = Type.String({ minLength: 1 });
const generatedTaskGoalSchema = Type.String({ minLength: 1 });
const generatedCriterionTitleSchema = Type.String({ minLength: 1, maxLength: 80 });
const generatedExpectedBehaviorSchema = Type.String({ minLength: 1 });
const generatedGuidanceDescriptionSchema = Type.String({ minLength: 1 });
const generatedGuidanceExampleSchema = Type.String({ minLength: 1 });
const generatedBlockingErrorSchema = Type.String({ minLength: 1 });
const validatorSummarySchema = Type.String({ minLength: 1, maxLength: 180 });
const validatorMessageSchema = Type.String({ minLength: 1, maxLength: 160 });
const validatorCorrectionSchema = Type.String({ minLength: 1, maxLength: 220 });
const attemptSchema = Type.Integer({ minimum: 1, maximum: AI_JUDGE_GENERATION_MAX_ATTEMPTS });

export const aiJudgeCriterionRefSchema = Type.String({
  pattern: AI_JUDGE_CRITERION_REF_PATTERN,
});
export const aiJudgeBlockingErrorRefSchema = Type.String({
  pattern: AI_JUDGE_BLOCKING_ERROR_REF_PATTERN,
});

const referencedCriterionSchema = Type.Object(
  {
    ref: aiJudgeCriterionRefSchema,
    ...aiJudgeCriterionContentSchema.properties,
  },
  { additionalProperties: false },
);

const referencedBlockingErrorSchema = Type.Object(
  {
    ref: aiJudgeBlockingErrorRefSchema,
    ...aiJudgeBlockingErrorContentSchema.properties,
  },
  { additionalProperties: false },
);

const referencedScoreGuidanceStructuredOutputSchema = Type.Object(
  {
    score: aiJudgeScoreGuidanceContentSchema.properties.score,
    description: generatedGuidanceDescriptionSchema,
    example: Type.Union([generatedGuidanceExampleSchema, Type.Null()]),
  },
  { additionalProperties: false },
);

const referencedCriterionStructuredOutputSchema = Type.Object(
  {
    ref: aiJudgeCriterionRefSchema,
    title: generatedCriterionTitleSchema,
    expectedBehavior: generatedExpectedBehaviorSchema,
    maxScore: aiJudgeCriterionContentSchema.properties.maxScore,
    scoreGuidance: Type.Array(referencedScoreGuidanceStructuredOutputSchema, { minItems: 1 }),
  },
  { additionalProperties: false },
);

const referencedBlockingErrorStructuredOutputSchema = Type.Object(
  {
    ref: aiJudgeBlockingErrorRefSchema,
    description: generatedBlockingErrorSchema,
  },
  { additionalProperties: false },
);

export const referencedAiJudgeConfigurationSchema = Type.Object(
  {
    ...aiJudgeConfigurationContentSchema.properties,
    criteria: Type.Array(referencedCriterionSchema),
    blockingErrors: Type.Array(referencedBlockingErrorSchema),
  },
  { additionalProperties: false },
);

export const referencedAiJudgeConfigurationStructuredOutputSchema = Type.Object(
  {
    ...aiJudgeConfigurationContentSchema.properties,
    taskGoal: generatedTaskGoalSchema,
    criteria: Type.Array(referencedCriterionStructuredOutputSchema),
    blockingErrors: Type.Array(referencedBlockingErrorStructuredOutputSchema),
  },
  { additionalProperties: false },
);

export const generatedAiJudgeConfigurationSchema = aiJudgeConfigurationContentSchema;

export const aiJudgeGenerationLessonContextSchema = Type.Object(
  {
    title: Type.Optional(Type.String()),
    taskDescription: Type.Optional(Type.String()),
    aiMentorInstructions: Type.Optional(Type.String()),
    aiMentorType: Type.Enum(AI_MENTOR_TYPE),
  },
  { additionalProperties: false },
);

const generationContextProperties = {
  courseId: UUIDSchema,
  lessonId: Type.Optional(UUIDSchema),
  lessonContext: aiJudgeGenerationLessonContextSchema,
};

const configurationValidationTargetSchema = Type.Object(
  {
    type: Type.Literal(AI_JUDGE_VALIDATION_TARGET.CONFIGURATION),
    field: Type.Optional(nonEmptyTextSchema),
  },
  { additionalProperties: false },
);

const criterionValidationTargetSchema = Type.Object(
  {
    type: Type.Literal(AI_JUDGE_VALIDATION_TARGET.CRITERION),
    ref: aiJudgeCriterionRefSchema,
    field: Type.Optional(nonEmptyTextSchema),
  },
  { additionalProperties: false },
);

const scoreGuidanceValidationTargetSchema = Type.Object(
  {
    type: Type.Literal(AI_JUDGE_VALIDATION_TARGET.SCORE_GUIDANCE),
    ref: aiJudgeCriterionRefSchema,
    score: aiJudgeScoreGuidanceContentSchema.properties.score,
    field: Type.Optional(nonEmptyTextSchema),
  },
  { additionalProperties: false },
);

const blockingErrorValidationTargetSchema = Type.Object(
  {
    type: Type.Literal(AI_JUDGE_VALIDATION_TARGET.BLOCKING_ERROR),
    ref: aiJudgeBlockingErrorRefSchema,
    field: Type.Optional(nonEmptyTextSchema),
  },
  { additionalProperties: false },
);

export const aiJudgeValidationIssueSchema = Type.Object(
  {
    code: nonEmptyTextSchema,
    severity: Type.Enum(AI_JUDGE_VALIDATION_SEVERITY),
    target: Type.Union([
      configurationValidationTargetSchema,
      criterionValidationTargetSchema,
      scoreGuidanceValidationTargetSchema,
      blockingErrorValidationTargetSchema,
    ]),
    message: nonEmptyTextSchema,
    correction: nonEmptyTextSchema,
  },
  { additionalProperties: false },
);

export const aiJudgeConfigurationValidatorModelResultSchema = Type.Object(
  {
    summary: validatorSummarySchema,
    issues: Type.Array(aiJudgeValidationIssueSchema, {
      maxItems: AI_JUDGE_CONFIGURATION_VALIDATOR_MAX_ISSUES,
    }),
  },
  { additionalProperties: false },
);

const structuredOutputFieldSchema = Type.Union([nonEmptyTextSchema, Type.Null()]);
const structuredOutputValidationTargetSchema = Type.Union([
  Type.Object(
    {
      type: Type.Literal(AI_JUDGE_VALIDATION_TARGET.CONFIGURATION),
      field: structuredOutputFieldSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      type: Type.Literal(AI_JUDGE_VALIDATION_TARGET.CRITERION),
      ref: aiJudgeCriterionRefSchema,
      field: structuredOutputFieldSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      type: Type.Literal(AI_JUDGE_VALIDATION_TARGET.SCORE_GUIDANCE),
      ref: aiJudgeCriterionRefSchema,
      score: aiJudgeScoreGuidanceContentSchema.properties.score,
      field: structuredOutputFieldSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      type: Type.Literal(AI_JUDGE_VALIDATION_TARGET.BLOCKING_ERROR),
      ref: aiJudgeBlockingErrorRefSchema,
      field: structuredOutputFieldSchema,
    },
    { additionalProperties: false },
  ),
]);

export const aiJudgeConfigurationValidatorStructuredOutputSchema = Type.Object(
  {
    summary: validatorSummarySchema,
    issues: Type.Array(
      Type.Object(
        {
          code: nonEmptyTextSchema,
          severity: Type.Enum(AI_JUDGE_VALIDATION_SEVERITY),
          target: structuredOutputValidationTargetSchema,
          message: validatorMessageSchema,
          correction: validatorCorrectionSchema,
        },
        { additionalProperties: false },
      ),
      { maxItems: AI_JUDGE_CONFIGURATION_VALIDATOR_MAX_ISSUES },
    ),
  },
  { additionalProperties: false },
);

export const aiJudgeConfigurationValidationResultSchema = Type.Object(
  {
    passed: Type.Boolean(),
    ...aiJudgeConfigurationValidatorModelResultSchema.properties,
  },
  { additionalProperties: false },
);

export const generateAiJudgeConfigurationInputSchema = Type.Union([
  Type.Object(
    {
      ...generationContextProperties,
      mode: Type.Literal(AI_JUDGE_GENERATION_MODE.CREATE),
      brief: nonEmptyTextSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...generationContextProperties,
      mode: Type.Literal(AI_JUDGE_GENERATION_MODE.IMPROVE),
      instruction: nonEmptyTextSchema,
      brief: Type.Optional(nonEmptyTextSchema),
      currentConfiguration: aiJudgeConfigurationInputSchema,
      latestValidation: Type.Optional(aiJudgeConfigurationValidationResultSchema),
    },
    { additionalProperties: false },
  ),
]);

export const validateAiJudgeConfigurationInputSchema = Type.Object(
  {
    ...generationContextProperties,
    brief: Type.Optional(nonEmptyTextSchema),
    configuration: aiJudgeConfigurationInputSchema,
  },
  { additionalProperties: false },
);

const draftChangeValueSchema = Type.Union([Type.String(), Type.Number(), Type.Null()]);

export const aiJudgeDraftChangeSchema = Type.Object(
  {
    type: Type.Enum(AI_JUDGE_DRAFT_CHANGE_TYPE),
    targetRef: Type.Union([
      aiJudgeCriterionRefSchema,
      aiJudgeBlockingErrorRefSchema,
      Type.Literal(AI_JUDGE_VALIDATION_TARGET.CONFIGURATION),
    ]),
    score: Type.Optional(aiJudgeScoreGuidanceContentSchema.properties.score),
    field: Type.Enum(AI_JUDGE_DRAFT_CHANGE_FIELD),
    before: Type.Optional(draftChangeValueSchema),
    after: Type.Optional(draftChangeValueSchema),
  },
  { additionalProperties: false },
);

export const aiJudgeGenerationAttemptSchema = Type.Object(
  {
    attempt: attemptSchema,
    changes: Type.Array(aiJudgeDraftChangeSchema),
    validation: aiJudgeConfigurationValidationResultSchema,
  },
  { additionalProperties: false },
);

const attemptHistoryProperties = {
  attemptHistory: Type.Array(aiJudgeGenerationAttemptSchema),
};

const draftingEventSchema = Type.Object(
  {
    status: Type.Literal(AI_JUDGE_GENERATION_STATUS.DRAFTING),
    attempt: attemptSchema,
    ...attemptHistoryProperties,
  },
  { additionalProperties: false },
);

const evaluatingEventSchema = Type.Object(
  {
    status: Type.Literal(AI_JUDGE_GENERATION_STATUS.EVALUATING),
    attempt: attemptSchema,
    draft: referencedAiJudgeConfigurationSchema,
    ...attemptHistoryProperties,
    changes: Type.Optional(Type.Array(aiJudgeDraftChangeSchema)),
  },
  { additionalProperties: false },
);

const revisingEventSchema = Type.Object(
  {
    status: Type.Literal(AI_JUDGE_GENERATION_STATUS.REVISING),
    attempt: attemptSchema,
    draft: referencedAiJudgeConfigurationSchema,
    validation: aiJudgeConfigurationValidationResultSchema,
    ...attemptHistoryProperties,
    changes: Type.Optional(Type.Array(aiJudgeDraftChangeSchema)),
  },
  { additionalProperties: false },
);

const awaitingRevisionEventSchema = Type.Object(
  {
    status: Type.Literal(AI_JUDGE_GENERATION_STATUS.AWAITING_REVISION),
    attempt: attemptSchema,
    configuration: generatedAiJudgeConfigurationSchema,
    validation: aiJudgeConfigurationValidationResultSchema,
    ...attemptHistoryProperties,
    changes: Type.Optional(Type.Array(aiJudgeDraftChangeSchema)),
  },
  { additionalProperties: false },
);

const completedEventSchema = Type.Object(
  {
    status: Type.Literal(AI_JUDGE_GENERATION_STATUS.COMPLETED),
    attempt: attemptSchema,
    configuration: generatedAiJudgeConfigurationSchema,
    validation: aiJudgeConfigurationValidationResultSchema,
    ...attemptHistoryProperties,
    changes: Type.Optional(Type.Array(aiJudgeDraftChangeSchema)),
  },
  { additionalProperties: false },
);

const requiresReviewEventSchema = Type.Object(
  {
    status: Type.Literal(AI_JUDGE_GENERATION_STATUS.REQUIRES_REVIEW),
    attempt: Type.Literal(AI_JUDGE_GENERATION_MAX_ATTEMPTS),
    configuration: generatedAiJudgeConfigurationSchema,
    validation: aiJudgeConfigurationValidationResultSchema,
    ...attemptHistoryProperties,
    changes: Type.Optional(Type.Array(aiJudgeDraftChangeSchema)),
  },
  { additionalProperties: false },
);

const failedEventSchema = Type.Object(
  {
    status: Type.Literal(AI_JUDGE_GENERATION_STATUS.FAILED),
    attempt: attemptSchema,
    message: nonEmptyTextSchema,
    configuration: Type.Optional(generatedAiJudgeConfigurationSchema),
    ...attemptHistoryProperties,
  },
  { additionalProperties: false },
);

const cancelledEventSchema = Type.Object(
  {
    status: Type.Literal(AI_JUDGE_GENERATION_STATUS.CANCELLED),
    attempt: attemptSchema,
    configuration: Type.Optional(generatedAiJudgeConfigurationSchema),
    ...attemptHistoryProperties,
  },
  { additionalProperties: false },
);

export const aiJudgeGenerationProgressEventSchema = Type.Union([
  draftingEventSchema,
  evaluatingEventSchema,
  revisingEventSchema,
  awaitingRevisionEventSchema,
  completedEventSchema,
  requiresReviewEventSchema,
  failedEventSchema,
  cancelledEventSchema,
]);

export const aiJudgeGenerationResultSchema = Type.Union([
  awaitingRevisionEventSchema,
  completedEventSchema,
  requiresReviewEventSchema,
  failedEventSchema,
  cancelledEventSchema,
]);

const completedApplicationResultSchema = Type.Object(
  {
    status: Type.Literal(AI_JUDGE_GENERATION_STATUS.COMPLETED),
    attempt: attemptSchema,
    configuration: aiJudgeConfigurationInputSchema,
    validation: aiJudgeConfigurationValidationResultSchema,
    ...attemptHistoryProperties,
    changes: Type.Optional(Type.Array(aiJudgeDraftChangeSchema)),
  },
  { additionalProperties: false },
);

const awaitingRevisionApplicationResultSchema = Type.Object(
  {
    status: Type.Literal(AI_JUDGE_GENERATION_STATUS.AWAITING_REVISION),
    attempt: attemptSchema,
    configuration: aiJudgeConfigurationInputSchema,
    validation: aiJudgeConfigurationValidationResultSchema,
    ...attemptHistoryProperties,
    changes: Type.Optional(Type.Array(aiJudgeDraftChangeSchema)),
  },
  { additionalProperties: false },
);

const requiresReviewApplicationResultSchema = Type.Object(
  {
    status: Type.Literal(AI_JUDGE_GENERATION_STATUS.REQUIRES_REVIEW),
    attempt: Type.Literal(AI_JUDGE_GENERATION_MAX_ATTEMPTS),
    configuration: aiJudgeConfigurationInputSchema,
    validation: aiJudgeConfigurationValidationResultSchema,
    ...attemptHistoryProperties,
    changes: Type.Optional(Type.Array(aiJudgeDraftChangeSchema)),
  },
  { additionalProperties: false },
);

const failedApplicationResultSchema = Type.Object(
  {
    status: Type.Literal(AI_JUDGE_GENERATION_STATUS.FAILED),
    attempt: attemptSchema,
    message: nonEmptyTextSchema,
    configuration: Type.Optional(aiJudgeConfigurationInputSchema),
    ...attemptHistoryProperties,
  },
  { additionalProperties: false },
);

const cancelledApplicationResultSchema = Type.Object(
  {
    status: Type.Literal(AI_JUDGE_GENERATION_STATUS.CANCELLED),
    attempt: attemptSchema,
    configuration: Type.Optional(aiJudgeConfigurationInputSchema),
    ...attemptHistoryProperties,
  },
  { additionalProperties: false },
);

export const aiJudgeGenerationApplicationResultSchema = Type.Union([
  awaitingRevisionApplicationResultSchema,
  completedApplicationResultSchema,
  requiresReviewApplicationResultSchema,
  failedApplicationResultSchema,
  cancelledApplicationResultSchema,
]);

const evaluatingApplicationEventSchema = Type.Object(
  {
    status: Type.Literal(AI_JUDGE_GENERATION_STATUS.EVALUATING),
    attempt: attemptSchema,
    draft: aiJudgeConfigurationInputSchema,
    ...attemptHistoryProperties,
    changes: Type.Optional(Type.Array(aiJudgeDraftChangeSchema)),
  },
  { additionalProperties: false },
);

const revisingApplicationEventSchema = Type.Object(
  {
    status: Type.Literal(AI_JUDGE_GENERATION_STATUS.REVISING),
    attempt: attemptSchema,
    draft: aiJudgeConfigurationInputSchema,
    validation: aiJudgeConfigurationValidationResultSchema,
    ...attemptHistoryProperties,
    changes: Type.Optional(Type.Array(aiJudgeDraftChangeSchema)),
  },
  { additionalProperties: false },
);

export const aiJudgeGenerationApplicationProgressEventSchema = Type.Union([
  draftingEventSchema,
  evaluatingApplicationEventSchema,
  revisingApplicationEventSchema,
  awaitingRevisionApplicationResultSchema,
  completedApplicationResultSchema,
  requiresReviewApplicationResultSchema,
  failedApplicationResultSchema,
  cancelledApplicationResultSchema,
]);

export const aiJudgeGenerationSnapshotSchema = Type.Object(
  {
    generationId: UUIDSchema,
    progress: aiJudgeGenerationApplicationProgressEventSchema,
  },
  { additionalProperties: false },
);

export const startAiJudgeGenerationResponseSchema = Type.Object(
  { generationId: UUIDSchema },
  { additionalProperties: false },
);

export const cancelAiJudgeGenerationResponseSchema = Type.Object(
  {
    generationId: UUIDSchema,
    cancellationRequested: Type.Literal(true),
  },
  { additionalProperties: false },
);

export type ReferencedAiJudgeConfiguration = Static<typeof referencedAiJudgeConfigurationSchema>;
export type GeneratedAiJudgeConfiguration = Static<typeof generatedAiJudgeConfigurationSchema>;
export type AiJudgeGenerationLessonContext = Static<typeof aiJudgeGenerationLessonContextSchema>;
export type AiJudgeValidationIssue = Static<typeof aiJudgeValidationIssueSchema>;
export type AiJudgeConfigurationValidatorModelResult = Static<
  typeof aiJudgeConfigurationValidatorModelResultSchema
>;
export type AiJudgeConfigurationValidatorStructuredOutput = Static<
  typeof aiJudgeConfigurationValidatorStructuredOutputSchema
>;
export type AiJudgeConfigurationValidationResult = Static<
  typeof aiJudgeConfigurationValidationResultSchema
>;
export type GenerateAiJudgeConfigurationInput = Static<
  typeof generateAiJudgeConfigurationInputSchema
>;
export type ValidateAiJudgeConfigurationInput = Static<
  typeof validateAiJudgeConfigurationInputSchema
>;
export type AiJudgeDraftChange = Static<typeof aiJudgeDraftChangeSchema>;
export type AiJudgeGenerationAttempt = Static<typeof aiJudgeGenerationAttemptSchema>;
export type AiJudgeGenerationProgressEvent = Static<typeof aiJudgeGenerationProgressEventSchema>;
export type AiJudgeGenerationResult = Static<typeof aiJudgeGenerationResultSchema>;
export type AiJudgeGenerationApplicationResult = Static<
  typeof aiJudgeGenerationApplicationResultSchema
>;
export type AiJudgeGenerationApplicationProgressEvent = Static<
  typeof aiJudgeGenerationApplicationProgressEventSchema
>;
export type AiJudgeGenerationSnapshot = Static<typeof aiJudgeGenerationSnapshotSchema>;
export type StartAiJudgeGenerationResponse = Static<typeof startAiJudgeGenerationResponseSchema>;
export type CancelAiJudgeGenerationResponse = Static<typeof cancelAiJudgeGenerationResponseSchema>;
export type CreateAiJudgeConfigurationInput = Extract<
  GenerateAiJudgeConfigurationInput,
  { mode: typeof AI_JUDGE_GENERATION_MODE.CREATE }
>;
export type ImproveAiJudgeConfigurationInput = Extract<
  GenerateAiJudgeConfigurationInput,
  { mode: typeof AI_JUDGE_GENERATION_MODE.IMPROVE }
>;
