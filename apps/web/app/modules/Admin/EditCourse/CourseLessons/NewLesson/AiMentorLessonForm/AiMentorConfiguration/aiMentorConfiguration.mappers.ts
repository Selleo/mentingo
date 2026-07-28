import { AI_MENTOR_TYPE } from "@repo/shared";

import type {
  AiMentorConfigurationDraft,
  AiMentorConfigurationResponse,
  AiMentorConfigurationTranslationInput,
} from "./aiMentorConfiguration.types";

const normalizeOptionalText = (value: string | null | undefined) => value?.trim() || null;

export const mapAiMentorConfigurationResponseToDraft = (
  response: AiMentorConfigurationResponse,
): AiMentorConfigurationDraft => {
  if (response.type === AI_MENTOR_TYPE.TEACHER) {
    return {
      type: AI_MENTOR_TYPE.TEACHER,
      taskGoal: response.taskGoal,
      expertise: response.expertise,
      contentScope: response.contentScope,
      teachingStyle: response.teachingStyle,
      feedbackGuidance: response.feedbackGuidance ?? "",
      openingInstruction: response.openingInstruction ?? "",
      additionalInstructions: response.additionalInstructions ?? "",
    };
  }

  return {
    type: AI_MENTOR_TYPE.ROLEPLAY,
    scenario: response.scenario,
    aiRole: response.aiRole,
    learnerRole: response.learnerRole,
    characterGoal: response.characterGoal,
    difficulty: response.difficulty,
    factsAndConstraints: response.factsAndConstraints ?? "",
    openingInstruction: response.openingInstruction ?? "",
    additionalInstructions: response.additionalInstructions ?? "",
  };
};

export const mapAiMentorConfigurationDraftToBaseInput = (
  draft: AiMentorConfigurationDraft,
): AiMentorConfigurationDraft => {
  if (draft.type === AI_MENTOR_TYPE.TEACHER) {
    return {
      ...draft,
      taskGoal: draft.taskGoal.trim(),
      expertise: draft.expertise.trim(),
      contentScope: draft.contentScope.trim(),
      feedbackGuidance: normalizeOptionalText(draft.feedbackGuidance),
      openingInstruction: normalizeOptionalText(draft.openingInstruction),
      additionalInstructions: normalizeOptionalText(draft.additionalInstructions),
    };
  }

  return {
    ...draft,
    scenario: draft.scenario.trim(),
    aiRole: draft.aiRole.trim(),
    learnerRole: draft.learnerRole.trim(),
    characterGoal: draft.characterGoal.trim(),
    factsAndConstraints: normalizeOptionalText(draft.factsAndConstraints),
    openingInstruction: normalizeOptionalText(draft.openingInstruction),
    additionalInstructions: normalizeOptionalText(draft.additionalInstructions),
  };
};

export const mapAiMentorConfigurationDraftToTranslationInput = (
  draft: AiMentorConfigurationDraft,
): AiMentorConfigurationTranslationInput => {
  if (draft.type === AI_MENTOR_TYPE.TEACHER) {
    return {
      type: AI_MENTOR_TYPE.TEACHER,
      taskGoal: draft.taskGoal.trim(),
      expertise: draft.expertise.trim(),
      contentScope: draft.contentScope.trim(),
      feedbackGuidance: normalizeOptionalText(draft.feedbackGuidance),
      openingInstruction: normalizeOptionalText(draft.openingInstruction),
      additionalInstructions: normalizeOptionalText(draft.additionalInstructions),
    };
  }

  return {
    type: AI_MENTOR_TYPE.ROLEPLAY,
    scenario: draft.scenario.trim(),
    aiRole: draft.aiRole.trim(),
    learnerRole: draft.learnerRole.trim(),
    characterGoal: draft.characterGoal.trim(),
    factsAndConstraints: normalizeOptionalText(draft.factsAndConstraints),
    openingInstruction: normalizeOptionalText(draft.openingInstruction),
    additionalInstructions: normalizeOptionalText(draft.additionalInstructions),
  };
};
