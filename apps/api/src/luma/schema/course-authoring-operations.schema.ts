/** TypeBox allowlist for the native course, lesson, quiz, Mentor, and settings operations. */
import {
  ASSESSMENT_GRADING_MODES,
  ASSESSMENT_QUESTION_TYPES,
  ASSESSMENT_TEXT_COMPARISON_MODES,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
import { aiJudgeConfigurationContentSchema } from "src/lesson/ai-judge-configuration/ai-judge-configuration.schema";
import {
  aiMentorRoleplayConfigurationContentSchema,
  aiMentorTeacherConfigurationContentSchema,
} from "src/lesson/ai-mentor-configuration/schemas/ai-mentor-configuration.schema";

const strict = { additionalProperties: false };
const text = Type.String();
const nullableText = Type.Union([text, Type.Null()]);
const order = Type.Integer({ minimum: 0 });
const nullableLimit = Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]);

export const authoringQuestionSchema = Type.Object(
  {
    id: UUIDSchema,
    questionType: Type.Enum(ASSESSMENT_QUESTION_TYPES),
    displayOrder: order,
    maximumPoints: Type.String({ pattern: "^\\d+(\\.\\d+)?$" }),
    gradingMode: Type.Enum(ASSESSMENT_GRADING_MODES),
    prompt: text,
    title: text,
    description: nullableText,
    photoS3Key: nullableText,
    options: Type.Array(
      Type.Object(
        { id: UUIDSchema, displayOrder: order, isCorrect: Type.Boolean(), label: text },
        strict,
      ),
    ),
    trueFalseStatements: Type.Array(
      Type.Object(
        { id: UUIDSchema, displayOrder: order, correctValue: Type.Boolean(), statement: text },
        strict,
      ),
    ),
    scaleOptions: Type.Array(
      Type.Object(
        {
          id: UUIDSchema,
          displayOrder: order,
          scaleValue: Type.Integer({ minimum: 1, maximum: 5 }),
          label: text,
        },
        strict,
      ),
    ),
    openTextSettings: Type.Union([
      Type.Object(
        {
          minimumCharacters: Type.Union([order, Type.Null()]),
          maximumCharacters: nullableLimit,
          reviewerInstructions: nullableText,
        },
        strict,
      ),
      Type.Null(),
    ]),
    blanks: Type.Array(
      Type.Object(
        {
          id: UUIDSchema,
          textComparisonMode: Type.Enum(ASSESSMENT_TEXT_COMPARISON_MODES),
          answerSets: Type.Array(
            Type.Object({ preferredAnswer: text, acceptedAnswers: Type.Array(text) }, strict),
          ),
        },
        strict,
      ),
    ),
    dragAndDropOptions: Type.Array(
      Type.Object(
        {
          id: UUIDSchema,
          label: text,
          targetBlankId: Type.Union([UUIDSchema, Type.Null()]),
          displayOrder: order,
        },
        strict,
      ),
    ),
  },
  strict,
);

const contentPayload = Type.Object(
  { lessonType: Type.Literal("content"), title: text, description: text },
  strict,
);
export const quizPayload = Type.Object(
  {
    lessonType: Type.Literal("quiz"),
    title: text,
    description: text,
    thresholdScore: Type.Integer({ minimum: 0, maximum: 100 }),
    attemptsLimit: nullableLimit,
    quizCooldownInHours: Type.Union([order, Type.Null()]),
    questions: Type.Array(authoringQuestionSchema, { minItems: 1 }),
  },
  strict,
);
export const authoringJudgeConfigurationSchema = Type.Object(
  {
    ...aiJudgeConfigurationContentSchema.properties,
    criteria: Type.Array(
      Type.Object(
        {
          ...aiJudgeConfigurationContentSchema.properties.criteria.items.properties,
          ref: Type.String({ pattern: "^C[1-9]\\d*$" }),
          scoreGuidance: Type.Array(
            Type.Required(
              aiJudgeConfigurationContentSchema.properties.criteria.items.properties.scoreGuidance
                .items,
            ),
          ),
        },
        strict,
      ),
    ),
    blockingErrors: Type.Array(
      Type.Object({ description: text, ref: Type.String({ pattern: "^B[1-9]\\d*$" }) }, strict),
    ),
  },
  strict,
);
const mentorCommon = {
  lessonType: Type.Literal("ai_mentor"),
  title: text,
  description: text,
  name: text,
  judgeConfiguration: Type.Union([authoringJudgeConfigurationSchema, Type.Null()]),
  sourceVersionIds: Type.Array(UUIDSchema),
  avatarAssetId: Type.Union([UUIDSchema, Type.Null()]),
  voiceMode: Type.Optional(
    Type.Union([Type.Literal("preset"), Type.Literal("custom"), Type.Null()]),
  ),
  ttsPreset: Type.Optional(Type.Union([Type.Literal("male"), Type.Literal("female"), Type.Null()])),
  customTtsReference: Type.Optional(nullableText),
  preparedResourceIds: Type.Array(text),
};
const mentorPayload = Type.Union([
  Type.Object(
    {
      ...mentorCommon,
      configurationType: Type.Literal("teacher"),
      configuration: Type.Required(Type.Omit(aiMentorTeacherConfigurationContentSchema, ["type"])),
    },
    strict,
  ),
  Type.Object(
    {
      ...mentorCommon,
      configurationType: Type.Literal("roleplay"),
      configuration: Type.Required(Type.Omit(aiMentorRoleplayConfigurationContentSchema, ["type"])),
    },
    strict,
  ),
]);
const operationBase = {
  operationId: UUIDSchema,
  targetId: UUIDSchema,
  language: Type.Enum(SUPPORTED_LANGUAGES),
  baselineHash: Type.Union([Type.String({ pattern: "^[0-9a-f]{64}$" }), Type.Null()]),
  dependencies: Type.Array(UUIDSchema),
  fieldBaselines: Type.Optional(
    Type.Record(Type.String(), Type.String({ pattern: "^[0-9a-f]{64}$" })),
  ),
};
const lessonWrite = Type.Object(
  {
    ...operationBase,
    type: Type.Union([Type.Literal("lesson.create"), Type.Literal("lesson.update")]),
    chapterId: UUIDSchema,
    displayOrder: Type.Optional(order),
    payload: Type.Union([contentPayload, quizPayload, mentorPayload]),
  },
  strict,
);
const metadataUpdate = Type.Object(
  {
    ...operationBase,
    type: Type.Literal("course.metadata.update"),
    payload: Type.Object(
      {
        title: Type.Optional(nullableText),
        description: Type.Optional(nullableText),
        learningOutcomes: Type.Optional(Type.Union([Type.Array(text), Type.Null()])),
        thumbnailAssetId: Type.Optional(Type.Union([UUIDSchema, Type.Null()])),
      },
      { ...strict, minProperties: 1 },
    ),
  },
  strict,
);
const settingsUpdate = Type.Object(
  {
    ...operationBase,
    type: Type.Literal("course.settings.update"),
    payload: Type.Object(
      {
        lessonSequenceEnabled: Type.Optional(Type.Boolean()),
        quizFeedbackEnabled: Type.Optional(Type.Boolean()),
        videoCompletionTrackingEnabled: Type.Optional(Type.Boolean()),
        certificateFontColor: Type.Optional(text),
        certificateValidity: Type.Optional(
          Type.Union([
            Type.Object(
              {
                type: Type.Literal("period"),
                value: Type.Integer({ minimum: 1 }),
                unit: Type.Union([
                  Type.Literal("days"),
                  Type.Literal("months"),
                  Type.Literal("years"),
                ]),
              },
              strict,
            ),
            Type.Object({ type: Type.Literal("fixed_date"), date: text }, strict),
            Type.Null(),
          ]),
        ),
        applyValidityToExistingCertificates: Type.Optional(Type.Boolean()),
        removeCertificateSignature: Type.Optional(Type.Boolean()),
        certificateSignatureAssetId: Type.Optional(UUIDSchema),
      },
      { ...strict, minProperties: 1 },
    ),
  },
  strict,
);
export const authoringOperationSchema = Type.Union([
  lessonWrite,
  Type.Object(
    {
      ...operationBase,
      type: Type.Literal("lesson.metadata.update"),
      payload: Type.Object(
        {
          title: Type.Optional(Type.String({ minLength: 1 })),
          description: Type.Optional(text),
        },
        { ...strict, minProperties: 1 },
      ),
    },
    strict,
  ),
  metadataUpdate,
  settingsUpdate,
  Type.Object(
    {
      ...operationBase,
      type: Type.Literal("lesson.block.replace"),
      payload: Type.Object({ blockId: UUIDSchema, html: text }, strict),
    },
    strict,
  ),
  Type.Object(
    {
      ...operationBase,
      type: Type.Union([Type.Literal("chapter.create"), Type.Literal("chapter.update")]),
      payload: Type.Object({ title: text, displayOrder: order }, strict),
    },
    strict,
  ),
  Type.Object(
    {
      ...operationBase,
      type: Type.Union([Type.Literal("chapter.delete"), Type.Literal("lesson.delete")]),
    },
    strict,
  ),
  Type.Object(
    {
      ...operationBase,
      type: Type.Union([Type.Literal("chapter.reorder"), Type.Literal("lesson.reorder")]),
      payload: Type.Object({ orderedIds: Type.Array(UUIDSchema, { uniqueItems: true }) }, strict),
    },
    strict,
  ),
]);

export type AuthoringOperation = Static<typeof authoringOperationSchema>;
export type AuthoringQuestion = Static<typeof authoringQuestionSchema>;
