import { AI_JUDGE_MAX_CRITERION_SCORE, SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import type { Static } from "@sinclair/typebox";

const nonEmptyTextSchema = Type.String({ minLength: 1 });
const scoreSchema = Type.Integer({ minimum: 0 });
const maxScoreSchema = Type.Integer({ minimum: 1, maximum: AI_JUDGE_MAX_CRITERION_SCORE });
const passingThresholdSchema = Type.Integer({ minimum: 0, maximum: 100 });

const aiJudgeScoreGuidanceInputSchema = Type.Object(
  {
    id: Type.Optional(UUIDSchema),
    score: scoreSchema,
    description: nonEmptyTextSchema,
    example: Type.Optional(Type.Union([nonEmptyTextSchema, Type.Null()])),
  },
  { additionalProperties: false },
);

const aiJudgeCriterionInputSchema = Type.Object(
  {
    id: Type.Optional(UUIDSchema),
    title: nonEmptyTextSchema,
    expectedBehavior: nonEmptyTextSchema,
    maxScore: maxScoreSchema,
    scoreGuidance: Type.Array(aiJudgeScoreGuidanceInputSchema, { minItems: 1 }),
  },
  { additionalProperties: false },
);

const aiJudgeBlockingErrorInputSchema = Type.Object(
  { id: Type.Optional(UUIDSchema), description: nonEmptyTextSchema },
  { additionalProperties: false },
);

export const aiJudgeConfigurationInputSchema = Type.Object(
  {
    taskGoal: nonEmptyTextSchema,
    passingThresholdPercent: passingThresholdSchema,
    criteria: Type.Array(aiJudgeCriterionInputSchema),
    blockingErrors: Type.Array(aiJudgeBlockingErrorInputSchema),
  },
  { additionalProperties: false },
);

const aiJudgeScoreGuidanceResponseSchema = Type.Object({
  id: UUIDSchema,
  score: scoreSchema,
  description: Type.String(),
  example: Type.Union([Type.String(), Type.Null()]),
});

const aiJudgeCriterionResponseSchema = Type.Object({
  id: UUIDSchema,
  title: Type.String(),
  expectedBehavior: Type.String(),
  maxScore: maxScoreSchema,
  scoreGuidance: Type.Array(aiJudgeScoreGuidanceResponseSchema),
});

const aiJudgeBlockingErrorResponseSchema = Type.Object({
  id: UUIDSchema,
  description: Type.String(),
});

export const aiJudgeConfigurationResponseSchema = Type.Object({
  id: UUIDSchema,
  aiMentorLessonId: UUIDSchema,
  hasMissingTranslations: Type.Boolean(),
  taskGoal: Type.String(),
  passingThresholdPercent: passingThresholdSchema,
  totalMaxScore: scoreSchema,
  criteria: Type.Array(aiJudgeCriterionResponseSchema),
  blockingErrors: Type.Array(aiJudgeBlockingErrorResponseSchema),
  language: Type.Enum(SUPPORTED_LANGUAGES),
  baseLanguage: Type.Enum(SUPPORTED_LANGUAGES),
  availableLocales: Type.Array(Type.Enum(SUPPORTED_LANGUAGES)),
});

const criterionTranslationSchema = Type.Object(
  {
    id: UUIDSchema,
    title: Type.Optional(nonEmptyTextSchema),
    expectedBehavior: Type.Optional(nonEmptyTextSchema),
  },
  { additionalProperties: false, minProperties: 2 },
);

const scoreGuidanceTranslationSchema = Type.Object(
  {
    id: UUIDSchema,
    description: Type.Optional(nonEmptyTextSchema),
    example: Type.Optional(Type.Union([nonEmptyTextSchema, Type.Null()])),
  },
  { additionalProperties: false, minProperties: 2 },
);

const blockingErrorTranslationSchema = Type.Object(
  {
    id: UUIDSchema,
    description: nonEmptyTextSchema,
  },
  { additionalProperties: false },
);

export const updateAiJudgeConfigurationTranslationSchema = Type.Object(
  {
    taskGoal: Type.Optional(nonEmptyTextSchema),
    criteria: Type.Optional(Type.Array(criterionTranslationSchema)),
    scoreGuidance: Type.Optional(Type.Array(scoreGuidanceTranslationSchema)),
    blockingErrors: Type.Optional(Type.Array(blockingErrorTranslationSchema)),
  },
  { additionalProperties: false, minProperties: 1 },
);

export type AiJudgeConfigurationInput = Static<typeof aiJudgeConfigurationInputSchema>;
export type AiJudgeCriterionInput = AiJudgeConfigurationInput["criteria"][number];
export type AiJudgeScoreGuidanceInput = AiJudgeCriterionInput["scoreGuidance"][number];
export type AiJudgeBlockingErrorInput = AiJudgeConfigurationInput["blockingErrors"][number];
export type UpdateAiJudgeConfigurationTranslationBody = Static<
  typeof updateAiJudgeConfigurationTranslationSchema
>;
export type AiJudgeConfigurationResponse = Static<typeof aiJudgeConfigurationResponseSchema>;
