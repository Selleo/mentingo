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
  AI_JUDGE_CRITERION_REF_PATTERN,
  AI_JUDGE_DRAFT_CHANGE_TYPE,
  AI_JUDGE_GENERATION_MAX_ATTEMPTS,
  AI_JUDGE_GENERATION_MODE,
  AI_JUDGE_GENERATION_STATUS,
  AI_JUDGE_VALIDATION_SEVERITY,
  AI_JUDGE_VALIDATION_TARGET,
} from "./ai-judge-configuration-generation.types";

import type { Static } from "@sinclair/typebox";

const nonEmptyTextSchema = Type.String({ minLength: 1 });
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

export const referencedAiJudgeConfigurationSchema = Type.Object(
  {
    ...aiJudgeConfigurationContentSchema.properties,
    criteria: Type.Array(referencedCriterionSchema),
    blockingErrors: Type.Array(referencedBlockingErrorSchema),
  },
  { additionalProperties: false },
);

export const generatedAiJudgeConfigurationSchema = aiJudgeConfigurationContentSchema;

const lessonContextSchema = Type.Object(
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
  lessonContext: lessonContextSchema,
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
    severity: Type.Union([
      Type.Literal(AI_JUDGE_VALIDATION_SEVERITY.ERROR),
      Type.Literal(AI_JUDGE_VALIDATION_SEVERITY.WARNING),
    ]),
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

export const aiJudgeConfigurationValidationResultSchema = Type.Object(
  {
    passed: Type.Boolean(),
    summary: nonEmptyTextSchema,
    issues: Type.Array(aiJudgeValidationIssueSchema),
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
    type: Type.Union([
      Type.Literal(AI_JUDGE_DRAFT_CHANGE_TYPE.ADDED),
      Type.Literal(AI_JUDGE_DRAFT_CHANGE_TYPE.REMOVED),
      Type.Literal(AI_JUDGE_DRAFT_CHANGE_TYPE.CHANGED),
    ]),
    targetRef: Type.Union([
      aiJudgeCriterionRefSchema,
      aiJudgeBlockingErrorRefSchema,
      Type.Literal(AI_JUDGE_VALIDATION_TARGET.CONFIGURATION),
    ]),
    field: nonEmptyTextSchema,
    before: Type.Optional(draftChangeValueSchema),
    after: Type.Optional(draftChangeValueSchema),
  },
  { additionalProperties: false },
);

const draftingEventSchema = Type.Object(
  {
    status: Type.Literal(AI_JUDGE_GENERATION_STATUS.DRAFTING),
    attempt: attemptSchema,
  },
  { additionalProperties: false },
);

const evaluatingEventSchema = Type.Object(
  {
    status: Type.Literal(AI_JUDGE_GENERATION_STATUS.EVALUATING),
    attempt: attemptSchema,
    draft: referencedAiJudgeConfigurationSchema,
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
  },
  { additionalProperties: false },
);

const completedEventSchema = Type.Object(
  {
    status: Type.Literal(AI_JUDGE_GENERATION_STATUS.COMPLETED),
    attempt: attemptSchema,
    configuration: generatedAiJudgeConfigurationSchema,
    validation: aiJudgeConfigurationValidationResultSchema,
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
  },
  { additionalProperties: false },
);

const cancelledEventSchema = Type.Object(
  {
    status: Type.Literal(AI_JUDGE_GENERATION_STATUS.CANCELLED),
    attempt: attemptSchema,
    configuration: Type.Optional(generatedAiJudgeConfigurationSchema),
  },
  { additionalProperties: false },
);

export const aiJudgeGenerationProgressEventSchema = Type.Union([
  draftingEventSchema,
  evaluatingEventSchema,
  revisingEventSchema,
  completedEventSchema,
  requiresReviewEventSchema,
  failedEventSchema,
  cancelledEventSchema,
]);

export const aiJudgeGenerationResultSchema = Type.Union([
  completedEventSchema,
  requiresReviewEventSchema,
  failedEventSchema,
  cancelledEventSchema,
]);

export type ReferencedAiJudgeConfiguration = Static<typeof referencedAiJudgeConfigurationSchema>;
export type GeneratedAiJudgeConfiguration = Static<typeof generatedAiJudgeConfigurationSchema>;
export type AiJudgeValidationIssue = Static<typeof aiJudgeValidationIssueSchema>;
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
export type AiJudgeGenerationProgressEvent = Static<typeof aiJudgeGenerationProgressEventSchema>;
export type AiJudgeGenerationResult = Static<typeof aiJudgeGenerationResultSchema>;
export type CreateAiJudgeConfigurationInput = Extract<
  GenerateAiJudgeConfigurationInput,
  { mode: "create" }
>;
export type ImproveAiJudgeConfigurationInput = Extract<
  GenerateAiJudgeConfigurationInput,
  { mode: "improve" }
>;
