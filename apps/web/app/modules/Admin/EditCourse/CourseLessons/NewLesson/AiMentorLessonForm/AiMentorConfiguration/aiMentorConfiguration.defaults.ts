import {
  AI_MENTOR_ROLEPLAY_DIFFICULTY,
  AI_MENTOR_TEACHING_STYLE,
  AI_MENTOR_TYPE,
} from "@repo/shared";

import { stripHtmlTags } from "~/utils/stripHtmlTags";

import type { AiMentorConfigurationDraft } from "./aiMentorConfiguration.types";
import type { AiMentorType } from "@repo/shared";

export const createEmptyTeacherConfiguration = (): AiMentorConfigurationDraft => ({
  type: AI_MENTOR_TYPE.TEACHER,
  taskGoal: "",
  expertise: "",
  contentScope: "",
  teachingStyle: AI_MENTOR_TEACHING_STYLE.EXPLAIN_AND_PRACTICE,
  feedbackGuidance: "",
  openingInstruction: "",
  additionalInstructions: "",
});

export const createEmptyRoleplayConfiguration = (): AiMentorConfigurationDraft => ({
  type: AI_MENTOR_TYPE.ROLEPLAY,
  scenario: "",
  aiRole: "",
  learnerRole: "",
  characterGoal: "",
  difficulty: AI_MENTOR_ROLEPLAY_DIFFICULTY.REALISTIC,
  factsAndConstraints: "",
  openingInstruction: "",
  additionalInstructions: "",
});

export const createEmptyAiMentorConfiguration = (
  type: AiMentorType = AI_MENTOR_TYPE.ROLEPLAY,
): AiMentorConfigurationDraft =>
  type === AI_MENTOR_TYPE.TEACHER
    ? createEmptyTeacherConfiguration()
    : createEmptyRoleplayConfiguration();

export const hasAiMentorModeSpecificContent = (
  configuration: AiMentorConfigurationDraft,
): boolean => {
  const hasContent = (value: string | null | undefined) =>
    Boolean(value && stripHtmlTags(value).trim());

  if (configuration.type === AI_MENTOR_TYPE.TEACHER)
    return [
      configuration.taskGoal,
      configuration.expertise,
      configuration.contentScope,
      configuration.feedbackGuidance,
    ].some(hasContent);

  return [
    configuration.scenario,
    configuration.aiRole,
    configuration.learnerRole,
    configuration.characterGoal,
    configuration.factsAndConstraints,
  ].some(hasContent);
};

export const switchAiMentorConfigurationType = (
  configuration: AiMentorConfigurationDraft,
  type: AiMentorType,
): AiMentorConfigurationDraft => ({
  ...createEmptyAiMentorConfiguration(type),
  openingInstruction: configuration.openingInstruction,
  additionalInstructions: configuration.additionalInstructions,
});
