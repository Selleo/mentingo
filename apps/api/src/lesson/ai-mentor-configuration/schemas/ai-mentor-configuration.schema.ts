import {
  AI_MENTOR_ROLEPLAY_DIFFICULTY,
  AI_MENTOR_TEACHING_STYLE,
  AI_MENTOR_TYPE,
} from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

import type {
  AiMentorRoleplayDifficulty,
  AiMentorTeachingStyle,
  SupportedLanguages,
} from "@repo/shared";
import type { UUIDType } from "src/common";

const nonEmptyTextSchema = Type.String({ minLength: 1 });
const optionalTextSchema = Type.Optional(Type.Union([nonEmptyTextSchema, Type.Null()]));

const commonContentProperties = {
  openingInstruction: optionalTextSchema,
  additionalInstructions: optionalTextSchema,
};

export const aiMentorTeacherConfigurationContentSchema = Type.Object(
  {
    type: Type.Literal(AI_MENTOR_TYPE.TEACHER),
    taskGoal: nonEmptyTextSchema,
    expertise: nonEmptyTextSchema,
    contentScope: nonEmptyTextSchema,
    teachingStyle: Type.Enum(AI_MENTOR_TEACHING_STYLE),
    feedbackGuidance: optionalTextSchema,
    ...commonContentProperties,
  },
  { additionalProperties: false },
);

export const aiMentorRoleplayConfigurationContentSchema = Type.Object(
  {
    type: Type.Literal(AI_MENTOR_TYPE.ROLEPLAY),
    scenario: nonEmptyTextSchema,
    aiRole: nonEmptyTextSchema,
    learnerRole: nonEmptyTextSchema,
    characterGoal: nonEmptyTextSchema,
    difficulty: Type.Enum(AI_MENTOR_ROLEPLAY_DIFFICULTY),
    factsAndConstraints: optionalTextSchema,
    ...commonContentProperties,
  },
  { additionalProperties: false },
);

export const aiMentorConfigurationContentSchema = Type.Union([
  aiMentorTeacherConfigurationContentSchema,
  aiMentorRoleplayConfigurationContentSchema,
]);

const responseMetadataProperties = {
  id: UUIDSchema,
  aiMentorLessonId: UUIDSchema,
  needsConfiguration: Type.Boolean(),
  hasMissingTranslations: Type.Boolean(),
  language: supportedLanguagesSchema,
  baseLanguage: supportedLanguagesSchema,
  availableLocales: Type.Array(supportedLanguagesSchema),
};

export const aiMentorTeacherConfigurationResponseSchema = Type.Object(
  {
    ...responseMetadataProperties,
    type: Type.Literal(AI_MENTOR_TYPE.TEACHER),
    taskGoal: Type.String(),
    expertise: Type.String(),
    contentScope: Type.String(),
    teachingStyle: Type.Enum(AI_MENTOR_TEACHING_STYLE),
    feedbackGuidance: Type.Union([Type.String(), Type.Null()]),
    openingInstruction: Type.Union([Type.String(), Type.Null()]),
    additionalInstructions: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false },
);

export const aiMentorRoleplayConfigurationResponseSchema = Type.Object(
  {
    ...responseMetadataProperties,
    type: Type.Literal(AI_MENTOR_TYPE.ROLEPLAY),
    scenario: Type.String(),
    aiRole: Type.String(),
    learnerRole: Type.String(),
    characterGoal: Type.String(),
    difficulty: Type.Enum(AI_MENTOR_ROLEPLAY_DIFFICULTY),
    factsAndConstraints: Type.Union([Type.String(), Type.Null()]),
    openingInstruction: Type.Union([Type.String(), Type.Null()]),
    additionalInstructions: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false },
);

export const aiMentorConfigurationResponseSchema = Type.Union([
  aiMentorTeacherConfigurationResponseSchema,
  aiMentorRoleplayConfigurationResponseSchema,
]);

const teacherTranslationProperties = {
  taskGoal: Type.Optional(nonEmptyTextSchema),
  expertise: Type.Optional(nonEmptyTextSchema),
  contentScope: Type.Optional(nonEmptyTextSchema),
  feedbackGuidance: optionalTextSchema,
  openingInstruction: optionalTextSchema,
  additionalInstructions: optionalTextSchema,
};

const roleplayTranslationProperties = {
  scenario: Type.Optional(nonEmptyTextSchema),
  aiRole: Type.Optional(nonEmptyTextSchema),
  learnerRole: Type.Optional(nonEmptyTextSchema),
  characterGoal: Type.Optional(nonEmptyTextSchema),
  factsAndConstraints: optionalTextSchema,
  openingInstruction: optionalTextSchema,
  additionalInstructions: optionalTextSchema,
};

export const updateAiMentorTeacherConfigurationTranslationSchema = Type.Object(
  {
    type: Type.Literal(AI_MENTOR_TYPE.TEACHER),
    ...teacherTranslationProperties,
  },
  { additionalProperties: false, minProperties: 2 },
);

export const updateAiMentorRoleplayConfigurationTranslationSchema = Type.Object(
  {
    type: Type.Literal(AI_MENTOR_TYPE.ROLEPLAY),
    ...roleplayTranslationProperties,
  },
  { additionalProperties: false, minProperties: 2 },
);

export const updateAiMentorConfigurationTranslationSchema = Type.Union([
  updateAiMentorTeacherConfigurationTranslationSchema,
  updateAiMentorRoleplayConfigurationTranslationSchema,
]);

type AiMentorCommonConfigurationContent = {
  openingInstruction?: string | null;
  additionalInstructions?: string | null;
};

export type AiMentorTeacherConfigurationContent = AiMentorCommonConfigurationContent & {
  type: typeof AI_MENTOR_TYPE.TEACHER;
  taskGoal: string;
  expertise: string;
  contentScope: string;
  teachingStyle: AiMentorTeachingStyle;
  feedbackGuidance?: string | null;
};

export type AiMentorRoleplayConfigurationContent = AiMentorCommonConfigurationContent & {
  type: typeof AI_MENTOR_TYPE.ROLEPLAY;
  scenario: string;
  aiRole: string;
  learnerRole: string;
  characterGoal: string;
  difficulty: AiMentorRoleplayDifficulty;
  factsAndConstraints?: string | null;
};

export type AiMentorConfigurationContent =
  | AiMentorTeacherConfigurationContent
  | AiMentorRoleplayConfigurationContent;

type AiMentorConfigurationResponseMetadata = {
  id: UUIDType;
  aiMentorLessonId: UUIDType;
  needsConfiguration: boolean;
  hasMissingTranslations: boolean;
  openingInstruction: string | null;
  additionalInstructions: string | null;
  language: SupportedLanguages;
  baseLanguage: SupportedLanguages;
  availableLocales: SupportedLanguages[];
};

export type AiMentorConfigurationResponse = AiMentorConfigurationResponseMetadata &
  (
    | {
        type: typeof AI_MENTOR_TYPE.TEACHER;
        taskGoal: string;
        expertise: string;
        contentScope: string;
        teachingStyle: AiMentorTeachingStyle;
        feedbackGuidance: string | null;
      }
    | {
        type: typeof AI_MENTOR_TYPE.ROLEPLAY;
        scenario: string;
        aiRole: string;
        learnerRole: string;
        characterGoal: string;
        difficulty: AiMentorRoleplayDifficulty;
        factsAndConstraints: string | null;
      }
  );

export type UpdateAiMentorTeacherConfigurationTranslationBody = {
  type: typeof AI_MENTOR_TYPE.TEACHER;
  taskGoal?: string;
  expertise?: string;
  contentScope?: string;
  feedbackGuidance?: string | null;
  openingInstruction?: string | null;
  additionalInstructions?: string | null;
};

export type UpdateAiMentorRoleplayConfigurationTranslationBody = {
  type: typeof AI_MENTOR_TYPE.ROLEPLAY;
  scenario?: string;
  aiRole?: string;
  learnerRole?: string;
  characterGoal?: string;
  factsAndConstraints?: string | null;
  openingInstruction?: string | null;
  additionalInstructions?: string | null;
};

export type UpdateAiMentorConfigurationTranslationBody =
  | UpdateAiMentorTeacherConfigurationTranslationBody
  | UpdateAiMentorRoleplayConfigurationTranslationBody;
