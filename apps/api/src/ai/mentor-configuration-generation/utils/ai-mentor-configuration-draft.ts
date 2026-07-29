import {
  AI_MENTOR_CONFIGURATION_FIELD,
  AI_MENTOR_CONFIGURATION_VALIDATION_SEVERITY,
  AI_MENTOR_ROLEPLAY_DIFFICULTY,
  AI_MENTOR_TEACHING_STYLE,
  AI_MENTOR_TYPE,
  type AiMentorConfigurationField,
  type AiMentorType,
} from "@repo/shared";

import { AI_MENTOR_CONFIGURATION_VALIDATOR_MAX_ISSUES } from "../ai-mentor-configuration-generation.constants";

import type {
  AiMentorConfigurationDraft,
  AiMentorConfigurationValidationIssue,
  AiMentorConfigurationValidationResult,
  GeneratedAiMentorRoleplayConfigurationFields,
  GeneratedAiMentorTeacherConfigurationFields,
} from "../schemas/ai-mentor-configuration-generation.schema";
import type { AiMentorConfigurationContent } from "src/lesson/ai-mentor-configuration/schemas/ai-mentor-configuration.schema";

const COMMON_FIELDS = [
  AI_MENTOR_CONFIGURATION_FIELD.OPENING_INSTRUCTION,
  AI_MENTOR_CONFIGURATION_FIELD.ADDITIONAL_INSTRUCTIONS,
] as const;

const TEACHER_FIELDS = [
  AI_MENTOR_CONFIGURATION_FIELD.TASK_GOAL,
  AI_MENTOR_CONFIGURATION_FIELD.EXPERTISE,
  AI_MENTOR_CONFIGURATION_FIELD.CONTENT_SCOPE,
  AI_MENTOR_CONFIGURATION_FIELD.TEACHING_STYLE,
  AI_MENTOR_CONFIGURATION_FIELD.FEEDBACK_GUIDANCE,
  ...COMMON_FIELDS,
] as const;

const ROLEPLAY_FIELDS = [
  AI_MENTOR_CONFIGURATION_FIELD.SCENARIO,
  AI_MENTOR_CONFIGURATION_FIELD.AI_ROLE,
  AI_MENTOR_CONFIGURATION_FIELD.LEARNER_ROLE,
  AI_MENTOR_CONFIGURATION_FIELD.CHARACTER_GOAL,
  AI_MENTOR_CONFIGURATION_FIELD.DIFFICULTY,
  AI_MENTOR_CONFIGURATION_FIELD.FACTS_AND_CONSTRAINTS,
  ...COMMON_FIELDS,
] as const;

const REQUIRED_TEACHER_FIELDS = [
  AI_MENTOR_CONFIGURATION_FIELD.TASK_GOAL,
  AI_MENTOR_CONFIGURATION_FIELD.EXPERTISE,
  AI_MENTOR_CONFIGURATION_FIELD.CONTENT_SCOPE,
  AI_MENTOR_CONFIGURATION_FIELD.TEACHING_STYLE,
] as const;

const REQUIRED_ROLEPLAY_FIELDS = [
  AI_MENTOR_CONFIGURATION_FIELD.SCENARIO,
  AI_MENTOR_CONFIGURATION_FIELD.AI_ROLE,
  AI_MENTOR_CONFIGURATION_FIELD.LEARNER_ROLE,
  AI_MENTOR_CONFIGURATION_FIELD.CHARACTER_GOAL,
  AI_MENTOR_CONFIGURATION_FIELD.DIFFICULTY,
] as const;

export const getAiMentorConfigurationFields = (
  type: AiMentorType,
): readonly AiMentorConfigurationField[] => {
  switch (type) {
    case AI_MENTOR_TYPE.TEACHER:
      return TEACHER_FIELDS;
    case AI_MENTOR_TYPE.ROLEPLAY:
      return ROLEPLAY_FIELDS;
    default:
      return assertNeverAiMentorType(type);
  }
};

export const attachAiMentorTeacherConfiguration = (
  fields: GeneratedAiMentorTeacherConfigurationFields,
): AiMentorConfigurationContent => ({
  type: AI_MENTOR_TYPE.TEACHER,
  ...fields,
});

export const attachAiMentorRoleplayConfiguration = (
  fields: GeneratedAiMentorRoleplayConfigurationFields,
): AiMentorConfigurationContent => ({
  type: AI_MENTOR_TYPE.ROLEPLAY,
  ...fields,
});

const assertNeverAiMentorType = (type: never): never => {
  throw new Error(`Unsupported AI Mentor configuration type: ${String(type)}`);
};

export const getDeterministicAiMentorConfigurationValidation = (
  configuration: AiMentorConfigurationDraft,
): AiMentorConfigurationValidationResult | undefined => {
  const issues: AiMentorConfigurationValidationIssue[] = [];
  const requiredFields: Array<{
    field: AiMentorConfigurationField;
    value: string | null | undefined;
  }> =
    configuration.type === AI_MENTOR_TYPE.TEACHER
      ? [
          { field: REQUIRED_TEACHER_FIELDS[0], value: configuration.taskGoal },
          { field: REQUIRED_TEACHER_FIELDS[1], value: configuration.expertise },
          { field: REQUIRED_TEACHER_FIELDS[2], value: configuration.contentScope },
          { field: REQUIRED_TEACHER_FIELDS[3], value: configuration.teachingStyle },
        ]
      : [
          { field: REQUIRED_ROLEPLAY_FIELDS[0], value: configuration.scenario },
          { field: REQUIRED_ROLEPLAY_FIELDS[1], value: configuration.aiRole },
          { field: REQUIRED_ROLEPLAY_FIELDS[2], value: configuration.learnerRole },
          { field: REQUIRED_ROLEPLAY_FIELDS[3], value: configuration.characterGoal },
          { field: REQUIRED_ROLEPLAY_FIELDS[4], value: configuration.difficulty },
        ];

  for (const { field, value } of requiredFields) {
    if (typeof value === "string" && value.trim().length > 0) continue;

    issues.push({
      code: "required_field_missing",
      severity: AI_MENTOR_CONFIGURATION_VALIDATION_SEVERITY.ERROR,
      target: { field },
      message: "This required configuration field is empty.",
      correction: "Provide a concise value that fits the selected configuration type.",
    });
  }

  if (
    configuration.type === AI_MENTOR_TYPE.TEACHER &&
    typeof configuration.teachingStyle === "string" &&
    configuration.teachingStyle.trim().length > 0 &&
    !Object.values(AI_MENTOR_TEACHING_STYLE).some(
      (style) => style === configuration.teachingStyle,
    )
  )
    issues.push({
      code: "invalid_teaching_style",
      severity: AI_MENTOR_CONFIGURATION_VALIDATION_SEVERITY.ERROR,
      target: { field: AI_MENTOR_CONFIGURATION_FIELD.TEACHING_STYLE },
      message: "The selected teaching style is not supported.",
      correction: "Choose one of the supported teaching styles.",
    });

  if (
    configuration.type === AI_MENTOR_TYPE.ROLEPLAY &&
    typeof configuration.difficulty === "string" &&
    configuration.difficulty.trim().length > 0 &&
    !Object.values(AI_MENTOR_ROLEPLAY_DIFFICULTY).some(
      (difficulty) => difficulty === configuration.difficulty,
    )
  )
    issues.push({
      code: "invalid_roleplay_difficulty",
      severity: AI_MENTOR_CONFIGURATION_VALIDATION_SEVERITY.ERROR,
      target: { field: AI_MENTOR_CONFIGURATION_FIELD.DIFFICULTY },
      message: "The selected Roleplay difficulty is not supported.",
      correction: "Choose one of the supported Roleplay difficulty levels.",
    });

  if (issues.length === 0) return undefined;

  return {
    passed: false,
    summary: "The AI Mentor configuration needs required structural corrections.",
    issues: issues.slice(0, AI_MENTOR_CONFIGURATION_VALIDATOR_MAX_ISSUES),
  };
};
